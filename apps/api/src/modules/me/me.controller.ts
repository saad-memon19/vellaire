import { BadRequestException, Body, Controller, Get, NotFoundException, Param, Patch, Post, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { z } from 'zod';
import { AllowMember, CurrentUser, SessionUser } from '../../common/auth';
import { cardUrl, serializeCard } from '../../common/cards';
import { materialName } from '../../common/catalog';
import { mailReady } from '../../common/mail';
import { companyQrSvg } from '../../common/qr';
import { daysAgo, initials, logActivity, parse, pct, rangeDays, relTime, requireId } from '../../common/util';
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
      photoApproval: company.settings?.photoApproval !== false,
      showMobile: !card.hideMobile,
      defaultLang: card.defaultLang || 'en',
      languages: company.settings?.languages || ['en'],
    };
  }

  @Get('qr')
  async qr(@CurrentUser() u: SessionUser, @Res() res: Response) {
    const { card, company } = await this.mine(u);
    const svg = await companyQrSvg(company, `${cardUrl(company, card.slug)}?src=qr`);
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
        showMobile: z.boolean().optional(),
        defaultLang: z.string().min(2).max(5).optional(),
      }),
      body,
    );
    const { card, company } = await this.mine(u);
    if (d.showMobile !== undefined) card.hideMobile = !d.showMobile;
    if (d.defaultLang !== undefined) {
      const tr = (card.translations || {}) as Record<string, any>;
      if (d.defaultLang !== 'en' && !tr[d.defaultLang]?.name && !tr[d.defaultLang]?.bio) throw new BadRequestException('Your card has no text in that language yet');
      card.defaultLang = d.defaultLang;
    }
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

  /**
   * Notifications for the card holder, built from what really happened: leads, today's views, approvals,
   * HR updates, the card going live or off, and their NFC order. Unread = newer than notificationsReadAt.
   */
  @Get('notifications')
  async notifications(@CurrentUser() u: SessionUser) {
    const { card } = await this.mine(u);
    const user = await db.User.findById(u.id).select('notificationsReadAt notifyLeads').lean<any>();
    const since = daysAgo(60);
    const midnight = new Date();
    midnight.setHours(0, 0, 0, 0);
    const [leads, acts, viewsToday, lastView, devices] = await Promise.all([
      db.Lead.find({ cardId: card._id, createdAt: { $gte: since } }).sort({ createdAt: -1 }).limit(30).lean<any[]>(),
      db.Activity.find({ cardId: card._id, createdAt: { $gte: since }, action: { $in: ['card.published', 'card.approved', 'card.rejected', 'card.synced', 'card.updated', 'card.deactivated', 'nfc.status'] } })
        .sort({ createdAt: -1 })
        .limit(30)
        .lean<any[]>(),
      db.Event.countDocuments({ cardId: card._id, type: 'view', ts: { $gte: midnight } }),
      db.Event.findOne({ cardId: card._id, type: 'view', ts: { $gte: midnight } }).sort({ ts: -1 }).select('ts').lean<any>(),
      db.NfcDevice.find({ cardId: card._id }).select('orderId material').lean<any[]>(),
    ]);
    const orders = devices.length ? await db.NfcOrder.find({ _id: { $in: devices.map((d) => d.orderId).filter(Boolean) } }).select('history').lean<any[]>() : [];
    const material = materialName(devices[0]?.material);

    type N = { id: string; kind: 'lead' | 'ok' | 'warn'; icon: string; text: string; sub?: string; at: Date; href: string };
    const items: N[] = [];
    for (const l of leads)
      items.push({ id: `lead:${l._id}`, kind: 'lead', icon: 'lead', text: `${l.name} shared their details with you`, sub: channelName(l.via), at: l.createdAt, href: `/m/leads/${l._id}` });
    if (viewsToday && lastView) items.push({ id: `views:${midnight.toISOString()}`, kind: 'ok', icon: 'view', text: `Your card was viewed ${viewsToday} ${viewsToday === 1 ? 'time' : 'times'} today`, at: lastView.ts, href: '/m/insights' });
    for (const a of acts) {
      // The holder's own edits are not news to them
      if (a.actor === u.name && a.action !== 'card.synced') continue;
      const t = String(a.text || '');
      const text =
        a.action === 'card.published'
          ? 'Your card is live'
          : a.action === 'card.approved'
            ? /photo/i.test(t)
              ? 'Your new photo was approved'
              : /changes/i.test(t)
                ? 'Your changes were approved'
                : 'Your card was approved'
            : a.action === 'card.rejected'
              ? `Your card was sent back${t.includes(': ') ? `: ${t.split(': ').slice(1).join(': ')}` : ''}`
              : a.action === 'card.synced'
                ? `Your details were updated from HR (${t.replace(/^Updated from HR:\s*/, '')})`
                : a.action === 'card.deactivated'
                  ? 'Your card was switched off'
                  : a.action === 'nfc.status'
                    ? t.replace(/^.*?NFC card/, 'Your NFC card')
                    : `${a.actor || 'Your company'} updated your card`;
      items.push({ id: `act:${a._id}`, kind: a.action === 'card.rejected' || a.action === 'card.deactivated' ? 'warn' : 'ok', icon: a.action.startsWith('nfc') ? 'nfc' : /photo/i.test(t) ? 'photo' : 'ok', text, at: a.createdAt, href: a.action.startsWith('nfc') ? '/m/nfc' : '/m' });
    }
    for (const o of orders)
      for (const h of o.history || [])
        if (['shipped', 'delivered'].includes(h.stage) && new Date(h.at) >= since)
          items.push({ id: `nfc:${o._id}:${h.stage}`, kind: 'warn', icon: 'nfc', text: h.stage === 'delivered' ? `Your ${material} card has arrived. Activate it.` : `Your ${material} card is on its way`, at: h.at, href: '/m/nfc' });

    const read = user?.notificationsReadAt ? new Date(user.notificationsReadAt) : new Date(0);
    items.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
    const list = items.slice(0, 40).map((n) => ({ ...n, unread: new Date(n.at) > read }));
    return { items: list, unread: list.filter((n) => n.unread).length, notifyLeads: user?.notifyLeads !== false };
  }

  @Post('notifications/read')
  async readNotifications(@CurrentUser() u: SessionUser) {
    await db.User.updateOne({ _id: requireId(u.id) }, { notificationsReadAt: new Date() });
    return { ok: true };
  }

  /** The Notifications switch in Settings: whether new leads are also emailed (when email is set up). */
  @Patch('preferences')
  async preferences(@Body() body: unknown, @CurrentUser() u: SessionUser) {
    const d = parse(z.object({ notifyLeads: z.boolean() }), body);
    await db.User.updateOne({ _id: requireId(u.id) }, d);
    return { ok: true };
  }

  /** Activate your card: the holder's NFC cards, where each one is in delivery, and whether it has been tapped. */
  @Get('nfc')
  async nfcCards(@CurrentUser() u: SessionUser) {
    const { card } = await this.mine(u);
    const devices = await db.NfcDevice.find({ cardId: card._id }).sort({ createdAt: -1 }).lean<any[]>();
    const orders = await db.NfcOrder.find({ _id: { $in: devices.map((d) => d.orderId).filter(Boolean) } })
      .select('stage history')
      .lean<any[]>();
    const order = new Map(orders.map((o) => [String(o._id), o]));
    return devices.map((d) => {
      const o = d.orderId ? order.get(String(d.orderId)) : null;
      const delivered = o?.history?.find((h: any) => h.stage === 'delivered');
      return {
        id: String(d._id),
        uid: d.uid,
        name: `${materialName(d.material)} card`,
        material: d.material,
        status: d.status,
        office: d.office || null,
        stage: o?.stage || 'delivered',
        deliveredAt: delivered?.at || null,
        activatedAt: d.activatedAt || null,
        lastTapAt: d.lastTapAt || null,
      };
    });
  }

  /** The holder's phone read the chip (Web NFC): it must carry one of their own chip links. */
  @Post('nfc/activate')
  async activateNfc(@Body() body: unknown, @CurrentUser() u: SessionUser) {
    const { uid } = parse(z.object({ uid: z.string().min(4).max(64) }), body);
    const { card } = await this.mine(u);
    const d = await db.NfcDevice.findOne({ uid, cardId: card._id });
    if (!d) throw new BadRequestException('This chip is not one of your Vellaire cards');
    if (d.status === 'lost') throw new BadRequestException('This card was reported lost. Ask your admin to switch it back on.');
    if (!d.activatedAt) d.activatedAt = new Date();
    await d.save();
    await logActivity({ companyId: card.companyId, cardId: card._id, actor: u.name, action: 'nfc.activated', text: `${u.name} activated their ${materialName(d.material)} card` });
    return { ok: true, name: `${materialName(d.material)} card` };
  }

  /** "Report lost card": the holder switches their own NFC card off at once; an admin can switch it back on. */
  @Post('nfc/:id/lost')
  async lostCard(@Param('id') id: string, @CurrentUser() u: SessionUser) {
    const { card } = await this.mine(u);
    const d = await db.NfcDevice.findOneAndUpdate({ _id: requireId(id), cardId: card._id }, { status: 'lost' }, { new: true });
    if (!d) throw new NotFoundException('NFC card not found');
    await logActivity({ companyId: card.companyId, cardId: card._id, actor: u.name, action: 'nfc.status', text: `${u.name} reported their NFC card lost; it is switched off` });
    return { ok: true };
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
      draft: draft ? { id: String(draft._id), name: draft.name.split(' ')[0], text: draft.draft, email: draft.consent ? draft.email : '', mailReady: mailReady() } : null,
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
