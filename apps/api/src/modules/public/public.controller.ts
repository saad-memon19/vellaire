import { BadRequestException, Body, Controller, Get, HttpException, NotFoundException, Param, Post, Query, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import QRCode from 'qrcode';
import { z } from 'zod';
import { config } from '../../config';
import { Public } from '../../common/auth';
import { brandOf, cardUrl, displayUrl } from '../../common/cards';
import { sendMail } from '../../common/mail';
import { savedQrStyle } from '../../common/qr';
import { parse } from '../../common/util';
import { db } from '../../db/db';
import { isOid } from '../../db/schemas';
import { flagsFor } from '../../common/platform';
import { applePass, appleReady, googleReady, googleSaveUrl } from './wallet';

const CHANNELS = ['nfc', 'qr', 'link', 'wallet', 'email', 'signature'];
const channelOf = (s?: string) => (s && CHANNELS.includes(s) ? s : 'link');

// Small in-memory limiter for public writes (per IP, per minute)
const hits = new Map<string, { n: number; at: number }>();
function limit(req: Request, max: number) {
  const ip = String(req.headers['x-forwarded-for'] || req.ip || '')
    .split(',')[0]!
    .trim();
  const now = Date.now();
  const h = hits.get(ip);
  if (!h || now - h.at > 60_000) hits.set(ip, { n: 1, at: now });
  else if (++h.n > max) throw new HttpException('Too many requests. Please wait a minute.', 429);
}

function geo(req: Request) {
  const city = (req.headers['x-vercel-ip-city'] as string) || (req.headers['cf-ipcity'] as string) || undefined;
  const country = (req.headers['x-vercel-ip-country'] as string) || (req.headers['cf-ipcountry'] as string) || undefined;
  const ua = String(req.headers['user-agent'] || '');
  const device = /iphone|ipad/i.test(ua) ? 'iOS' : /android/i.test(ua) ? 'Android' : /mobile/i.test(ua) ? 'Mobile' : 'Desktop';
  return { city: city ? decodeURIComponent(city) : undefined, country, device };
}

function vcard(card: any, company: any) {
  // The holder can hide their mobile number from everything public
  const f = card.hideMobile ? { ...card.fields, mobile: undefined } : card.fields || {};
  const esc = (s = '') =>
    String(s)
      .replace(/([,;\\])/g, '\\$1')
      .replace(/\n/g, '\\n');
  const [first, ...rest] = String(f.name || '').split(' ');
  const lines = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `N:${esc(rest.join(' '))};${esc(first)};;;`,
    `FN:${esc(f.name)}`,
    `ORG:${esc(company.name)}`,
    f.title && `TITLE:${esc(f.title)}`,
    f.email && `EMAIL;TYPE=WORK:${esc(f.email)}`,
    f.phone && `TEL;TYPE=WORK,VOICE:${esc(f.phone)}`,
    f.mobile && `TEL;TYPE=CELL:${esc(f.mobile)}`,
    f.address && `ADR;TYPE=WORK:;;${esc(f.address)};;;;`,
    `URL:${cardUrl(company, card.slug)}`,
    f.bio && `NOTE:${esc(f.bio)}`,
    'END:VCARD',
  ];
  return lines.filter(Boolean).join('\r\n');
}

@Public()
@Controller('public')
export class PublicController {
  private async shape(card: any, company: any) {
    const flags = await flagsFor(company);
    const teamPage = Boolean(company?.settings?.teamPage && flags.includes('public.team_page'));
    const website = company?.brand?.website || (company?.domain?.verified && company.domain.host ? `https://${company.domain.host}` : undefined) || null;
    const logo = company?.brand?.logos?.icon || company?.brand?.logos?.light || null;

    if (card.status === 'deactivated') {
      return {
        status: 'deactivated',
        companyName: company.name,
        companySlug: company.slug,
        // "Send visitors to" from Company settings, else the company website
        website: company?.settings?.leaverUrl || website,
        logo,
        teamPage,
        brand: brandOf(company),
      };
    }
    const url = cardUrl(company, card.slug);
    return {
      status: card.status,
      id: String(card._id),
      slug: card.slug,
      layout: card.layout,
      theme: card.theme,
      cover: card.cover,
      fields: card.hideMobile ? { ...card.fields, mobile: undefined } : card.fields || {},
      translations: card.translations || {},
      links: card.links || [],
      url,
      displayUrl: displayUrl(url),
      companyName: company.name,
      companySlug: company.slug,
      website,
      logo,
      teamPage,
      brand: brandOf(company),
      wallet: { apple: appleReady(), google: googleReady() },
    };
  }

  private async bySlug(companySlug: string, slug: string) {
    const company = await db.Company.findOne({ slug: companySlug }).lean<any>();
    if (!company || ['suspended', 'churned'].includes(company.status)) throw new NotFoundException('Card not found');
    const card = await db.Card.findOne({
      companyId: company._id,
      slug,
    }).lean<any>();
    if (!card || !['live', 'deactivated'].includes(card.status)) throw new NotFoundException('Card not found');
    return { card, company };
  }

  private async byId(id: string) {
    if (!isOid(id)) throw new NotFoundException();
    const card = await db.Card.findOne({ _id: id, status: 'live' }).lean<any>();
    if (!card) throw new NotFoundException('Card not found');
    const company = await db.Company.findById(card.companyId).lean<any>();
    return { card, company };
  }

  @Get('card/:company/:slug')
  async get(@Param('company') c: string, @Param('slug') s: string) {
    const { card, company } = await this.bySlug(c, s);
    return this.shape(card, company);
  }

  /** Custom domains: cards.meridian.com/sara-khan */
  @Get('host/:host/:slug')
  async byHost(@Param('host') host: string, @Param('slug') slug: string) {
    const company = await db.Company.findOne({
      'domain.host': host.toLowerCase(),
      'domain.verified': true,
    }).lean<any>();
    if (!company) throw new NotFoundException();
    return this.get(company.slug, slug);
  }

  @Post('track')
  async track(@Body() body: unknown, @Req() req: Request) {
    limit(req, 120);
    const d = parse(
      z.object({
        cardId: z.string(),
        type: z.enum(['view', 'save', 'click', 'wallet_add']),
        channel: z.string().optional(),
      }),
      body,
    );
    if (!isOid(d.cardId)) return { ok: false };
    const card = await db.Card.findOne({ _id: d.cardId, status: 'live' }).select('companyId').lean<any>();
    if (!card) return { ok: false };
    await db.Event.create({
      companyId: card.companyId,
      cardId: card._id,
      type: d.type,
      channel: channelOf(d.channel),
      ...geo(req),
    });
    if (d.type === 'view') await db.Card.updateOne({ _id: card._id }, { lastViewedAt: new Date() });
    return { ok: true };
  }

  @Get('cards/:id/vcf')
  async vcf(@Param('id') id: string, @Query('src') src: string, @Req() req: Request, @Res() res: Response) {
    const { card, company } = await this.byId(id);
    await db.Event.create({
      companyId: card.companyId,
      cardId: card._id,
      type: 'save',
      channel: channelOf(src),
      ...geo(req),
    });
    res.setHeader('Content-Type', 'text/vcard; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${card.slug}.vcf"`);
    res.send(vcard(card, company));
  }

  @Post('cards/:id/lead')
  async lead(@Param('id') id: string, @Body() body: unknown, @Req() req: Request) {
    limit(req, 5);
    const d = parse(
      z.object({
        name: z.string().min(2).max(120),
        email: z.string().email().or(z.literal('')).optional(),
        phone: z.string().max(40).optional(),
        company: z.string().max(120).optional(),
        jobTitle: z.string().max(120).optional(),
        note: z.string().max(1000).optional(),
        consent: z.literal(true, {
          errorMap: () => ({ message: 'Please agree to be contacted' }),
        }),
        channel: z.string().optional(),
        website: z.string().max(0).optional(), // hidden field: bots fill it
      }),
      body,
    );
    if (!d.email && !d.phone) throw new BadRequestException('Add an email or a phone number');
    const { card, company } = await this.byId(id);
    const employee = card.employeeId ? await db.Employee.findById(card.employeeId).lean<any>() : null;
    const channel = channelOf(d.channel);
    await db.Lead.create({
      companyId: company._id,
      cardId: card._id,
      employeeId: card.employeeId,
      ownerName: card.fields?.name,
      name: d.name,
      email: d.email,
      phone: d.phone,
      company: d.company,
      jobTitle: d.jobTitle,
      note: d.note,
      consent: true,
      via: channel,
    });
    await db.Event.create({
      companyId: company._id,
      cardId: card._id,
      type: 'lead',
      channel,
      ...geo(req),
    });
    const to = employee?.email || card.fields?.email;
    if (to) {
      await sendMail({
        template: 'new_lead',
        to,
        subject: `${d.name} shared their details with you`,
        heading: `New lead: ${d.name}`,
        lines: [
          [d.jobTitle, d.company].filter(Boolean).join(' · ') || 'From your Vellaire card',
          d.note ? `Their note: “${d.note}”` : 'Open the app to follow up while the meeting is fresh.',
        ],
        button: { label: 'Open leads', url: `${config.webUrl}/m/leads` },
      });
    }
    return { ok: true };
  }

  /** Website: book a private demo. Saved for the console and emailed to Vellaire staff. */
  @Post('demo')
  async demo(@Body() body: unknown, @Req() req: Request) {
    limit(req, 3);
    const d = parse(
      z.object({
        name: z.string().min(2).max(120),
        email: z.string().email(),
        company: z.string().min(1).max(120),
        size: z.string().max(40).optional(),
        hr: z.string().max(60).optional(),
        message: z.string().max(2000).optional(),
      }),
      body,
    );
    await db.DemoRequest.create(d);
    for (const to of config.platformAdmins) {
      await sendMail({
        template: 'demo_request',
        to,
        subject: `Demo request: ${d.company}`,
        heading: `${d.name} from ${d.company}`,
        lines: [d.email, [d.size && `${d.size} people`, d.hr && `HR: ${d.hr}`].filter(Boolean).join(' · '), d.message || ''].filter(Boolean),
      });
    }
    return { ok: true };
  }

  /** NFC chips hold /t/<uid>. Disabled chips show the "switched off" page. */
  @Get('nfc/:uid')
  async nfc(@Param('uid') uid: string) {
    const d = await db.NfcDevice.findOne({ uid }).lean<any>();
    if (!d) throw new NotFoundException();
    const card = d.cardId ? await db.Card.findById(d.cardId).lean<any>() : null;
    const company = await db.Company.findById(d.companyId).lean<any>();
    if (d.status !== 'active' || !card || card.status !== 'live') {
      const flags = company ? await flagsFor(company) : [];
      const teamPage = Boolean(company?.settings?.teamPage && flags.includes('public.team_page'));
      const website = company?.settings?.leaverUrl || company?.brand?.website || (company?.domain?.verified && company.domain.host ? `https://${company.domain.host}` : undefined) || null;
      const logo = company?.brand?.logos?.icon || company?.brand?.logos?.light || null;
      return { active: false, companyName: company?.name, companySlug: company?.slug, website, logo, teamPage };
    }
    await db.NfcDevice.updateOne({ _id: d._id }, { lastTapAt: new Date() });
    return { active: true, url: `${cardUrl(company, card.slug)}?src=nfc` };
  }

  /** A live card's QR as a PNG for email signatures, which can only show hosted images. */
  @Get('cards/:id/qr.png')
  async qrPng(@Param('id') id: string, @Res() res: Response) {
    const { card, company } = await this.byId(id);
    const style = savedQrStyle(company);
    const buf = await QRCode.toBuffer(`${cardUrl(company, card.slug)}?src=signature`, { width: 256, margin: 1, errorCorrectionLevel: 'H', color: { dark: style?.fg || '#17171B', light: style?.bg || '#FFFFFF' } });
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.send(buf);
  }

  @Get('cards/:id/wallet/apple')
  async apple(@Param('id') id: string, @Req() req: Request, @Res() res: Response) {
    const { card, company } = await this.byId(id);
    if (!appleReady()) throw new BadRequestException('Apple Wallet is not set up for this workspace yet');
    const buf = await applePass(card, company);
    await db.Event.create({
      companyId: card.companyId,
      cardId: card._id,
      type: 'wallet_add',
      channel: 'wallet',
      wallet: 'apple',
      ...geo(req),
    });
    res.setHeader('Content-Type', 'application/vnd.apple.pkpass');
    res.setHeader('Content-Disposition', `attachment; filename="${card.slug}.pkpass"`);
    res.send(buf);
  }

  @Get('cards/:id/wallet/google')
  async google(@Param('id') id: string, @Req() req: Request, @Res() res: Response) {
    const { card, company } = await this.byId(id);
    if (!googleReady()) throw new BadRequestException('Google Wallet is not set up for this workspace yet');
    await db.Event.create({
      companyId: card.companyId,
      cardId: card._id,
      type: 'wallet_add',
      channel: 'wallet',
      wallet: 'google',
      ...geo(req),
    });
    res.redirect(googleSaveUrl(card, company));
  }
}
