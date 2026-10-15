import { BadRequestException, Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { z } from 'zod';
import { config, PLANS, PlanId } from '../../config';
import { CurrentUser, Platform, SessionUser } from '../../common/auth';
import { NFC_STAGES } from '../../common/catalog';
import { sendMail } from '../../common/mail';
import { daysAgo, escapeRegex, found, initials, logActivity, parse, pct, relTime, requireId, slugify } from '../../common/util';
import { db } from '../../db/db';
import { AiService } from '../ai/ai.service';
import { serializeOrder } from '../nfc/nfc.controller';
import { healthOf, mrrOf } from './health';
import { createResetLink } from '../auth/signin-link';

const money = (n: number) => `$${Math.round(n).toLocaleString()}`;
const STATUS: Record<string, string> = {
  trial: 'Trial',
  active: 'Active',
  past_due: 'Past due',
  suspended: 'Suspended',
  churned: 'Churned',
};

@Platform()
@Controller('console')
export class ConsoleController {
  constructor(private ai: AiService) {}

  private async companyRows(filter: any = {}) {
    const companies = await db.Company.find(filter).lean<any[]>();
    const owners = await db.User.find({
      companyId: { $in: companies.map((c) => c._id) },
      role: 'owner',
    }).lean<any[]>();
    const omap = new Map(owners.map((o) => [String(o.companyId), o]));
    return Promise.all(
      companies.map(async (c) => {
        const h = await healthOf(c);
        return {
          id: String(c._id),
          ini: initials(c.name),
          name: c.name,
          country: c.country || '—',
          since: c.billing?.customerSince ? new Date(c.billing.customerSince).getFullYear() : new Date(c.createdAt).getFullYear(),
          plan: PLANS[c.plan as PlanId]?.name || c.plan,
          seats: `${h.live.toLocaleString()} / ${(c.seats || 0).toLocaleString()}`,
          hr: h.hrStatus,
          hrOk: h.hrOk,
          h: h.score,
          am: c.accountManager || 'Unassigned',
          status: STATUS[c.status] || c.status,
          statusId: c.status,
          mrr: mrrOf(c),
          owner: omap.get(String(c._id))?.email,
          trialEndsAt: c.trialEndsAt,
        };
      }),
    );
  }

  @Get('overview')
  async overview(@Query('period') period = 'month') {
    const days = period === 'week' ? 7 : period === 'quarter' ? 90 : 30;
    const companies = await db.Company.find().lean<any[]>();
    const active = companies.filter((c) => ['active', 'past_due'].includes(c.status));
    const mrr = active.reduce((a, c) => a + mrrOf(c), 0);
    const trials = companies.filter((c) => c.status === 'trial').length;
    const churned = companies.filter((c) => c.status === 'churned' && c.updatedAt >= daysAgo(days)).length;
    const cards = await db.Card.countDocuments({ status: 'live' });
    const cardsPrev = await db.Card.countDocuments({
      status: 'live',
      publishedAt: { $lt: daysAgo(days) },
    });

    // MRR by month from paid invoices (last 12 months)
    const now = new Date();
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11, 1));
    const inv = await db.Invoice.aggregate([
      {
        $match: {
          periodStart: { $gte: start },
          status: { $in: ['paid', 'open', 'failed'] },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m', date: '$periodStart' } },
          mrr: { $sum: '$amount' },
        },
      },
      { $sort: { _id: 1 } },
    ]);
    const newBy = await db.Company.aggregate([
      { $match: { 'billing.customerSince': { $gte: start } } },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m', date: '$billing.customerSince' },
          },
          n: { $sum: 1 },
        },
      },
    ]);
    const months: { month: string; mrr: number; newCompanies: number }[] = [];
    for (let i = 0; i < 12; i++) {
      const key = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + i, 1)).toISOString().slice(0, 7);
      months.push({
        month: key,
        mrr: inv.find((x) => x._id === key)?.mrr || 0,
        newCompanies: newBy.find((x) => x._id === key)?.n || 0,
      });
    }
    // The current month is still being invoiced: compare the last two full months
    const last = months[10]?.mrr || mrr;
    const prev = months[9]?.mrr || 0;

    const rows = await this.companyRows({ status: { $ne: 'churned' } });
    const attention = rows.sort((a, b) => a.h - b.h).slice(0, 5);

    // Alerts
    const alerts: { t: string; s: string; tone: string; href: string }[] = [];
    for (const c of companies.filter((x) => x.billing?.paymentStatus === 'failed' || x.status === 'past_due')) {
      alerts.push({
        t: `${c.name}: payment failed`,
        s: 'Card on file was declined',
        tone: 'error',
        href: `/console/companies/${c._id}`,
      });
    }
    const broken = await db.Integration.find({
      status: { $in: ['error', 'paused'] },
    }).lean<any[]>();
    for (const b of broken) {
      const c = companies.find((x) => String(x._id) === String(b.companyId));
      if (c)
        alerts.push({
          t: `${c.name}: HR sync ${b.status}`,
          s: b.lastError || 'Needs a look',
          tone: 'warning',
          href: `/console/companies/${c._id}`,
        });
    }
    const breaching = await db.Ticket.countDocuments({
      status: { $ne: 'closed' },
      slaDueAt: { $lt: new Date() },
    });
    if (breaching)
      alerts.push({
        t: `${breaching} tickets breaching SLA`,
        s: 'Reply first to these',
        tone: 'error',
        href: '/console/support?tab=breach',
      });
    for (const c of companies.filter((x) => x.status === 'trial' && x.trialEndsAt && x.trialEndsAt < new Date(Date.now() + 5 * 86400_000))) {
      alerts.push({
        t: `${c.name}: trial ends ${relTime(c.trialEndsAt)}`,
        s: 'Good moment for a call',
        tone: 'info',
        href: `/console/companies/${c._id}`,
      });
    }

    const stages = await db.NfcOrder.aggregate([{ $match: { stage: { $in: [...NFC_STAGES] } } }, { $group: { _id: '$stage', n: { $sum: '$qty' } } }]);
    const pastDue = await db.NfcOrder.countDocuments({
      stage: { $nin: ['delivered', 'cancelled'] },
      dueAt: { $lt: new Date() },
    });

    return {
      kpis: [
        {
          label: 'MRR',
          value: money(mrr),
          delta: `${pct(last, prev) >= 0 ? '+' : ''}${pct(last, prev)}%`,
        },
        {
          label: 'Net retention',
          value: `${Math.round((active.length / Math.max(active.length + churned, 1)) * 100)}%`,
          delta: `${churned} churned`,
        },
        {
          label: 'Active companies',
          value: active.length.toLocaleString(),
          delta: `${trials} on trial`,
        },
        {
          label: 'Active cards',
          value: cards.toLocaleString(),
          delta: `+${(cards - cardsPrev).toLocaleString()}`,
        },
        {
          label: 'Trials',
          value: trials.toLocaleString(),
          delta: 'in progress',
        },
        {
          label: 'Churned',
          value: churned.toLocaleString(),
          delta: `last ${days} days`,
        },
      ],
      months,
      alerts: alerts.slice(0, 6),
      attention,
      nfc: NFC_STAGES.filter((s) => s !== 'delivered').map((s) => ({
        stage: s,
        name: s[0]!.toUpperCase() + s.slice(1),
        count: stages.find((x) => x._id === s)?.n || 0,
      })),
      nfcPastDue: pastDue,
    };
  }

  @Get('companies')
  async companies(@Query() q: any) {
    const filter: any = {};
    if (q.q) filter.name = new RegExp(escapeRegex(q.q), 'i');
    let rows = await this.companyRows(filter);
    const groups = [
      { id: 'all', name: 'All', n: rows.length },
      {
        id: 'active',
        name: 'Active',
        n: rows.filter((r) => r.statusId === 'active').length,
      },
      {
        id: 'trial',
        name: 'Trials',
        n: rows.filter((r) => r.statusId === 'trial').length,
      },
      {
        id: 'risk',
        name: 'At risk',
        n: rows.filter((r) => r.h < 60 && r.statusId !== 'churned').length,
      },
      {
        id: 'past_due',
        name: 'Past due',
        n: rows.filter((r) => r.statusId === 'past_due').length,
      },
      {
        id: 'churned',
        name: 'Churned',
        n: rows.filter((r) => r.statusId === 'churned').length,
      },
    ];
    if (q.group === 'risk') rows = rows.filter((r) => r.h < 60 && r.statusId !== 'churned');
    else if (q.group && q.group !== 'all') rows = rows.filter((r) => r.statusId === q.group);
    rows.sort((a, b) => a.h - b.h);
    const all = await db.Company.find().lean<any[]>();
    return {
      summary: {
        active: all.filter((c) => c.status === 'active').length,
        trials: all.filter((c) => c.status === 'trial').length,
        cards: await db.Card.countDocuments({ status: 'live' }),
      },
      groups,
      rows,
      managers: [...new Set(all.map((c) => c.accountManager).filter(Boolean))],
    };
  }

  @Post('companies')
  async createTrial(@Body() body: unknown, @CurrentUser() u: SessionUser) {
    const d = parse(
      z.object({
        name: z.string().min(2).max(120),
        ownerName: z.string().min(2).max(120),
        ownerEmail: z.string().email(),
        country: z.string().max(80).optional(),
        plan: z.enum(['starter', 'professional', 'enterprise']).default('professional'),
        seats: z.number().int().min(1).max(100000).default(25),
        trialDays: z.number().int().min(1).max(90).default(14),
      }),
      body,
    );
    const email = d.ownerEmail.toLowerCase();
    if (await db.User.exists({ email })) throw new BadRequestException('This email already has a Vellaire account');
    let slug = slugify(d.name);
    if (await db.Company.exists({ slug })) slug = `${slug}-${Date.now().toString(36).slice(-4)}`;
    const company = await db.Company.create({
      name: d.name,
      slug,
      plan: d.plan,
      seats: d.seats,
      status: 'trial',
      trialEndsAt: new Date(Date.now() + d.trialDays * 86400_000),
      country: d.country,
      accountManager: u.name,
      billing: { customerSince: new Date() },
    });
    await db.Template.create({
      companyId: company._id,
      name: 'Company default',
      layout: 'classic',
      theme: 'obsidian_gold',
      isDefault: true,
    });
    await db.User.create({
      email,
      name: d.ownerName,
      companyId: company._id,
      role: 'owner',
      status: 'invited',
    });
    await sendMail({
      template: 'workspace_ready',
      to: email,
      subject: `Your Vellaire workspace for ${d.name} is ready`,
      heading: `Welcome to Vellaire, ${d.ownerName.split(' ')[0]}`,
      lines: [`Your ${d.trialDays}-day trial for ${d.name} has started. Choose a password, then set up your brand kit and create your first cards.`, 'The link works once and expires in 7 days.'],
      button: { label: 'Choose a password', url: await createResetLink(email, 7 * 24 * 60) },
    });
    await logActivity({
      companyId: company._id,
      actor: u.name,
      action: 'company.created',
      text: `Trial workspace created by ${u.name}`,
      platform: true,
    });
    return { id: String(company._id) };
  }

  @Get('companies/:id')
  async company(@Param('id') id: string) {
    const c = found(await db.Company.findById(requireId(id)).lean<any>(), 'Company');
    const [h, owner, activity, notes, invoices, users, tickets, joiners, leads] = await Promise.all([
      healthOf(c),
      db.User.findOne({ companyId: c._id, role: 'owner' }).lean<any>(),
      db.Activity.find({ companyId: c._id }).sort({ createdAt: -1 }).limit(12).lean<any[]>(),
      db.Note.find({ companyId: c._id }).sort({ createdAt: -1 }).limit(20).lean<any[]>(),
      db.Invoice.find({ companyId: c._id }).sort({ periodStart: -1 }).limit(12).lean<any[]>(),
      db.User.find({ companyId: c._id, role: { $ne: 'member' } }).lean<any[]>(),
      db.Ticket.find({ companyId: c._id }).sort({ updatedAt: -1 }).limit(10).lean<any[]>(),
      db.Employee.countDocuments({
        companyId: c._id,
        createdAt: { $gte: daysAgo(30) },
      }),
      db.Lead.countDocuments({
        companyId: c._id,
        createdAt: { $gte: daysAgo(30) },
      }),
    ]);
    const plan = PLANS[c.plan as PlanId];
    const left = (c.seats || 0) - h.live;
    const weeksLeft = joiners > 0 ? Math.max(Math.round(left / (joiners / 4.3)), 0) : null;
    return {
      id: String(c._id),
      ini: initials(c.name),
      name: c.name,
      status: STATUS[c.status],
      statusId: c.status,
      plan: plan?.name,
      planId: c.plan,
      seatsTotal: c.seats,
      sub: [
        c.city && c.country ? `${c.city}, ${c.country}` : c.country,
        c.billing?.customerSince && `customer since ${new Date(c.billing.customerSince).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}`,
        c.accountManager && `account manager ${c.accountManager}`,
      ]
        .filter(Boolean)
        .join(' · '),
      stats: [
        {
          label: 'MRR',
          value: money(mrrOf(c)),
          note: `${plan?.name} · ${money(plan?.pricePerSeat || 0)}/seat`,
        },
        {
          label: 'Live cards',
          value: h.live.toLocaleString(),
          note: `of ${c.seats} seats`,
        },
        {
          label: 'Views · 30 days',
          value: h.views.toLocaleString(),
          note: 'all cards',
        },
        {
          label: 'Leads · 30 days',
          value: leads.toLocaleString(),
          note: 'captured',
        },
      ],
      health: { score: h.score, parts: h.parts },
      activity: activity.map((a) => ({
        t: a.text,
        when: relTime(a.createdAt),
        platform: a.platform,
      })),
      account: [
        { k: 'Owner', v: owner ? `${owner.name} · ${owner.email}` : '—' },
        {
          k: 'Billing',
          v: `${c.billing?.cycle === 'monthly' ? 'Monthly' : 'Annual'}${c.billing?.renewsAt ? ` · renews ${new Date(c.billing.renewsAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}`,
        },
        {
          k: 'Seats',
          v: `${h.live.toLocaleString()} used of ${(c.seats || 0).toLocaleString()}`,
        },
        { k: 'HR link', v: h.hrStatus },
        { k: 'SSO', v: c.settings?.sso?.provider || 'Not set up' },
        {
          k: 'Data region',
          v:
            (
              {
                me: 'Middle East',
                eu: 'European Union',
                us: 'United States',
              } as any
            )[c.dataRegion] || '—',
        },
        {
          k: 'Domain',
          v: c.domain?.host ? `${c.domain.host}${c.domain.verified ? '' : ' (not verified)'}` : 'Vellaire link',
        },
      ],
      opportunity:
        weeksLeft !== null && left >= 0 && weeksLeft <= 12
          ? `${left} seats left and ${joiners} joiners in the last 30 days. At this pace they will run out of seats in about ${weeksLeft} weeks.`
          : c.status === 'trial'
            ? `Trial ends ${relTime(c.trialEndsAt)}. ${h.live} cards live so far.`
            : null,
      notes: notes.map((n) => ({
        id: String(n._id),
        body: n.body,
        author: n.author,
        when: new Date(n.createdAt).toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'short',
        }),
      })),
      invoices: invoices.map((i) => ({
        id: String(i._id),
        number: i.number,
        amount: money(i.amount),
        status: i.status,
        period: new Date(i.periodStart).toLocaleDateString('en-GB', {
          month: 'short',
          year: 'numeric',
        }),
      })),
      users: users.map((x) => ({
        id: String(x._id),
        name: x.name,
        email: x.email,
        role: x.role,
        lastLogin: x.lastLoginAt ? relTime(x.lastLoginAt) : 'Never',
      })),
      tickets: tickets.map((t) => ({
        id: String(t._id),
        subject: t.subject,
        status: t.status,
        when: relTime(t.updatedAt),
      })),
      seatInfo: { used: h.live, seats: c.seats, joiners, owner: owner?.name },
    };
  }

  @Patch('companies/:id')
  async updateCompany(@Param('id') id: string, @Body() body: unknown, @CurrentUser() u: SessionUser) {
    const d = parse(
      z.object({
        plan: z.enum(['starter', 'professional', 'enterprise']).optional(),
        seats: z.number().int().min(1).max(100000).optional(),
        status: z.enum(['trial', 'active', 'past_due', 'suspended', 'churned']).optional(),
        accountManager: z.string().max(80).optional(),
        trialEndsAt: z.string().datetime().optional(),
      }),
      body,
    );
    const c = found(await db.Company.findById(requireId(id)), 'Company');
    const before = `${c.plan} · ${c.seats} seats · ${c.status}`;
    Object.assign(c, d, d.trialEndsAt ? { trialEndsAt: new Date(d.trialEndsAt) } : {});
    if (d.status === 'active' && !c.billing?.customerSince) c.set('billing.customerSince', new Date());
    if (d.status === 'active') c.set('billing.paymentStatus', 'ok');
    if (d.status === 'churned' && !c.churnedAt) c.set('churnedAt', new Date());
    await c.save();
    await logActivity({
      companyId: c._id,
      actor: u.name,
      action: 'company.updated',
      text: `${u.name} changed ${before} → ${c.plan} · ${c.seats} seats · ${c.status}`,
      platform: true,
    });
    return { ok: true };
  }

  @Post('companies/:id/notes')
  async note(@Param('id') id: string, @Body() body: unknown, @CurrentUser() u: SessionUser) {
    const d = parse(z.object({ body: z.string().min(1).max(2000) }), body);
    await db.Note.create({
      companyId: requireId(id),
      author: u.name.split(' ')[0],
      body: d.body,
    });
    return { ok: true };
  }

  @Post('companies/:id/upgrade-email')
  async upgradeEmail(@Param('id') id: string) {
    const c = found(await db.Company.findById(requireId(id)).lean<any>(), 'Company');
    const h = await healthOf(c);
    const owner = await db.User.findOne({
      companyId: c._id,
      role: 'owner',
    }).lean<any>();
    const joiners = await db.Employee.countDocuments({
      companyId: c._id,
      createdAt: { $gte: daysAgo(30) },
    });
    const input = {
      company: c.name,
      owner: owner?.name || 'there',
      used: h.live,
      seats: c.seats,
      joiners,
    };
    if (this.ai.enabled) return { draft: await this.ai.seatUpgradeEmail(input), to: owner?.email };
    return {
      to: owner?.email,
      draft: `Dear ${input.owner.split(' ')[0]},\n\n${c.name} now has ${input.used} live cards of ${input.seats} seats, with ${joiners} people joining in the last month. To keep new joiners' cards arriving on their first day, we suggest adding seats before you reach the limit.\n\nI can send a proposal for the remaining term whenever suits you.\n\nYour Vellaire team`,
    };
  }

  @Get('demos')
  async demos() {
    const rows = await db.DemoRequest.find().sort({ createdAt: -1 }).limit(50).lean<any[]>();
    return rows.map((r) => ({
      id: String(r._id),
      name: r.name,
      email: r.email,
      company: r.company,
      size: r.size,
      hr: r.hr,
      message: r.message,
      status: r.status,
      when: relTime(r.createdAt),
    }));
  }

  @Patch('demos/:id')
  async demoStatus(@Param('id') id: string, @Body() body: unknown) {
    const d = parse(z.object({ status: z.enum(['new', 'contacted', 'won', 'lost']) }), body);
    await db.DemoRequest.updateOne({ _id: requireId(id) }, d);
    return { ok: true };
  }

  /* ---------- NFC fulfilment ---------- */

  @Get('nfc')
  async nfc(@Query() q: any) {
    const filter: any = { stage: { $ne: 'cancelled' } };
    if (q.supplier) filter.supplier = q.supplier;
    if (q.pastDue === '1') filter.dueAt = { $lt: new Date() };
    const [orders, suppliers] = await Promise.all([db.NfcOrder.find(filter).sort({ dueAt: 1 }).limit(400).lean<any[]>(), db.NfcOrder.distinct('supplier')]);
    const companies = await db.Company.find({
      _id: { $in: orders.map((o) => o.companyId) },
    })
      .select('name')
      .lean<any[]>();
    const cmap = new Map(companies.map((c) => [String(c._id), c.name]));
    const open = orders.filter((o) => o.stage !== 'delivered');
    const COLUMN: Record<string, string> = {
      received: 'New',
      proof: 'Artwork check',
      production: 'In production',
      encoded: 'Encoded and tested',
      shipped: 'Shipped',
      delivered: 'Delivered',
    };
    const NEXT: Record<string, string> = {
      received: 'Send design proof',
      proof: 'Waiting for approval',
      production: 'Encode the chips',
      encoded: 'Ship when ready',
      shipped: 'Confirm delivery',
      delivered: 'Done',
    };
    return {
      summary: {
        open: open.length,
        pastDue: open.filter((o) => o.dueAt && o.dueAt < new Date()).length,
        cards: open.reduce((a, o) => a + (o.qty || 0), 0),
      },
      suppliers,
      columns: NFC_STAGES.map((s) => {
        const list = orders.filter((o) => o.stage === s).slice(0, s === 'delivered' ? 8 : 100);
        return {
          id: s,
          name: COLUMN[s],
          count: orders.filter((o) => o.stage === s).length,
          orders: list.map((o) => ({
            ...serializeOrder(o),
            company: cmap.get(String(o.companyId)),
            next: NEXT[o.stage],
            due: o.dueAt
              ? new Date(o.dueAt).toLocaleDateString('en-GB', {
                  day: 'numeric',
                  month: 'short',
                })
              : '—',
          })),
        };
      }),
    };
  }

  @Patch('nfc/:id')
  async moveOrder(@Param('id') id: string, @Body() body: unknown, @CurrentUser() u: SessionUser) {
    const d = parse(
      z.object({
        stage: z.enum(['received', 'proof', 'production', 'encoded', 'shipped', 'delivered', 'cancelled']).optional(),
        tracking: z.string().max(80).optional(),
        supplier: z.string().max(80).optional(),
      }),
      body,
    );
    const o = found(await db.NfcOrder.findById(requireId(id)), 'Order');
    if (d.stage && d.stage !== o.stage) {
      o.stage = d.stage;
      o.history.push({ stage: d.stage, at: new Date(), by: u.name } as any);
      if (d.stage === 'delivered') {
        // Chips work from the moment they arrive
        await db.NfcDevice.updateMany({ orderId: o._id, status: 'disabled' }, { status: 'active' });
      }
      await logActivity({
        companyId: o.companyId,
        actor: u.name,
        action: 'nfc.stage',
        text: `NFC order ${o.number}: ${d.stage}`,
        platform: true,
      });
    }
    if (d.tracking !== undefined) o.tracking = d.tracking;
    if (d.supplier) o.supplier = d.supplier;
    await o.save();
    return { ok: true };
  }

  /* ---------- Support ---------- */

  @Get('support')
  async support(@Query('tab') tab: string, @CurrentUser() u: SessionUser) {
    const base: any = { status: { $ne: 'closed' } };
    const [open, mine, breach] = await Promise.all([
      db.Ticket.countDocuments(base),
      db.Ticket.countDocuments({ ...base, assignee: u.name }),
      db.Ticket.countDocuments({ ...base, slaDueAt: { $lt: new Date() } }),
    ]);
    const filter = tab === 'mine' ? { ...base, assignee: u.name } : tab === 'breach' ? { ...base, slaDueAt: { $lt: new Date() } } : tab === 'closed' ? { status: 'closed' } : base;
    const rows = await db.Ticket.find(filter).sort({ slaDueAt: 1 }).limit(100).lean<any[]>();
    const companies = await db.Company.find({
      _id: { $in: rows.map((t) => t.companyId) },
    })
      .select('name')
      .lean<any[]>();
    const cmap = new Map(companies.map((c) => [String(c._id), c.name]));
    return {
      tabs: [
        { id: 'open', name: 'Open', n: open },
        { id: 'mine', name: 'Mine', n: mine },
        { id: 'breach', name: 'Breaching SLA', n: breach },
        { id: 'closed', name: 'Closed', n: null },
      ],
      rows: rows.map((t) => ({
        id: String(t._id),
        company: cmap.get(String(t.companyId)),
        subject: t.subject,
        priority: t.priority,
        who: t.openedBy?.name,
        sla: t.slaDueAt ? (t.slaDueAt < new Date() ? 'Breached' : `${Math.max(Math.round((t.slaDueAt.getTime() - Date.now()) / 3600_000), 0)} h left`) : '—',
        breached: t.slaDueAt && t.slaDueAt < new Date(),
        status: t.status,
        assignee: t.assignee,
      })),
    };
  }

  @Get('support/:id')
  async ticket(@Param('id') id: string) {
    const t = found(await db.Ticket.findById(requireId(id)).lean<any>(), 'Ticket');
    const c = await db.Company.findById(t.companyId).lean<any>();
    const h = await healthOf(c);
    const integration = await db.Integration.findOne({
      companyId: c._id,
      status: { $ne: 'draft' },
    }).lean<any>();
    return {
      id: String(t._id),
      number: t.number,
      subject: t.subject,
      status: t.status,
      priority: t.priority,
      assignee: t.assignee,
      opened: `${c.name} · opened by ${t.openedBy?.name}${t.openedBy?.role ? ` (${t.openedBy.role.replace('_', ' ')})` : ''} · ${relTime(t.createdAt)}`,
      messages: (t.messages || []).map((m: any) => ({
        ...m,
        when: relTime(m.at),
      })),
      company: {
        id: String(c._id),
        ini: initials(c.name),
        name: c.name,
        plan: `${PLANS[c.plan as PlanId]?.name} · ${c.seats} seats`,
        health: h.score,
        payment: c.billing?.paymentStatus === 'failed' || c.status === 'past_due' ? 'Past due' : 'Paid',
        hr: integration ? (integration.status === 'connected' ? 'Healthy' : integration.lastError || integration.status) : 'Not connected',
        openTickets: h.openTickets,
      },
    };
  }

  @Post('support/:id/reply')
  async reply(@Param('id') id: string, @Body() body: unknown, @CurrentUser() u: SessionUser) {
    const d = parse(
      z.object({
        body: z.string().min(1).max(4000),
        internal: z.boolean().default(false),
        close: z.boolean().default(false),
      }),
      body,
    );
    const t = found(await db.Ticket.findById(requireId(id)), 'Ticket');
    t.messages.push({
      author: u.name,
      kind: d.internal ? 'internal' : 'staff',
      body: d.body,
      at: new Date(),
    } as any);
    if (!d.internal) t.status = d.close ? 'closed' : 'pending';
    if (!t.assignee) t.assignee = u.name;
    await t.save();
    if (!d.internal && t.openedBy?.email) {
      await sendMail({
        template: 'support_reply',
        to: t.openedBy.email,
        subject: `Re: ${t.subject} [#${t.number}]`,
        heading: t.subject,
        lines: d.body.split(/\n+/),
        button: {
          label: 'Open in Vellaire',
          url: `${config.webUrl}/app/support`,
        },
      });
    }
    return { ok: true };
  }

  @Patch('support/:id')
  async updateTicket(@Param('id') id: string, @Body() body: unknown, @CurrentUser() u: SessionUser) {
    const d = parse(
      z.object({
        status: z.enum(['open', 'pending', 'closed']).optional(),
        priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
        assignToMe: z.boolean().optional(),
        escalate: z.boolean().optional(),
      }),
      body,
    );
    const t = found(await db.Ticket.findById(requireId(id)), 'Ticket');
    if (d.status) t.status = d.status;
    if (d.priority) t.priority = d.priority;
    if (d.assignToMe) t.assignee = u.name;
    if (d.escalate) {
      t.priority = 'urgent';
      t.messages.push({
        author: u.name,
        kind: 'internal',
        body: 'Escalated to engineering',
        at: new Date(),
      } as any);
    }
    await t.save();
    return { ok: true };
  }

  @Post('support/:id/suggest')
  async suggest(@Param('id') id: string) {
    const t = found(await db.Ticket.findById(requireId(id)).lean<any>(), 'Ticket');
    const c = await db.Company.findById(t.companyId).lean<any>();
    const integration = await db.Integration.findOne({
      companyId: c._id,
    }).lean<any>();
    const thread = (t.messages || [])
      .filter((m: any) => m.kind !== 'internal')
      .map((m: any) => `${m.author}: ${m.body}`)
      .join('\n');
    if (this.ai.enabled) {
      return {
        text: await this.ai.supportReply({
          subject: t.subject,
          thread,
          company: c.name,
          context: integration?.lastError ? `HR integration error: ${integration.lastError}` : undefined,
        }),
        usedAi: true,
      };
    }
    const first = String(t.openedBy?.name || '').split(' ')[0] || 'there';
    const isSync = /sync|hr|workday|bamboo|sap|entra/i.test(t.subject + thread);
    return {
      usedAi: false,
      text: isSync
        ? `Thanks ${first} — the HR connection needs to be re-authorised by an admin. Open HR integrations, choose your HR system and sign in again; any waiting cards will be created as soon as the sync runs.`
        : `Thanks ${first} — we are looking into this now and will update you here within the next few hours.`,
    };
  }

  /* ---------- Revenue ---------- */

  @Get('revenue')
  async revenue() {
    const companies = await db.Company.find().lean<any[]>();
    const byPlan = Object.entries(PLANS).map(([id, p]) => {
      const list = companies.filter((c) => c.plan === id && ['active', 'past_due'].includes(c.status));
      return {
        id,
        name: p.name,
        companies: list.length,
        seats: list.reduce((a, c) => a + c.seats, 0),
        mrr: list.reduce((a, c) => a + mrrOf(c), 0),
      };
    });
    const invoices = await db.Invoice.find().sort({ periodStart: -1 }).limit(60).lean<any[]>();
    const cmap = new Map(companies.map((c) => [String(c._id), c.name]));
    return {
      mrr: byPlan.reduce((a, p) => a + p.mrr, 0),
      arr: byPlan.reduce((a, p) => a + p.mrr, 0) * 12,
      byPlan,
      failed: invoices.filter((i) => i.status === 'failed').length,
      invoices: invoices.map((i) => ({
        id: String(i._id),
        number: i.number,
        company: cmap.get(String(i.companyId)),
        amount: money(i.amount),
        status: i.status,
        period: new Date(i.periodStart).toLocaleDateString('en-GB', {
          month: 'short',
          year: 'numeric',
        }),
      })),
    };
  }

  @Patch('invoices/:id')
  async invoice(@Param('id') id: string, @Body() body: unknown) {
    const d = parse(z.object({ status: z.enum(['paid', 'open', 'failed']) }), body);
    const i = found(await db.Invoice.findByIdAndUpdate(requireId(id), { status: d.status }, { new: true }), 'Invoice');
    if (d.status === 'paid') await db.Company.updateOne({ _id: i.companyId, status: 'past_due' }, { status: 'active', 'billing.paymentStatus': 'ok' });
    if (d.status === 'failed') await db.Company.updateOne({ _id: i.companyId }, { status: 'past_due', 'billing.paymentStatus': 'failed' });
    return { ok: true };
  }
}
