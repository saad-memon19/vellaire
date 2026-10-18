import { BadRequestException, Body, Controller, Get, Param, Patch, Post, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { z } from 'zod';
import { AllowMember, CurrentUser, SessionUser } from '../../common/auth';
import { mailReady, sendMail } from '../../common/mail';
import { escapeRegex, found, initials, logActivity, paging, parse, relTime, requireId, toCsv } from '../../common/util';
import { db } from '../../db/db';
import { oid } from '../../db/schemas';
import { AiService } from '../ai/ai.service';
import { channelName } from '../cards/cards.controller';
import { pushToCrm } from './crm';

/** Without AI: a short, personal template filled from the lead. */
export function templateFollowUp(lead: any, sender: { name: string; company: string }) {
  const first = String(lead.name || '').split(' ')[0];
  const ref = lead.note ? ` You mentioned ${lead.note.replace(/\.$/, '').toLowerCase()}.` : '';
  return `Dear ${first},\n\nIt was a pleasure meeting you.${ref} I would be glad to continue the conversation — would a short call next week suit you?\n\nWarm regards,\n${sender.name.split(' ')[0]}\n${sender.company}`;
}

@AllowMember()
@Controller('leads')
export class LeadsController {
  constructor(private ai: AiService) {}

  /** Members only see their own leads; admins see the company's. */
  private scope(u: SessionUser) {
    const q: any = { companyId: oid(u.companyId!) };
    if (u.role === 'member') q.employeeId = u.employeeId ? oid(u.employeeId) : null;
    return q;
  }

  private async own(u: SessionUser, id: string) {
    return found(await db.Lead.findOne({ ...this.scope(u), _id: requireId(id) }), 'Lead');
  }

  @Get()
  async list(@Query() q: any, @CurrentUser() u: SessionUser) {
    const base = this.scope(u);
    const { limit, page, skip } = paging({ ...q, limit: q.limit || '20' });
    const filter: any = { ...base };
    if (q.tab === 'follow-up') filter.status = 'new';
    if (q.tab === 'crm') filter.status = 'in_crm';
    if (q.tab === 'paper') filter.via = 'paper';
    if (q.q) {
      const rx = new RegExp(escapeRegex(q.q), 'i');
      filter.$or = [{ name: rx }, { company: rx }, { email: rx }, { ownerName: rx }];
    }
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const [rows, total, all, followUp, inCrm, paper, month] = await Promise.all([
      db.Lead.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean<any[]>(),
      db.Lead.countDocuments(filter),
      db.Lead.countDocuments(base),
      db.Lead.countDocuments({ ...base, status: 'new' }),
      db.Lead.countDocuments({ ...base, status: 'in_crm' }),
      db.Lead.countDocuments({ ...base, via: 'paper' }),
      db.Lead.countDocuments({ ...base, createdAt: { $gte: monthStart } }),
    ]);
    const company = await db.Company.findById(base.companyId).select('settings.crm').lean<any>();
    return {
      total,
      page,
      limit,
      month,
      crm: company?.settings?.crm?.provider || null,
      tabs: [
        { id: 'all', name: 'All', count: all },
        { id: 'follow-up', name: 'Needs follow-up', count: followUp },
        { id: 'crm', name: 'In CRM', count: inCrm },
        { id: 'paper', name: 'Scanned paper cards', count: paper },
      ],
      rows: rows.map((l) => ({
        id: String(l._id),
        ini: initials(l.name),
        name: l.name,
        co: [l.jobTitle, l.company].filter(Boolean).join(' · '),
        owner: l.ownerName,
        via: channelName(l.via),
        when: relTime(l.createdAt),
        status: l.status,
        crm: l.status === 'in_crm' ? l.crm?.provider || 'CRM' : l.status === 'followed_up' ? 'Followed up' : 'New',
      })),
      aiEnabled: this.ai.enabled,
    };
  }

  @Get('export')
  async export(@CurrentUser() u: SessionUser, @Res() res: Response) {
    const rows = await db.Lead.find(this.scope(u)).sort({ createdAt: -1 }).lean<any[]>();
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="leads.csv"');
    res.send(
      toCsv(
        rows.map((l) => ({
          name: l.name,
          company: l.company,
          job_title: l.jobTitle,
          email: l.email,
          phone: l.phone,
          note: l.note,
          met_by: l.ownerName,
          via: channelName(l.via),
          consent: l.consent ? 'yes' : 'no',
          status: l.status,
          created_at: l.createdAt,
        })),
      ),
    );
  }

  @Get(':id')
  async get(@Param('id') id: string, @CurrentUser() u: SessionUser) {
    const l = (await this.own(u, id)).toObject();
    return {
      id: String(l._id),
      ini: initials(l.name),
      name: l.name,
      company: l.company,
      jobTitle: l.jobTitle,
      email: l.email,
      phone: l.phone,
      note: l.note,
      consent: l.consent,
      status: l.status,
      crm: l.crm,
      draft: l.draft || '',
      myNote: l.myNote || '',
      // Without an email service the app opens the phone's mail app instead of sending from Vellaire
      mailReady: mailReady(),
      via: channelName(l.via),
      paper: l.via === 'paper',
      createdAt: l.createdAt,
      met: `${l.ownerName || 'Unknown'} · ${channelName(l.via)} · ${new Date(l.createdAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`,
      ownerName: l.ownerName,
    };
  }

  /** Paper card scanned in the app, or a lead added by hand. */
  @Post()
  async create(@Body() body: unknown, @CurrentUser() u: SessionUser) {
    const data = parse(
      z.object({
        name: z.string().min(1).max(120),
        company: z.string().max(120).optional(),
        jobTitle: z.string().max(120).optional(),
        email: z.string().max(160).optional(),
        phone: z.string().max(40).optional(),
        note: z.string().max(1000).optional(),
        via: z.enum(['paper', 'link']).default('paper'),
      }),
      body,
    );
    const companyId = oid(u.companyId!);
    const employee = u.employeeId ? await db.Employee.findById(u.employeeId).lean<any>() : null;
    const lead = await db.Lead.create({
      ...data,
      companyId,
      employeeId: employee?._id,
      cardId: employee?.cardId,
      ownerName: employee?.name || u.name,
      consent: true,
    });
    return { id: String(lead._id) };
  }

  @Post('scan')
  async scan(@Body() body: unknown) {
    const { image, mediaType } = parse(
      z.object({
        image: z.string().min(100).max(8_000_000),
        mediaType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
      }),
      body,
    );
    if (!this.ai.enabled) throw new BadRequestException('Card scanning needs AI. Enter the details by hand instead.');
    return this.ai.scanCard({
      base64: image.replace(/^data:[^,]+,/, ''),
      mediaType,
    });
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: unknown, @CurrentUser() u: SessionUser) {
    const data = parse(
      z.object({
        status: z.enum(['new', 'followed_up', 'in_crm']).optional(),
        draft: z.string().max(4000).optional(),
        note: z.string().max(1000).optional(),
        myNote: z.string().max(2000).optional(),
      }),
      body,
    );
    const lead = await this.own(u, id);
    Object.assign(lead, data);
    await lead.save();
    return { ok: true };
  }

  @Post(':id/draft')
  async draft(@Param('id') id: string, @Body() body: unknown, @CurrentUser() u: SessionUser) {
    const { tone } = parse(z.object({ tone: z.string().max(40).optional() }), body || {});
    const lead = await this.own(u, id);
    const company = await db.Company.findById(lead.companyId).select('name').lean<any>();
    const owner = lead.employeeId ? await db.Employee.findById(lead.employeeId).lean<any>() : null;
    const sender = {
      name: owner?.name || lead.ownerName || u.name,
      title: owner?.title,
      company: company?.name || '',
    };
    let text: string;
    let usedAi = false;
    if (this.ai.enabled) {
      text = await this.ai.followUp({
        leadName: lead.name,
        leadCompany: lead.company,
        note: lead.note,
        senderName: sender.name,
        senderTitle: sender.title,
        company: sender.company,
        tone,
      });
      usedAi = true;
    } else {
      text = templateFollowUp(lead, sender);
    }
    lead.draft = text;
    await lead.save();
    return { draft: text, usedAi };
  }

  /** Sends the follow-up email from Vellaire on behalf of the card holder (reply-to goes to them). */
  @Post(':id/send')
  async send(@Param('id') id: string, @Body() body: unknown, @CurrentUser() u: SessionUser) {
    const { text } = parse(z.object({ text: z.string().min(10).max(4000) }), body);
    if (!mailReady()) throw new BadRequestException('Email is not set up yet. Send it from your own mail app.');
    const lead = await this.own(u, id);
    if (!lead.email) throw new BadRequestException('This lead has no email address');
    if (!lead.consent) throw new BadRequestException('This person did not agree to be contacted');
    const company = await db.Company.findById(lead.companyId).select('name').lean<any>();
    const paras = text.split(/\n{2,}/);
    await sendMail({
      template: 'follow_up',
      to: lead.email,
      subject: `Following up · ${company?.name}`,
      heading: paras[0]?.replace(/,$/, '') || 'Hello',
      lines: paras.slice(1),
    });
    lead.status = lead.status === 'in_crm' ? 'in_crm' : 'followed_up';
    lead.draft = text;
    await lead.save();
    await logActivity({
      companyId: lead.companyId,
      cardId: lead.cardId,
      actor: u.name,
      action: 'lead.followed_up',
      text: `Follow-up sent to ${lead.name}`,
    });
    return { ok: true };
  }

  @Post(':id/crm')
  async crm(@Param('id') id: string, @CurrentUser() u: SessionUser) {
    const lead = await this.own(u, id);
    const company = await db.Company.findById(lead.companyId).lean<any>();
    const result = await pushToCrm(company, lead.toObject());
    lead.status = 'in_crm';
    lead.crm = {
      provider: result.provider,
      id: result.id,
      pushedAt: new Date(),
    } as any;
    await lead.save();
    return { ok: true, provider: result.provider };
  }
}
