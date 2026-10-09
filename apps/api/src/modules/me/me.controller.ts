import { BadRequestException, Body, Controller, Get, NotFoundException, Patch, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import QRCode from 'qrcode';
import { z } from 'zod';
import { AllowMember, CurrentUser, SessionUser } from '../../common/auth';
import { cardUrl, serializeCard } from '../../common/cards';
import { materialName } from '../../common/catalog';
import { daysAgo, initials, logActivity, parse, pct, rangeDays, relTime } from '../../common/util';
import { db } from '../../db/db';
import { analyticsFor, fmtDelta } from '../analytics/analytics.controller';
import { channelName } from '../cards/cards.controller';
import { appleReady, googleReady } from '../public/wallet';
import { signatureHtml } from '../cards/signature';

/** The employee app: one person, their own card. */
@AllowMember()
@Controller('me')
export class MeController {
  private async mine(u: SessionUser) {
    if (!u.employeeId) throw new NotFoundException('No card is linked to your account yet');
    const employee = await db.Employee.findById(u.employeeId).lean<any>();
    if (!employee?.cardId) throw new NotFoundException('Your company has not created your card yet');
    const card = await db.Card.findById(employee.cardId);
    if (!card) throw new NotFoundException('Card not found');
    const company = await db.Company.findById(card.companyId).lean<any>();
    return { employee, card, company };
  }

  @Get('card')
  async card(@CurrentUser() u: SessionUser) {
    const { employee, card, company } = await this.mine(u);
    const week = daysAgo(7);
    const [views, saves, newLeads, followUp, devices] = await Promise.all([
      db.Event.countDocuments({ cardId: card._id, type: 'view', ts: { $gte: week } }),
      db.Event.countDocuments({ cardId: card._id, type: 'save', ts: { $gte: week } }),
      db.Lead.countDocuments({ cardId: card._id, createdAt: { $gte: week } }),
      db.Lead.findOne({ cardId: card._id, status: 'new' }).sort({ createdAt: -1 }).lean<any>(),
      db.NfcDevice.find({ cardId: card._id }).lean<any[]>(),
    ]);
    const h = new Date().getHours();
    return {
      greeting: h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening',
      firstName: employee.name.split(' ')[0],
      initials: initials(employee.name),
      card: serializeCard(card.toObject(), company, employee),
      syncedNote: employee.source !== 'manual' ? `updated from HR ${relTime(employee.updatedAt)}` : `updated ${relTime(card.updatedAt)}`,
      week: { views, saves, leads: newLeads },
      followUp: followUp ? { id: String(followUp._id), name: followUp.name.split(' ')[0], hasDraft: !!followUp.draft } : null,
      devices: devices.map((d) => ({ id: String(d._id), name: `${materialName(d.material)} card`, material: d.material, status: d.status, lastTap: d.lastTapAt ? relTime(d.lastTapAt) : null })),
      wallet: { apple: appleReady(), google: googleReady() },
      permissions: company.brand?.permissions || {},
      pendingPhoto: !!card.approval?.pendingPhoto,
    };
  }

  @Get('qr')
  async qr(@CurrentUser() u: SessionUser, @Res() res: Response) {
    const { card, company } = await this.mine(u);
    const svg = await QRCode.toString(`${cardUrl(company, card.slug)}?src=qr`, { type: 'svg', margin: 1, errorCorrectionLevel: 'H', color: { dark: '#17171B', light: '#FFFFFF' } });
    res.setHeader('Content-Type', 'image/svg+xml');
    res.send(svg);
  }

  @Get('signature')
  async signature(@CurrentUser() u: SessionUser) {
    const { card, company } = await this.mine(u);
    return { html: signatureHtml(card.toObject(), company) };
  }

  /** What an employee may change is set by the company's brand kit. */
  @Patch('card')
  async update(@Body() body: unknown, @CurrentUser() u: SessionUser) {
    const d = parse(
      z.object({
        bio: z.string().max(600).optional(),
        photoUrl: z.string().max(400).optional(),
        mobile: z.string().max(40).optional(),
        whatsapp: z.string().max(40).optional(),
        pronouns: z.string().max(30).optional(),
        links: z.array(z.object({ type: z.string(), label: z.string().max(80), url: z.string().max(500), sub: z.string().max(120).optional() })).max(12).optional(),
        translations: z.record(z.object({ name: z.string(), title: z.string(), bio: z.string() }).partial()).optional(),
        theme: z.string().optional(),
      }),
      body,
    );
    const { card, company } = await this.mine(u);
    const p = company.brand?.permissions || {};
    const deny = (what: string) => {
      throw new BadRequestException(`Your company manages ${what} centrally`);
    };
    const fields: any = { ...(card.toObject().fields || {}) };
    if (d.bio !== undefined) (p.bio === false ? deny('the bio') : (fields.bio = d.bio));
    if (d.mobile !== undefined) fields.mobile = d.mobile;
    if (d.whatsapp !== undefined) fields.whatsapp = d.whatsapp;
    if (d.pronouns !== undefined) fields.pronouns = d.pronouns;
    if (d.links) (p.links === false ? deny('links') : (card.links = d.links as any));
    if (d.translations) {
      if (p.languages === false) deny('languages');
      card.translations = d.translations;
      card.markModified('translations');
    }
    if (d.theme) (p.theme === false ? deny('the colour theme') : (card.theme = d.theme));
    let message = 'Saved';
    if (d.photoUrl !== undefined) {
      if (p.photo === false) deny('photos');
      if (company.settings?.photoApproval !== false) {
        card.approval = { ...(card.toObject().approval || {}), pendingPhoto: d.photoUrl, requestedBy: u.name, requestedAt: new Date(), reason: 'New profile photo' } as any;
        message = 'Saved. Your new photo will appear after your Brand Manager approves it.';
        await logActivity({ companyId: company._id, cardId: card._id, actor: u.name, action: 'card.approval_requested', text: `${u.name} asked to change their photo` });
      } else {
        fields.photoUrl = d.photoUrl;
      }
    }
    card.fields = fields;
    await card.save();
    await logActivity({ companyId: company._id, cardId: card._id, actor: u.name, action: 'card.self_edit', text: `${u.name} updated their card` });
    return { ok: true, message };
  }

  @Get('leads')
  async leads(@CurrentUser() u: SessionUser, @Query('tab') tab: string) {
    const { card } = await this.mine(u);
    const q: any = { cardId: card._id };
    if (tab === 'follow-up') q.status = 'new';
    const [rows, toFollow, all, draft] = await Promise.all([
      db.Lead.find(q).sort({ createdAt: -1 }).limit(100).lean<any[]>(),
      db.Lead.countDocuments({ cardId: card._id, status: 'new' }),
      db.Lead.countDocuments({ cardId: card._id }),
      db.Lead.findOne({ cardId: card._id, status: 'new', draft: { $nin: [null, ''] } }).sort({ createdAt: -1 }).lean<any>(),
    ]);
    return {
      tabs: { followUp: toFollow, all },
      rows: rows.map((l) => ({ id: String(l._id), ini: initials(l.name), name: l.name, co: [l.jobTitle, l.company].filter(Boolean).join(' · '), via: channelName(l.via), when: relTime(l.createdAt), status: l.status })),
      draft: draft ? { id: String(draft._id), name: draft.name.split(' ')[0], text: draft.draft } : null,
    };
  }

  @Get('insights')
  async insights(@CurrentUser() u: SessionUser, @Query('range') range: string) {
    const { card } = await this.mine(u);
    const days = rangeDays(range);
    const a = await analyticsFor({ cardId: card._id }, days);
    const nfc = a.channels.find((c) => c.id === 'nfc');
    // Phone layout: views headline + a 2×2 grid of what people did next
    const kpis = [
      a.kpis[0]!,
      { ...a.kpis[1]!, label: 'Saved your contact' },
      a.kpis[2]!,
      { label: 'NFC taps', value: (nfc?.n || 0).toLocaleString(), delta: `${nfc?.pct || 0}% of views` },
      { label: 'Link clicks', value: (a.cur.click || 0).toLocaleString(), delta: fmtDelta(pct(a.cur.click || 0, a.prev.click || 0)) },
    ];
    return { days, kpis, daily: a.daily, channels: a.channels, cities: a.cities };
  }
}
