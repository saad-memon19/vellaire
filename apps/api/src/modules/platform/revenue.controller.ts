import { BadRequestException, Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { z } from 'zod';
import { PLANS, PlanId } from '../../config';
import { CurrentUser, Platform, SessionUser } from '../../common/auth';
import { MATERIALS } from '../../common/catalog';
import { refreshPlanCache } from '../../common/platform';
import { found, logActivity, parse, requireId } from '../../common/util';
import { db } from '../../db/db';
import { mrrOf } from '../console/health';
import { dayLabel, lastMonths, money, monthKey, monthLabel, monthStart, share } from './shared';

const REGIONS = ['me', 'eu', 'us'] as const;
const PAYING = ['active', 'past_due'];

/** Country → the market shown on the revenue page; everything else is "Other". */
const MARKETS: Record<string, string> = { UAE: 'UAE', 'United Arab Emirates': 'UAE', 'Saudi Arabia': 'Saudi Arabia', 'United Kingdom': 'United Kingdom', Pakistan: 'Pakistan' };
const regionOf = (country?: string) => MARKETS[country || ''] || 'Other';

const planBody = z.object({
  name: z.string().min(1).max(40),
  pricePerSeat: z.number().min(0).max(10000),
  minSeats: z.number().int().min(1).max(100000),
  features: z.array(z.object({ name: z.string().min(1).max(80), on: z.boolean() })).max(12),
  limits: z.object({
    subBrands: z.string().max(40),
    hrConnections: z.string().max(40),
    aiCredits: z.number().int().min(0).max(100000).nullable(),
    admins: z.string().max(40),
    support: z.string().max(60),
  }),
});

@Platform()
@Controller('console')
export class ConsoleRevenueController {
  /* ---------- Plans ---------- */

  @Get('plans')
  async plans() {
    const [plans, companies] = await Promise.all([
      db.Plan.find().lean<any[]>(),
      db.Company.find({ status: { $ne: 'churned' } })
        .select('plan')
        .lean<any[]>(),
    ]);
    const live = await db.Card.aggregate([{ $match: { status: 'live' } }, { $group: { _id: '$companyId', n: { $sum: 1 } } }]);
    const cardsBy = new Map(live.map((r) => [String(r._id), r.n as number]));
    const order = Object.keys(PLANS);
    return plans
      .sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key))
      .map((p) => {
        const mine = companies.filter((c) => c.plan === p.key);
        return {
          key: p.key,
          name: p.name,
          version: p.version,
          pricePerSeat: p.pricePerSeat,
          minSeats: p.minSeats,
          regionalPrices: Object.fromEntries(Object.entries(p.regionalPrices || {})),
          features: p.features,
          limits: p.limits,
          companies: mine.length,
          cards: mine.reduce((a, c) => a + (cardsBy.get(String(c._id)) || 0), 0),
          history: (p.history || [])
            .slice(-10)
            .reverse()
            .map((h: any) => ({ ...h, at: dayLabel(h.at) })),
        };
      });
  }

  @Patch('plans/:key')
  async updatePlan(@Param('key') key: string, @Body() body: unknown, @CurrentUser() u: SessionUser) {
    const d = parse(planBody, body);
    const plan = found(await db.Plan.findOne({ key }), 'Plan');
    plan.history.push({ version: plan.version, pricePerSeat: plan.pricePerSeat, minSeats: plan.minSeats, at: new Date(), by: u.name });
    Object.assign(plan, d, { version: plan.version + 1 });
    await plan.save();
    refreshPlanCache(plan.toObject());
    await logActivity({ actor: u.name, action: 'plan.updated', text: `Updated ${d.name} plan to version ${plan.version} · ${money(d.pricePerSeat)} per seat`, platform: true });
    return { ok: true };
  }

  @Patch('plans/:key/regions')
  async regionalPrices(@Param('key') key: string, @Body() body: unknown, @CurrentUser() u: SessionUser) {
    const d = parse(z.record(z.enum(REGIONS), z.number().min(0).max(10000).nullable()), body);
    const plan = found(await db.Plan.findOne({ key }), 'Plan');
    for (const [region, price] of Object.entries(d)) {
      if (price === null) plan.regionalPrices.delete(region);
      else plan.regionalPrices.set(region, price);
    }
    await plan.save();
    await logActivity({ actor: u.name, action: 'plan.regions', text: `Changed regional prices for ${plan.name}`, platform: true });
    return { ok: true };
  }

  /* ---------- Revenue analytics ---------- */

  @Get('revenue/analytics')
  async analytics() {
    const months = lastMonths(12);
    const from = months[0]!;
    const [companies, invoices, orders] = await Promise.all([
      db.Company.find().lean<any[]>(),
      db.Invoice.find({ status: { $ne: 'failed' } })
        .select('companyId amount periodStart')
        .lean<any[]>(),
      db.NfcOrder.find({ createdAt: { $gte: new Date(Date.UTC(new Date().getUTCFullYear(), 0, 1)) }, stage: { $ne: 'cancelled' } })
        .select('qty material')
        .lean<any[]>(),
    ]);

    // Invoiced amount per company per month
    const byCompany = new Map<string, Map<string, number>>();
    for (const i of invoices) {
      const key = monthKey(new Date(i.periodStart));
      const m = byCompany.get(String(i.companyId)) || new Map<string, number>();
      m.set(key, (m.get(key) || 0) + i.amount);
      byCompany.set(String(i.companyId), m);
    }
    const firstMonth = new Map([...byCompany].map(([id, m]) => [id, [...m.keys()].sort()[0]!]));

    const movement = months.map((d, idx) => {
      const key = monthKey(d);
      const prevKey = monthKey(idx ? months[idx - 1]! : monthStart(-12));
      let fresh = 0;
      let expansion = 0;
      let lost = 0;
      for (const [id, m] of byCompany) {
        const now = m.get(key) || 0;
        const before = m.get(prevKey) || 0;
        if (firstMonth.get(id) === key) fresh += now;
        else if (now > before) expansion += now - before;
        else if (before > now) lost += before - now;
      }
      return { m: monthLabel(d), new: Math.round(fresh), expansion: Math.round(expansion), lost: Math.round(lost) };
    });

    // Net revenue retention: this month's billing from customers who were billed 12 months ago
    const thenKey = monthKey(monthStart(-12));
    const nowKey = monthKey(monthStart(-1));
    let then = 0;
    let stillNow = 0;
    for (const m of byCompany.values()) {
      if (!m.get(thenKey)) continue;
      then += m.get(thenKey)!;
      stillNow += m.get(nowKey) || 0;
    }

    const paying = companies.filter((c) => PAYING.includes(c.status));
    const mrr = paying.reduce((a, c) => a + mrrOf(c), 0);
    const lost12 = companies.filter((c) => c.status === 'churned' && new Date(c.churnedAt || c.updatedAt) >= from).length;
    const price = (id: string) => MATERIALS.find((m) => m.id === id)?.price || 0;
    const nfcCards = orders.reduce((a, o) => a + (o.qty || 0), 0);
    const nfcRevenue = orders.reduce((a, o) => a + (o.qty || 0) * price(o.material), 0);

    const shareBy = (keyOf: (c: any) => string, order?: string[]) => {
      const sums = new Map<string, number>();
      for (const c of paying) sums.set(keyOf(c), (sums.get(keyOf(c)) || 0) + mrrOf(c));
      const keys = order || [...sums.keys()].sort((a, b) => (a === 'Other' ? 1 : b === 'Other' ? -1 : sums.get(b)! - sums.get(a)!));
      return keys.filter((k) => sums.has(k)).map((k) => ({ n: k, p: share(sums.get(k)!, mrr) }));
    };

    // Cohorts: of the companies that became customers in a month, how many still pay N months later
    const cohorts = lastMonths(6).map((start) => {
      const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
      const group = companies.filter((c) => {
        const since = c.billing?.customerSince ? new Date(c.billing.customerSince) : null;
        return since && since >= start && since < end;
      });
      const cells = Array.from({ length: 6 }, (_, k) => {
        const at = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + k + 1, 1));
        if (at > monthStart(1) || !group.length) return null;
        const kept = group.filter((c) => !(c.status === 'churned' && new Date(c.churnedAt || c.updatedAt) < at)).length;
        return share(kept, group.length);
      });
      return { m: monthLabel(start, true), size: group.length, v: cells };
    });

    return {
      kpis: [
        { label: 'Monthly recurring', value: money(mrr), note: `${paying.length} paying companies` },
        { label: 'Net retention', value: then ? `${share(stillNow, then)}%` : '—', note: then ? 'Trailing 12 months' : 'Needs 12 months of invoices' },
        { label: 'Companies lost', value: String(lost12), note: 'Last 12 months', tone: lost12 ? 'err' : undefined },
        { label: 'NFC hardware', value: money(nfcRevenue), note: `${nfcCards.toLocaleString()} cards this year` },
      ],
      movement,
      regions: shareBy((c) => regionOf(c.country)),
      plans: shareBy((c) => PLANS[c.plan as PlanId]?.name || c.plan, ['Enterprise', 'Professional', 'Starter']),
      cohorts,
    };
  }

  /* ---------- Partners and coupons ---------- */

  @Get('partners')
  async partners() {
    const [partners, coupons, companies] = await Promise.all([
      db.Partner.find().sort({ status: 1, name: 1 }).lean<any[]>(),
      db.Coupon.find().sort({ status: 1, expiresAt: 1 }).lean<any[]>(),
      db.Company.find({ status: { $ne: 'churned' } })
        .select('partnerId couponCode status plan seats')
        .lean<any[]>(),
    ]);
    const live = await db.Card.aggregate([{ $match: { status: 'live' } }, { $group: { _id: '$companyId', n: { $sum: 1 } } }]);
    const cardsBy = new Map(live.map((r) => [String(r._id), r.n as number]));
    const pmap = new Map(partners.map((p) => [String(p._id), p.name]));
    const now = new Date();
    const monthEnd = monthStart(1);
    const liveCoupons = coupons.filter((c) => c.status === 'active' && (!c.expiresAt || c.expiresAt > now));
    const fromPartners = companies.filter((c) => c.partnerId);
    const commission = partners.reduce((sum, p) => {
      const mine = fromPartners.filter((c) => String(c.partnerId) === String(p._id));
      return sum + (mine.reduce((a, c) => a + mrrOf(c), 0) * (p.commissionPct || 0)) / 100;
    }, 0);

    return {
      kpis: [
        {
          label: 'Active partners',
          value: String(partners.filter((p) => p.status === 'active').length),
          note: `${partners.filter((p) => p.status === 'pending').length} in onboarding`,
        },
        { label: 'Companies from partners', value: String(fromPartners.length), note: `${share(fromPartners.length, companies.length)}% of all customers`, tone: 'ok' },
        { label: 'Live coupons', value: String(liveCoupons.length), note: `${liveCoupons.filter((c) => c.expiresAt && c.expiresAt < monthEnd).length} expire this month` },
        { label: 'Commission due', value: money(commission), note: 'This month, from partner MRR' },
      ],
      partners: partners.map((p) => {
        const mine = fromPartners.filter((c) => String(c.partnerId) === String(p._id));
        return {
          id: String(p._id),
          name: p.name,
          kind: p.kind,
          region: p.region || '—',
          companies: mine.length,
          cards: mine.reduce((a, c) => a + (cardsBy.get(String(c._id)) || 0), 0),
          commissionPct: p.commissionPct,
          status: p.status,
        };
      }),
      coupons: coupons.map((c) => {
        const used = companies.filter((co) => co.couponCode === c.code).length;
        const expired = c.expiresAt && c.expiresAt < now;
        return {
          id: String(c._id),
          code: c.code,
          offer: c.offer,
          partner: c.partnerId ? pmap.get(String(c.partnerId)) || '—' : '—',
          used,
          maxUses: c.maxUses,
          expires: dayLabel(c.expiresAt),
          status: c.status === 'archived' ? 'archived' : expired ? 'expired' : used >= c.maxUses ? 'used_up' : 'active',
        };
      }),
      companies: (
        await db.Company.find({ partnerId: null, status: { $ne: 'churned' } })
          .select('name')
          .sort({ name: 1 })
          .lean<any[]>()
      ).map((c) => ({ id: String(c._id), name: c.name })),
    };
  }

  @Post('partners')
  async addPartner(@Body() body: unknown, @CurrentUser() u: SessionUser) {
    const d = parse(
      z.object({
        name: z.string().min(2).max(80),
        kind: z.string().min(2).max(40),
        region: z.string().max(60).optional(),
        commissionPct: z.number().min(0).max(50),
        contactEmail: z.string().email().optional().or(z.literal('')),
      }),
      body,
    );
    const p = await db.Partner.create({ ...d, status: 'pending' });
    await logActivity({ actor: u.name, action: 'partner.added', text: `Added partner ${p.name}`, platform: true });
    return { id: String(p._id) };
  }

  @Patch('partners/:id')
  async updatePartner(@Param('id') id: string, @Body() body: unknown, @CurrentUser() u: SessionUser) {
    const d = parse(z.object({ status: z.enum(['pending', 'active', 'archived']).optional(), commissionPct: z.number().min(0).max(50).optional() }), body);
    const p = found(await db.Partner.findByIdAndUpdate(requireId(id), d, { new: true }), 'Partner');
    await logActivity({ actor: u.name, action: 'partner.updated', text: `Updated partner ${p.name}`, platform: true });
    return { ok: true };
  }

  /** Credit a customer to a partner, so it counts toward their commission. */
  @Post('partners/:id/companies')
  async linkCompany(@Param('id') id: string, @Body() body: unknown, @CurrentUser() u: SessionUser) {
    const { companyId } = parse(z.object({ companyId: z.string() }), body);
    const p = found(await db.Partner.findById(requireId(id)).lean<any>(), 'Partner');
    const c = found(await db.Company.findByIdAndUpdate(requireId(companyId), { partnerId: p._id }, { new: true }), 'Company');
    await logActivity({ companyId: c._id, actor: u.name, action: 'partner.linked', text: `${c.name} credited to ${p.name}`, platform: true });
    return { ok: true };
  }

  @Post('coupons')
  async addCoupon(@Body() body: unknown, @CurrentUser() u: SessionUser) {
    const d = parse(
      z.object({
        code: z
          .string()
          .min(3)
          .max(24)
          .regex(/^[A-Za-z0-9-]+$/, 'Letters, numbers and dashes only'),
        offer: z.string().min(2).max(120),
        partnerId: z.string().optional().or(z.literal('')),
        maxUses: z.number().int().min(1).max(100000),
        expiresAt: z.string().optional().or(z.literal('')),
      }),
      body,
    );
    if (await db.Coupon.exists({ code: d.code.toUpperCase() })) throw new BadRequestException('That code already exists');
    await db.Coupon.create({
      ...d,
      partnerId: d.partnerId ? requireId(d.partnerId) : undefined,
      expiresAt: d.expiresAt ? new Date(d.expiresAt) : undefined,
    });
    await logActivity({ actor: u.name, action: 'coupon.added', text: `Created coupon ${d.code.toUpperCase()}`, platform: true });
    return { ok: true };
  }

  @Patch('coupons/:id')
  async updateCoupon(@Param('id') id: string, @Body() body: unknown, @CurrentUser() u: SessionUser) {
    const d = parse(z.object({ status: z.enum(['active', 'archived']) }), body);
    const c = found(await db.Coupon.findByIdAndUpdate(requireId(id), d, { new: true }), 'Coupon');
    await logActivity({ actor: u.name, action: 'coupon.updated', text: `${d.status === 'archived' ? 'Archived' : 'Reopened'} coupon ${c.code}`, platform: true });
    return { ok: true };
  }
}
