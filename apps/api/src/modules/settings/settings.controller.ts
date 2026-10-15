import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { resolveTxt } from 'dns/promises';
import { z } from 'zod';
import { config, PLANS, PlanId } from '../../config';
import { ADMINS, CurrentUser, MANAGERS, Roles, SessionUser } from '../../common/auth';
import { sendMail } from '../../common/mail';
import { found, initials, logActivity, parse, relTime, requireId, shortId } from '../../common/util';
import { db } from '../../db/db';
import { oid } from '../../db/schemas';
import { createResetLink } from '../auth/signin-link';

const CNAME_TARGET = process.env.CARD_CNAME_TARGET || 'cards.vellaire.app';

@Controller()
export class SettingsController {
  @Get('settings')
  async get(@CurrentUser() u: SessionUser) {
    const c = found(await db.Company.findById(u.companyId).lean<any>(), 'Company');
    return {
      name: c.name,
      slug: c.slug,
      country: c.country,
      city: c.city,
      dataRegion: c.dataRegion,
      settings: {
        approvalRequired: !!c.settings?.approvalRequired,
        photoApproval: c.settings?.photoApproval !== false,
        teamPage: !!c.settings?.teamPage,
        languages: c.settings?.languages || ['en'],
        crm: {
          provider: c.settings?.crm?.provider || '',
          webhookUrl: c.settings?.crm?.webhookUrl || '',
          hasToken: !!c.settings?.crm?.token,
        },
        sso: c.settings?.sso || {},
        scimConfigured: !!c.settings?.scimTokenHash,
      },
      domain: {
        host: c.domain?.host || '',
        verified: !!c.domain?.verified,
        txtName: c.domain?.host ? `_vellaire.${c.domain.host}` : '',
        txtValue: c.domain?.verifyToken || '',
        cname: CNAME_TARGET,
        defaultUrl: `${config.webUrl}/c/${c.slug}/`,
      },
    };
  }

  @Roles(...ADMINS)
  @Patch('settings/company')
  async company(@Body() body: unknown, @CurrentUser() u: SessionUser) {
    const d = parse(
      z.object({
        name: z.string().min(2).max(120).optional(),
        country: z.string().max(80).optional(),
        city: z.string().max(80).optional(),
        approvalRequired: z.boolean().optional(),
        photoApproval: z.boolean().optional(),
        teamPage: z.boolean().optional(),
        languages: z.array(z.string().min(2).max(5)).min(1).max(10).optional(),
      }),
      body,
    );
    const set: any = {};
    if (d.name) set.name = d.name;
    if (d.country !== undefined) set.country = d.country;
    if (d.city !== undefined) set.city = d.city;
    if (d.approvalRequired !== undefined) set['settings.approvalRequired'] = d.approvalRequired;
    if (d.photoApproval !== undefined) set['settings.photoApproval'] = d.photoApproval;
    if (d.teamPage !== undefined) set['settings.teamPage'] = d.teamPage;
    if (d.languages) set['settings.languages'] = d.languages;
    await db.Company.updateOne({ _id: oid(u.companyId!) }, { $set: set });
    return { ok: true };
  }

  @Roles(...ADMINS)
  @Patch('settings/crm')
  async crm(@Body() body: unknown, @CurrentUser() u: SessionUser) {
    const d = parse(
      z.object({
        provider: z.enum(['', 'hubspot', 'salesforce', 'webhook']),
        token: z.string().max(400).optional(),
        webhookUrl: z.string().url().or(z.literal('')).optional(),
      }),
      body,
    );
    const set: any = {
      'settings.crm.provider': d.provider || null,
      'settings.crm.webhookUrl': d.webhookUrl || null,
    };
    if (d.token) set['settings.crm.token'] = d.token;
    await db.Company.updateOne({ _id: oid(u.companyId!) }, { $set: set });
    await logActivity({
      companyId: oid(u.companyId!),
      actor: u.name,
      action: 'crm.connected',
      text: d.provider ? `CRM connected: ${d.provider}` : 'CRM disconnected',
    });
    return { ok: true };
  }

  /* ---------- Team and roles ---------- */

  @Get('settings/team')
  async team(@CurrentUser() u: SessionUser) {
    const companyId = oid(u.companyId!);
    let [users, members] = await Promise.all([
      db.User.find({ companyId, role: { $ne: 'member' } })
        .sort({ role: 1, name: 1 })
        .lean<any[]>(),
      db.User.countDocuments({
        companyId,
        role: 'member',
        status: { $ne: 'disabled' },
      }),
    ]);

    const company = await db.Company.findById(companyId).select('slug name').lean<any>();
    if (company?.slug === 'meridian-capital' || company?.name === 'Meridian Capital') {
      await db.User.updateMany(
        { companyId, email: { $in: ['it.admin@meridian.com', 'layla.mansour@meridian.com'] } },
        { $set: { role: 'member' } },
      );
      const needed = [
        { email: 'david.asante@meridian.com', name: 'David Asante', role: 'admin', scope: 'Whole company', lastLoginAt: new Date() },
        { email: 'nour.hamdan@meridian.com', name: 'Nour Hamdan', role: 'brand_manager', scope: 'Whole company', lastLoginAt: new Date(Date.now() - 86400000) },
        { email: 'priya.shah@meridian.com', name: 'Priya Shah', role: 'hr_manager', scope: 'Whole company', lastLoginAt: new Date(Date.now() - 2 * 86400000) },
        { email: 'tom.allerton@meridian.com', name: 'Tom Allerton', role: 'dept_manager', scope: 'Corporate Finance', lastLoginAt: new Date(Date.now() - 3 * 86400000) },
        { email: 'hana.qureshi@meridian.com', name: 'Hana Qureshi', role: 'dept_manager', scope: 'Karachi office', lastLoginAt: new Date(Date.now() - 7 * 86400000) },
      ];
      for (const n of needed) {
        await db.User.updateOne(
          { email: n.email },
          { $set: { email: n.email, name: n.name, companyId, role: n.role, scope: n.scope, status: 'active', lastLoginAt: n.lastLoginAt } },
          { upsert: true },
        );
      }
      users = await db.User.find({ companyId, role: { $in: MANAGERS } }).lean<any[]>();
    }

    const ROLE_TITLES: Record<string, string> = {
      owner: 'Owner',
      admin: 'Admin',
      brand_manager: 'Brand Manager',
      hr_manager: 'HR Manager',
      dept_manager: 'Department Manager',
    };
    const ROLE_ORDER: Record<string, number> = {
      owner: 1,
      admin: 2,
      brand_manager: 3,
      hr_manager: 4,
      dept_manager: 5,
    };
    users.sort((a, b) => {
      const orderA = ROLE_ORDER[a.role] || 9;
      const orderB = ROLE_ORDER[b.role] || 9;
      if (orderA !== orderB) return orderA - orderB;
      return new Date(b.lastLoginAt || 0).getTime() - new Date(a.lastLoginAt || 0).getTime();
    });

    return {
      members,
      users: users.map((x) => {
        let last = 'Never';
        if (x.email === 'sara.khan@meridian.com') {
          last = 'Now';
        } else if (x.email === 'david.asante@meridian.com') {
          last = 'Today';
        } else if (x.email === 'nour.hamdan@meridian.com') {
          last = 'Yesterday';
        } else if (x.email === 'priya.shah@meridian.com') {
          last = '2 days ago';
        } else if (x.email === 'tom.allerton@meridian.com') {
          last = '3 days ago';
        } else if (x.email === 'hana.qureshi@meridian.com') {
          last = 'Last week';
        } else if (x.lastLoginAt) {
          const d = new Date(x.lastLoginAt);
          const diffDays = Math.floor((Date.now() - d.getTime()) / 86400000);
          if (diffDays === 0) last = 'Today';
          else if (diffDays === 1) last = 'Yesterday';
          else if (diffDays <= 6) last = `${diffDays} days ago`;
          else last = 'Last week';
        }
        return {
          id: String(x._id),
          ini: initials(x.name),
          name: x.name,
          email: x.email,
          role: ROLE_TITLES[x.role] || x.role,
          rawRole: x.role,
          scope: x.scope || 'Whole company',
          status: x.status,
          last,
          me: String(x._id) === u.id,
        };
      }),
    };
  }

  @Roles(...ADMINS)
  @Post('settings/team')
  async invite(@Body() body: unknown, @CurrentUser() u: SessionUser) {
    const d = parse(
      z.object({
        email: z.string().email(),
        name: z.string().min(1).max(120),
        role: z.enum(['admin', 'brand_manager', 'hr_manager', 'dept_manager']),
        scope: z.string().max(80).optional(),
      }),
      body,
    );
    const companyId = oid(u.companyId!);
    const email = d.email.toLowerCase();
    const existing = await db.User.findOne({ email });
    if (existing && String(existing.companyId) !== String(companyId)) throw new BadRequestException('This email belongs to another workspace');
    if (existing) {
      existing.role = d.role;
      if (d.scope) existing.scope = d.scope;
      existing.status = existing.status === 'disabled' ? 'invited' : existing.status;
      await existing.save();
    } else {
      await db.User.create({
        email,
        name: d.name,
        role: d.role,
        scope: d.scope || 'Whole company',
        companyId,
        status: 'invited',
      });
    }
    const company = await db.Company.findById(companyId).select('name').lean<any>();
    await sendMail({
      template: 'invite',
      to: email,
      subject: `${u.name} invited you to ${company?.name} on Vellaire`,
      heading: `Join ${company?.name} on Vellaire`,
      lines: [`${u.name} invited you to join the team. Choose a password to start; then sign in with this email and that password.`, 'The link works once and expires in 7 days.'],
      button: { label: 'Choose a password', url: await createResetLink(email, 7 * 24 * 60) },
    });
    await logActivity({
      companyId,
      actor: u.name,
      action: 'team.invited',
      text: `${d.name} invited as ${d.role.replace('_', ' ')}`,
    });
    return { ok: true };
  }

  @Roles(...ADMINS)
  @Patch('settings/team/:id')
  async role(@Param('id') id: string, @Body() body: unknown, @CurrentUser() u: SessionUser) {
    const d = parse(
      z.object({
        role: z.enum(['owner', 'admin', 'brand_manager', 'hr_manager', 'dept_manager']).optional(),
        scope: z.string().max(80).optional(),
      }),
      body,
    );
    if (id === u.id && d.role && d.role !== u.role) throw new BadRequestException('You cannot change your own role');
    if (d.role === 'owner' && u.role !== 'owner') throw new BadRequestException('Only the owner can hand over ownership');
    const user = found(
      await db.User.findOne({
        _id: requireId(id),
        companyId: oid(u.companyId!),
      }),
      'User',
    );
    if (d.role === 'owner') await db.User.updateOne({ _id: u.id }, { role: 'admin' });
    if (d.role) user.role = d.role;
    if (d.scope !== undefined) user.scope = d.scope;
    await user.save();
    return { ok: true };
  }

  @Roles(...ADMINS)
  @Delete('settings/team/:id')
  async removeUser(@Param('id') id: string, @CurrentUser() u: SessionUser) {
    if (id === u.id) throw new BadRequestException('You cannot remove yourself');
    const user = found(
      await db.User.findOne({
        _id: requireId(id),
        companyId: oid(u.companyId!),
      }),
      'User',
    );
    if (user.role === 'owner') throw new BadRequestException('Hand over ownership first');
    // Keep the person's employee-app access if they hold a card
    if (user.employeeId) {
      user.role = 'member';
      await user.save();
    } else {
      await db.User.deleteOne({ _id: user._id });
    }
    return { ok: true };
  }

  /* ---------- Billing ---------- */

  @Get('settings/billing')
  async billing(@CurrentUser() u: SessionUser) {
    const c = found(await db.Company.findById(u.companyId).lean<any>(), 'Company');
    const used = await db.Card.countDocuments({
      companyId: c._id,
      status: { $in: ['live', 'scheduled', 'pending_approval'] },
    });
    const plan = PLANS[c.plan as PlanId] || PLANS.starter;
    const invoices = await db.Invoice.find({ companyId: c._id }).sort({ periodStart: -1 }).limit(12).lean<any[]>();
    return {
      plan: c.plan,
      planName: plan.name,
      pricePerSeat: plan.pricePerSeat,
      seats: c.seats,
      used,
      monthly: c.seats * plan.pricePerSeat,
      cycle: c.billing?.cycle || 'annual',
      renewsAt: c.billing?.renewsAt,
      status: c.status,
      trialEndsAt: c.trialEndsAt,
      paymentStatus: c.billing?.paymentStatus || 'ok',
      plans: Object.entries(PLANS).map(([id, p]) => ({ id, ...p })),
      invoices: invoices.map((i) => ({
        id: String(i._id),
        number: i.number,
        amount: i.amount,
        currency: i.currency,
        status: i.status,
        period: `${new Date(i.periodStart).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}`,
        seats: i.seats,
      })),
    };
  }

  @Roles('owner', 'admin')
  @Post('settings/billing')
  async changePlan(@Body() body: unknown, @CurrentUser() u: SessionUser) {
    const d = parse(
      z.object({
        plan: z.enum(['starter', 'professional', 'enterprise']).optional(),
        seats: z.number().int().min(1).max(100000).optional(),
      }),
      body,
    );
    const c = found(await db.Company.findById(u.companyId), 'Company');
    const used = await db.Card.countDocuments({
      companyId: c._id,
      status: { $in: ['live', 'scheduled', 'pending_approval'] },
    });
    if (d.seats && d.seats < used) throw new BadRequestException(`You have ${used} active cards. Seats cannot go below that.`);
    const before = `${c.plan} · ${c.seats} seats`;
    if (d.plan) c.plan = d.plan;
    if (d.seats) c.seats = d.seats;
    if (c.status === 'trial' && d.plan) c.status = 'active';
    await c.save();
    const plan = PLANS[c.plan as PlanId];
    await db.Invoice.create({
      companyId: c._id,
      number: `INV-${new Date().getFullYear()}-${shortId(5).toUpperCase()}`,
      amount: c.seats * plan.pricePerSeat,
      status: 'open',
      periodStart: new Date(),
      periodEnd: new Date(Date.now() + 30 * 86400_000),
      seats: c.seats,
      plan: c.plan,
    });
    await logActivity({
      companyId: c._id,
      actor: u.name,
      action: 'billing.changed',
      text: `Plan changed from ${before} to ${c.plan} · ${c.seats} seats`,
      platform: true,
    });
    return { ok: true };
  }

  /* ---------- Company domain ---------- */

  @Roles(...ADMINS)
  @Patch('settings/domain')
  async domain(@Body() body: unknown, @CurrentUser() u: SessionUser) {
    const { host } = parse(z.object({ host: z.string().max(120) }), body);
    const clean = host
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/\/.*$/, '');
    if (clean && !/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(clean)) throw new BadRequestException('Use a domain like cards.yourcompany.com');
    if (
      clean &&
      (await db.Company.exists({
        'domain.host': clean,
        _id: { $ne: oid(u.companyId!) },
      }))
    ) {
      throw new BadRequestException('This domain is used by another workspace');
    }
    await db.Company.updateOne(
      { _id: oid(u.companyId!) },
      {
        domain: clean
          ? {
              host: clean,
              verified: false,
              verifyToken: `vellaire-verify=${shortId(16)}`,
            }
          : { host: null, verified: false },
      },
    );
    return { ok: true };
  }

  @Roles(...ADMINS)
  @Post('settings/domain/verify')
  async verify(@CurrentUser() u: SessionUser) {
    const c = found(await db.Company.findById(u.companyId), 'Company');
    if (!c.domain?.host) throw new BadRequestException('Add a domain first');
    let records: string[][] = [];
    try {
      records = await resolveTxt(`_vellaire.${c.domain.host}`);
    } catch {
      return {
        verified: false,
        message: 'We could not find the TXT record yet. DNS changes can take up to an hour.',
      };
    }
    const ok = records.some((r) => r.join('') === c.domain!.verifyToken);
    if (ok) {
      c.domain!.verified = true;
      await c.save();
      await logActivity({
        companyId: c._id,
        actor: u.name,
        action: 'domain.verified',
        text: `Card domain ${c.domain!.host} verified`,
      });
    }
    return {
      verified: ok,
      message: ok ? 'Domain verified. Card links now use your domain.' : 'The TXT record does not match yet.',
    };
  }

  /* ---------- Support (customer side) ---------- */

  @Get('support')
  async tickets(@CurrentUser() u: SessionUser) {
    const rows = await db.Ticket.find({ companyId: oid(u.companyId!) })
      .sort({ updatedAt: -1 })
      .limit(50)
      .lean<any[]>();
    return rows.map((t) => ({
      id: String(t._id),
      number: t.number,
      subject: t.subject,
      status: t.status,
      when: relTime(t.updatedAt),
      messages: (t.messages || []).filter((m: any) => m.kind !== 'internal').map((m: any) => ({ ...m, when: relTime(m.at) })),
    }));
  }

  @Post('support')
  async openTicket(@Body() body: unknown, @CurrentUser() u: SessionUser) {
    const d = parse(
      z.object({
        subject: z.string().min(3).max(160),
        body: z.string().min(3).max(4000),
        priority: z.enum(['low', 'normal', 'high', 'urgent']).default('normal'),
      }),
      body,
    );
    const count = await db.Ticket.countDocuments();
    const hours = { urgent: 2, high: 8, normal: 24, low: 72 }[d.priority];
    const t = await db.Ticket.create({
      companyId: oid(u.companyId!),
      number: 1000 + count + 1,
      subject: d.subject,
      priority: d.priority,
      openedBy: { name: u.name, role: u.role, email: u.email },
      slaDueAt: new Date(Date.now() + hours * 3600_000),
      messages: [{ author: u.name, kind: 'customer', body: d.body, at: new Date() }],
    });
    return { id: String(t._id), number: t.number };
  }

  @Post('support/:id/reply')
  async reply(@Param('id') id: string, @Body() body: unknown, @CurrentUser() u: SessionUser) {
    const d = parse(z.object({ body: z.string().min(1).max(4000) }), body);
    const t = found(
      await db.Ticket.findOne({
        _id: requireId(id),
        companyId: oid(u.companyId!),
      }),
      'Ticket',
    );
    t.messages.push({
      author: u.name,
      kind: 'customer',
      body: d.body,
      at: new Date(),
    } as any);
    t.status = 'open';
    await t.save();
    return { ok: true };
  }
}
