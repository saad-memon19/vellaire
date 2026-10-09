import { BadRequestException, Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { z } from 'zod';
import { config, PLANS, PlanId } from '../../config';
import { AllowMember, CurrentUser, Platform, SessionUser } from '../../common/auth';
import { EMAIL_TEMPLATES, EmailCopy, EmailTemplate } from '../../common/mail';
import { getSetting, setSetting } from '../../common/platform';
import { daysAgo, found, logActivity, parse, requireId } from '../../common/util';
import { db } from '../../db/db';
import { oid } from '../../db/schemas';
import { dayLabel, share } from './shared';

const REGION_NAME: Record<string, string> = { me: 'Middle East', eu: 'Europe', us: 'Americas' };

const audienceBody = z.object({
  roles: z.enum(['admins', 'everyone']),
  region: z.enum(['all', 'me', 'eu', 'us']),
  plan: z.enum(['all', 'starter', 'professional', 'enterprise']),
});

/** Draft → scheduled → live → archived, worked out from the dates so nothing has to flip it. */
function effectiveStatus(a: any, now = new Date()) {
  if (a.status === 'draft' || a.status === 'archived') return a.status;
  if (a.endsAt && a.endsAt <= now) return 'archived';
  if (a.startsAt && a.startsAt > now) return 'scheduled';
  return 'live';
}

function audienceLabel(a: any) {
  const who = a.audience?.roles === 'everyone' ? 'Everyone' : 'Company admins';
  if (a.audience?.companyIds?.length) return `${who} of ${a.audience.companyIds.length} ${a.audience.companyIds.length === 1 ? 'company' : 'companies'}`;
  const parts = [who];
  if (a.audience?.region && a.audience.region !== 'all') parts.push(REGION_NAME[a.audience.region]!);
  if (a.audience?.plan && a.audience.plan !== 'all') parts.push(`${PLANS[a.audience.plan as PlanId]?.name} plan`);
  return parts.join(' · ');
}

@Platform()
@Controller('console')
export class ConsoleAnnouncementsController {
  @Get('announcements')
  async list() {
    const since = daysAgo(30);
    const [items, logs] = await Promise.all([
      db.Announcement.find().sort({ createdAt: -1 }).limit(30).lean<any[]>(),
      db.EmailLog.aggregate([{ $match: { ts: { $gte: since } } }, { $group: { _id: '$template', sent: { $sum: 1 }, delivered: { $sum: { $cond: ['$delivered', 1, 0] } } } }]),
    ]);
    const stats = new Map(logs.map((l) => [l._id as string, l]));
    const emails = await Promise.all(
      (Object.keys(EMAIL_TEMPLATES) as EmailTemplate[]).map(async (key) => {
        const s = stats.get(key);
        const copy = await getSetting<EmailCopy>(`email.${key}`, {});
        return {
          key,
          ...EMAIL_TEMPLATES[key],
          sent: s?.sent || 0,
          delivered: s && config.mail.resendKey ? share(s.delivered, s.sent) : null,
          copy,
          edited: !!(copy.heading || copy.note),
        };
      }),
    );
    return {
      // Without an email key, emails only print to the API log, so there is no delivery rate to show
      mailReady: !!config.mail.resendKey,
      announcements: items.map((a) => {
        const status = effectiveStatus(a);
        const when =
          status === 'scheduled'
            ? `Starts ${dayLabel(a.startsAt)}`
            : status === 'live'
              ? `Live since ${dayLabel(a.startsAt || a.createdAt)}`
              : status === 'archived'
                ? `Ended ${dayLabel(a.endsAt || a.updatedAt)}`
                : 'Draft';
        return { id: String(a._id), message: a.message, link: a.link || '', audience: a.audience, who: audienceLabel(a), when, status, startsAt: a.startsAt, endsAt: a.endsAt };
      }),
      emails,
    };
  }

  @Post('announcements')
  async create(@Body() body: unknown, @CurrentUser() u: SessionUser) {
    const d = parse(
      z.object({
        message: z.string().min(4).max(240),
        link: z.string().max(300).optional().or(z.literal('')),
        audience: audienceBody,
        publish: z.enum(['now', 'schedule', 'draft']),
        startsAt: z.string().datetime().optional(),
        endsAt: z.string().datetime().optional(),
      }),
      body,
    );
    if (d.publish === 'schedule' && !d.startsAt) throw new BadRequestException('Pick when it should start');
    const a = await db.Announcement.create({
      message: d.message,
      link: d.link || undefined,
      audience: d.audience,
      status: d.publish === 'draft' ? 'draft' : 'live',
      startsAt: d.publish === 'schedule' ? new Date(d.startsAt!) : d.publish === 'now' ? new Date() : undefined,
      endsAt: d.endsAt ? new Date(d.endsAt) : undefined,
      createdBy: u.name,
    });
    await logActivity({
      actor: u.name,
      action: 'announcement.created',
      text: `${d.publish === 'draft' ? 'Drafted' : d.publish === 'now' ? 'Published' : 'Scheduled'} announcement: ${a.message}`,
      platform: true,
    });
    return { id: String(a._id) };
  }

  @Patch('announcements/:id')
  async update(@Param('id') id: string, @Body() body: unknown, @CurrentUser() u: SessionUser) {
    const d = parse(
      z.object({
        message: z.string().min(4).max(240).optional(),
        link: z.string().max(300).optional(),
        audience: audienceBody.optional(),
        action: z.enum(['publish', 'archive', 'draft']).optional(),
      }),
      body,
    );
    const a = found(await db.Announcement.findById(requireId(id)), 'Announcement');
    if (d.message) a.message = d.message;
    if (d.link !== undefined) a.link = d.link || undefined;
    if (d.audience) a.set('audience', { ...d.audience, companyIds: a.audience?.companyIds || [] });
    if (d.action === 'publish') Object.assign(a, { status: 'live', startsAt: new Date(), endsAt: undefined });
    if (d.action === 'archive') Object.assign(a, { status: 'archived', endsAt: new Date() });
    if (d.action === 'draft') a.status = 'draft';
    await a.save();
    const verb = d.action ? ({ publish: 'Published', archive: 'Archived', draft: 'Moved to draft' } as const)[d.action] : 'Edited';
    await logActivity({ actor: u.name, action: 'announcement.updated', text: `${verb} announcement: ${a.message}`, platform: true });
    return { ok: true };
  }

  /** Adjust an email's heading or add a closing note; empty values restore the default. */
  @Patch('emails/:key')
  async email(@Param('key') key: string, @Body() body: unknown, @CurrentUser() u: SessionUser) {
    if (!(key in EMAIL_TEMPLATES)) throw new BadRequestException('Unknown email');
    const d = parse(z.object({ heading: z.string().max(120), note: z.string().max(400) }), body);
    await setSetting(`email.${key}`, { heading: d.heading.trim() || undefined, note: d.note.trim() || undefined });
    await logActivity({ actor: u.name, action: 'email.edited', text: `Edited the "${EMAIL_TEMPLATES[key as EmailTemplate].name}" email`, platform: true });
    return { ok: true };
  }
}

/** What a signed-in customer sees: the announcements meant for them, right now. */
@Controller('announcements')
export class AnnouncementsController {
  @AllowMember()
  @Get()
  async active(@CurrentUser() u: SessionUser) {
    const company = await db.Company.findById(oid(u.companyId!)).select('plan dataRegion').lean<any>();
    const now = new Date();
    const items = await db.Announcement.find({
      status: 'live',
      $and: [
        { $or: [{ startsAt: null }, { startsAt: { $lte: now } }] },
        { $or: [{ endsAt: null }, { endsAt: { $gt: now } }] },
        { $or: [{ 'audience.companyIds': { $size: 0 } }, { 'audience.companyIds': company?._id }] },
        { 'audience.region': { $in: ['all', company?.dataRegion] } },
        { 'audience.plan': { $in: ['all', company?.plan] } },
      ],
    })
      .sort({ startsAt: -1 })
      .limit(3)
      .lean<any[]>();
    return items.filter((a) => a.audience?.roles === 'everyone' || u.role !== 'member').map((a) => ({ id: String(a._id), message: a.message, link: a.link || null }));
  }
}
