import { BadRequestException, Controller, Get, Post, Query, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { mkdirSync, writeFileSync } from 'fs';
import { extname, join } from 'path';
import { config, PLANS } from '../../config';
import { AllowMember, CurrentUser, Public, SessionUser } from '../../common/auth';
import { LAYOUTS, LINK_TYPES, MATERIALS, THEMES } from '../../common/catalog';
import { cardUrl, displayUrl } from '../../common/cards';
import { daysAgo, escapeRegex, relTime, shortId } from '../../common/util';
import { db } from '../../db/db';
import { oid } from '../../db/schemas';
import { AiService } from '../ai/ai.service';
import { appleReady, googleReady } from '../public/wallet';
import { providerName } from '../integrations/sync';

const ALLOWED = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg', '.pdf', '.woff2', '.woff', '.ttf', '.otf', '.csv'];

@Controller()
export class CoreController {
  constructor(private ai: AiService) {}

  @Public()
  @Get('health')
  health() {
    return { ok: true };
  }

  @Public()
  @Get('meta')
  meta() {
    return { layouts: LAYOUTS, themes: THEMES, materials: MATERIALS, plans: PLANS, linkTypes: LINK_TYPES, ai: this.ai.enabled, wallet: { apple: appleReady(), google: googleReady() } };
  }

  /** Files are stored on disk in UPLOAD_DIR and served at /files/<name>. */
  @AllowMember()
  @Post('uploads')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 8 * 1024 * 1024 } }))
  upload(@UploadedFile() file: Express.Multer.File, @CurrentUser() u: SessionUser) {
    if (!file) throw new BadRequestException('No file');
    const ext = extname(file.originalname).toLowerCase();
    if (!ALLOWED.includes(ext)) throw new BadRequestException('This file type is not allowed');
    const dir = join(process.cwd(), config.uploadDir);
    mkdirSync(dir, { recursive: true });
    const name = `${u.companyId || 'x'}-${Date.now()}-${shortId(6)}${ext}`;
    writeFileSync(join(dir, name), file.buffer);
    return { url: `/files/${name}`, name: file.originalname, size: file.size };
  }

  @Get('home')
  async home(@CurrentUser() u: SessionUser) {
    const companyId = oid(u.companyId!);
    const company = await db.Company.findById(companyId).lean<any>();
    const since30 = daysAgo(30);
    const since60 = daysAgo(60);

    const [activeCards, cardsPrev, views, viewsPrev, leads, leadsPrev, integration, employees] = await Promise.all([
      db.Card.countDocuments({ companyId, status: 'live' }),
      db.Card.countDocuments({ companyId, status: 'live', publishedAt: { $lt: since30 } }),
      db.Event.countDocuments({ companyId, type: 'view', ts: { $gte: since30 } }),
      db.Event.countDocuments({ companyId, type: 'view', ts: { $gte: since60, $lt: since30 } }),
      db.Lead.countDocuments({ companyId, createdAt: { $gte: since30 } }),
      db.Lead.countDocuments({ companyId, createdAt: { $gte: since60, $lt: since30 } }),
      db.Integration.findOne({ companyId, status: { $in: ['connected', 'error', 'paused'] } }).lean<any>(),
      db.Employee.countDocuments({ companyId, status: 'active' }),
    ]);

    const daily = await db.Event.aggregate([
      { $match: { companyId, type: 'view', ts: { $gte: daysAgo(90) } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$ts' } }, n: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);

    // One decimal, signed, as in the designs: "+12.4% vs last period"
    const change = (cur: number, prev: number) => {
      const p = prev ? ((cur - prev) / prev) * 100 : cur ? 100 : 0;
      return { text: `${p >= 0 ? '+' : ''}${p.toFixed(1)}% vs last period`, up: p >= 0 };
    };
    const vc = change(views, viewsPrev);
    const lc = change(leads, leadsPrev);
    const metrics = [
      { label: 'Active cards', value: activeCards.toLocaleString(), delta: `+${(activeCards - cardsPrev).toLocaleString()} this month`, tone: 'up' },
      { label: 'Card views · 30 days', value: views.toLocaleString(), delta: vc.text, tone: vc.up ? 'up' : 'down' },
      { label: 'Leads captured', value: leads.toLocaleString(), delta: lc.text, tone: lc.up ? 'up' : 'down' },
      {
        label: 'HR sync',
        value: integration ? (integration.status === 'connected' ? 'Healthy' : 'Needs attention') : 'Not connected',
        delta: integration?.lastSyncAt ? `${providerName(integration.provider)} · synced ${relTime(integration.lastSyncAt)}` : 'Connect Workday, SAP or BambooHR',
        tone: integration && integration.status !== 'connected' ? 'down' : 'neutral',
      },
    ];

    // Things the admin should act on
    const attention: { title: string; sub: string; href: string; tone: string }[] = [];
    const [pending, noCard, followUp, pastDue, idle] = await Promise.all([
      db.Card.countDocuments({ companyId, status: 'pending_approval' }),
      db.Employee.countDocuments({ companyId, status: 'active', cardId: null }),
      db.Lead.countDocuments({ companyId, status: 'new', createdAt: { $lt: daysAgo(2) } }),
      db.NfcOrder.countDocuments({ companyId, stage: { $nin: ['delivered', 'cancelled'] }, dueAt: { $lt: new Date() } }),
      db.Card.countDocuments({ companyId, status: 'live', $or: [{ lastViewedAt: { $lt: since30 } }, { lastViewedAt: null }] }),
    ]);
    if (pending) attention.push({ title: `${pending} ${pending === 1 ? 'card waits' : 'cards wait'} for approval`, sub: 'Review changes before they go live', href: '/app/approvals', tone: 'warning' });
    if (noCard) attention.push({ title: `${noCard} people have no card yet`, sub: 'Create them in one step', href: '/app/employees?filter=no-card', tone: 'info' });
    if (integration?.status === 'error') attention.push({ title: 'HR sync stopped', sub: integration.lastError || 'Reconnect your HR system', href: '/app/integrations', tone: 'error' });
    if (followUp) attention.push({ title: `${followUp} leads without a follow-up`, sub: 'Older than two days', href: '/app/leads?tab=follow-up', tone: 'warning' });
    if (pastDue) attention.push({ title: `${pastDue} NFC ${pastDue === 1 ? 'order is' : 'orders are'} late`, sub: 'We are chasing the supplier', href: '/app/nfc', tone: 'info' });
    if (idle) attention.push({ title: `${idle} cards had no views in 30 days`, sub: 'Consider a reminder to their holders', href: '/app/analytics', tone: 'info' });

    // Insight: compare NFC vs QR this week vs last week
    const week = await db.Event.aggregate([
      { $match: { companyId, type: 'view', ts: { $gte: daysAgo(7) } } },
      { $group: { _id: '$channel', n: { $sum: 1 } } },
      { $sort: { n: -1 } },
    ]);
    const top = week[0];
    const insight = top
      ? `${top._id === 'nfc' ? 'NFC taps' : top._id === 'qr' ? 'QR scans' : top._id === 'wallet' ? 'Wallet passes' : 'Shared links'} opened the most cards this week (${top.n.toLocaleString()} views).`
      : 'Share your first card to start seeing insights here.';

    const recent = await db.Card.find({ companyId }).sort({ createdAt: -1 }).limit(4).lean<any[]>();

    return {
      greetingName: u.name.split(' ')[0],
      companyName: company?.name,
      seats: company?.seats,
      employees,
      metrics,
      daily: daily.map((d) => ({ date: d._id, views: d.n })),
      attention: attention.slice(0, 5),
      insight,
      hasIntegration: !!integration,
      recent: recent.map((c) => ({
        id: String(c._id),
        name: c.fields?.name,
        title: c.fields?.title,
        status: c.status,
        layout: c.layout,
        theme: c.theme,
        when: c.updatedAt - c.createdAt > 60_000 ? `Updated ${relTime(c.updatedAt)}` : `Created ${relTime(c.createdAt)}`,
        url: displayUrl(cardUrl(company, c.slug)),
      })),
    };
  }

  /** Command palette (⌘K) search across people, cards and pages. */
  @Get('search')
  async search(@Query('q') q: string, @CurrentUser() u: SessionUser) {
    const companyId = oid(u.companyId!);
    const term = String(q || '').trim();
    if (term.length < 2) return { people: [], cards: [] };
    const rx = new RegExp(escapeRegex(term), 'i');
    const [people, cards] = await Promise.all([
      db.Employee.find({ companyId, $or: [{ name: rx }, { email: rx }, { title: rx }] }).limit(6).lean<any[]>(),
      db.Card.find({ companyId, $or: [{ 'fields.name': rx }, { slug: rx }] }).limit(6).lean<any[]>(),
    ]);
    return {
      people: people.map((p) => ({ id: String(p._id), name: p.name, sub: [p.title, p.office].filter(Boolean).join(' · '), cardId: p.cardId ? String(p.cardId) : null })),
      cards: cards.map((c) => ({ id: String(c._id), name: c.fields?.name, sub: c.status })),
    };
  }
}
