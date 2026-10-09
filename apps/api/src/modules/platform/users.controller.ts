import { BadRequestException, Controller, Get, Param, Post, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { config } from '../../config';
import { CurrentUser, Platform, SessionUser } from '../../common/auth';
import { sendMail } from '../../common/mail';
import { daysAgo, escapeRegex, found, initials, logActivity, paging, relTime, requireId, toCsv } from '../../common/util';
import { db } from '../../db/db';

const ROLE: Record<string, string> = { owner: 'Company Owner', admin: 'Company Admin', brand_manager: 'Brand Manager', member: 'Card holder' };
const STATUS: Record<string, string> = { active: 'Active', invited: 'Invited', disabled: 'Suspended' };

/** Personal details stay masked in the console: s•••@meridian.com */
const mask = (email = '') => {
  const [name, domain] = email.split('@');
  return domain ? `${name![0]}•••@${domain}` : email;
};

@Platform()
@Controller('console/users')
export class ConsoleUsersController {
  private filter(q: any) {
    const f: any = { platformRole: { $ne: 'staff' } };
    if (q.company) f.companyId = requireId(q.company);
    if (q.role) f.role = q.role;
    if (q.status) f.status = q.status;
    if (q.q) {
      const rx = new RegExp(escapeRegex(q.q), 'i');
      f.$or = [{ name: rx }, { email: rx }];
    }
    return f;
  }

  @Get()
  async list(@Query() q: any) {
    const { limit, page, skip } = paging({ ...q, limit: q.limit || '20' });
    const base = { platformRole: { $ne: 'staff' } };
    const filter = this.filter(q);
    const [rows, total, everyone, admins, activeWeek, invited, staleInvites, companies] = await Promise.all([
      db.User.find(filter).sort({ lastLoginAt: -1, createdAt: -1 }).skip(skip).limit(limit).lean<any[]>(),
      db.User.countDocuments(filter),
      db.User.countDocuments(base),
      db.User.countDocuments({ ...base, role: { $ne: 'member' } }),
      db.User.countDocuments({ ...base, lastLoginAt: { $gte: daysAgo(7) } }),
      db.User.countDocuments({ ...base, status: 'invited' }),
      db.User.countDocuments({ ...base, status: 'invited', createdAt: { $lt: daysAgo(7) } }),
      db.Company.find().select('name settings.sso').sort({ name: 1 }).lean<any[]>(),
    ]);
    const cmap = new Map(companies.map((c) => [String(c._id), c]));
    const ssoCompanies = companies.filter((c) => c.settings?.sso?.provider).map((c) => c._id);
    const onSso = ssoCompanies.length ? await db.User.countDocuments({ ...base, companyId: { $in: ssoCompanies } }) : 0;
    const share = (n: number) => (everyone ? Math.round((n / everyone) * 100) : 0);

    return {
      kpis: [
        { label: 'People with access', value: everyone.toLocaleString(), note: `${admins.toLocaleString()} admins · ${(everyone - admins).toLocaleString()} card holders` },
        { label: 'Active this week', value: activeWeek.toLocaleString(), note: `${share(activeWeek)}% of all users`, tone: 'ok' },
        {
          label: 'Using SSO',
          value: `${share(onSso)}%`,
          note: ssoCompanies.length ? `${ssoCompanies.length} ${ssoCompanies.length === 1 ? 'company' : 'companies'} with single sign-on` : 'No company uses SSO yet',
        },
        { label: 'Pending invites', value: invited.toLocaleString(), note: `Older than 7 days: ${staleInvites}`, tone: staleInvites ? 'warn' : undefined },
      ],
      rows: rows.map((r) => {
        const company = cmap.get(String(r.companyId));
        return {
          id: String(r._id),
          ini: initials(r.name || r.email),
          name: r.name || r.email.split('@')[0],
          email: mask(r.email),
          company: company?.name || '—',
          role: ROLE[r.role] || r.role,
          signin: company?.settings?.sso?.provider ? `${company.settings.sso.provider} SSO` : 'Email link',
          last: r.lastLoginAt ? relTime(r.lastLoginAt) : '—',
          status: STATUS[r.status] || r.status,
          statusId: r.status,
        };
      }),
      total,
      page,
      limit,
      companies: companies.map((c) => ({ id: String(c._id), name: c.name })),
    };
  }

  @Get('export')
  async export(@Query() q: any, @Res() res: Response) {
    const [rows, companies] = await Promise.all([db.User.find(this.filter(q)).sort({ name: 1 }).lean<any[]>(), db.Company.find().select('name').lean<any[]>()]);
    const cmap = new Map(companies.map((c) => [String(c._id), c.name]));
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="users.csv"');
    // The export keeps emails masked too: it leaves the building
    res.send(
      toCsv(
        rows.map((r) => ({
          name: r.name,
          email: mask(r.email),
          company: cmap.get(String(r.companyId)) || '',
          role: ROLE[r.role],
          status: STATUS[r.status],
          last_active: r.lastLoginAt,
        })),
      ),
    );
  }

  @Post(':id/suspend')
  async suspend(@Param('id') id: string, @CurrentUser() u: SessionUser) {
    const user = found(await db.User.findOneAndUpdate({ _id: requireId(id), platformRole: { $ne: 'staff' } }, { status: 'disabled' }, { new: true }), 'User');
    await logActivity({ companyId: user.companyId, actor: u.name, action: 'user.suspended', text: `Suspended ${mask(user.email)}`, platform: true });
    return { ok: true };
  }

  @Post(':id/reactivate')
  async reactivate(@Param('id') id: string, @CurrentUser() u: SessionUser) {
    const user = found(await db.User.findById(requireId(id)), 'User');
    user.status = user.lastLoginAt ? 'active' : 'invited';
    await user.save();
    await logActivity({ companyId: user.companyId, actor: u.name, action: 'user.reactivated', text: `Reactivated ${mask(user.email)}`, platform: true });
    return { ok: true };
  }

  @Post(':id/resend-invite')
  async resend(@Param('id') id: string, @CurrentUser() u: SessionUser) {
    const user = found(await db.User.findById(requireId(id)).lean<any>(), 'User');
    if (user.status !== 'invited') throw new BadRequestException('This person has already joined');
    const company = await db.Company.findById(user.companyId).select('name').lean<any>();
    await sendMail({
      template: 'invite',
      to: user.email,
      subject: `Your invitation to ${company?.name} on Vellaire`,
      heading: `Join ${company?.name} on Vellaire`,
      lines: ['You were invited to Vellaire. Sign in with this email address to start.'],
      button: { label: 'Sign in', url: `${config.webUrl}/signin?email=${encodeURIComponent(user.email)}` },
    });
    await logActivity({ companyId: user.companyId, actor: u.name, action: 'user.invite_resent', text: `Resent invite to ${mask(user.email)}`, platform: true });
    return { ok: true };
  }
}
