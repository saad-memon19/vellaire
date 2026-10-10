import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import JSZip from 'jszip';
import QRCode from 'qrcode';
import { z } from 'zod';
import { CurrentUser, MANAGERS, Roles, SessionUser } from '../../common/auth';
import { isLayout, isTheme, LAYOUTS, THEMES } from '../../common/catalog';
import {
  cardUrl,
  createCardForEmployee,
  deactivateCard,
  displayUrl,
  publishCard,
  serializeCard,
} from '../../common/cards';
import { daysAgo, escapeRegex, found, logActivity, paging, parse, pct, relTime, requireId, slugify, initials } from '../../common/util';
import { db } from '../../db/db';
import { oid } from '../../db/schemas';
import { signatureHtml } from './signature';

const linkSchema = z.object({
  type: z.string().max(30),
  label: z.string().max(80),
  url: z.string().max(500),
  sub: z.string().max(120).optional(),
});

export const cardPatch = z.object({
  layout: z.string().refine(isLayout, 'Unknown layout').optional(),
  theme: z.string().refine(isTheme, 'Unknown theme').optional(),
  cover: z.string().max(300).optional(),
  slug: z.string().min(2).max(60).optional(),
  fields: z
    .object({
      name: z.string().max(120),
      title: z.string().max(120),
      department: z.string().max(120),
      office: z.string().max(120),
      email: z.string().max(160),
      phone: z.string().max(40),
      mobile: z.string().max(40),
      whatsapp: z.string().max(40),
      website: z.string().max(200),
      address: z.string().max(300),
      photoUrl: z.string().max(400),
      bio: z.string().max(600),
      pronouns: z.string().max(30),
    })
    .partial()
    .optional(),
  translations: z.record(z.object({ name: z.string(), title: z.string(), bio: z.string() }).partial()).optional(),
  links: z.array(linkSchema).max(12).optional(),
  delivery: z.array(z.enum(['email', 'wallet', 'signature', 'nfc'])).optional(),
});

const CHANNEL_LONG: Record<string, string> = {
  nfc: 'NFC tap', qr: 'QR scan', wallet: 'Wallet pass', link: 'Shared link', email: 'Email signature', signature: 'Email signature', team: 'Team page',
};

const SOURCE_LABEL: Record<string, string> = {
  workday: 'Workday', sap: 'SAP', bamboohr: 'BambooHR', entra: 'Entra ID', scim: 'SCIM', csv: 'CSV import', manual: 'Added by hand',
};

@Controller()
export class CardsController {
  private async company(u: SessionUser) {
    return found(await db.Company.findById(u.companyId).lean<any>(), 'Company');
  }

  private async ownCard(u: SessionUser, id: string) {
    return found(await db.Card.findOne({ _id: requireId(id), companyId: oid(u.companyId!) }), 'Card');
  }

  @Get('cards')
  async list(@Query() q: any, @CurrentUser() u: SessionUser) {
    const companyId = oid(u.companyId!);
    const company = await this.company(u);
    const { limit, page, skip } = paging({ ...q, limit: q.limit || '8' });
    const filter: any = { companyId };
    if (q.status && q.status !== 'all') filter.status = q.status;
    if (q.q) {
      const rx = new RegExp(escapeRegex(q.q), 'i');
      filter.$or = [{ 'fields.name': rx }, { 'fields.title': rx }, { slug: rx }];
    }
    if (q.department) filter['fields.department'] = q.department;
    if (q.office) filter['fields.office'] = q.office;
    if (q.template && /^[a-f0-9]{24}$/.test(q.template)) filter.templateId = oid(q.template);
    if (q.source) filter.employeeId = { $in: await db.Employee.find({ companyId, source: q.source }).distinct('_id') };

    const [items, total, byStatus, departments, offices, templates, sources] = await Promise.all([
      db.Card.find(filter).sort({ updatedAt: -1 }).skip(skip).limit(limit).lean<any[]>(),
      db.Card.countDocuments(filter),
      db.Card.aggregate([{ $match: { companyId } }, { $group: { _id: '$status', n: { $sum: 1 } } }]),
      db.Card.distinct('fields.department', { companyId }),
      db.Card.distinct('fields.office', { companyId }),
      db.Template.find({ companyId }).select('name').sort({ name: 1 }).lean<any[]>(),
      db.Employee.distinct('source', { companyId }),
    ]);
    const ids = items.map((c) => c._id);
    const views = await db.Event.aggregate([
      { $match: { cardId: { $in: ids }, type: 'view', ts: { $gte: daysAgo(30) } } },
      { $group: { _id: '$cardId', n: { $sum: 1 } } },
    ]);
    const vmap = new Map(views.map((v) => [String(v._id), v.n]));
    const emps = await db.Employee.find({ _id: { $in: items.map((c) => c.employeeId).filter(Boolean) } }).select('source').lean<any[]>();
    const emap = new Map(emps.map((e) => [String(e._id), e.source]));
    const counts = Object.fromEntries(byStatus.map((s) => [s._id, s.n]));
    const all = Object.values(counts).reduce((a: number, b: any) => a + b, 0);

    return {
      total,
      page,
      limit,
      // Order and names as in the design; Scheduled only shows when there are any
      tabs: [
        { id: 'all', name: 'All', count: all },
        { id: 'live', name: 'Live', count: counts.live || 0 },
        { id: 'pending_approval', name: 'Pending approval', count: counts.pending_approval || 0 },
        ...(counts.scheduled ? [{ id: 'scheduled', name: 'Scheduled', count: counts.scheduled }] : []),
        { id: 'draft', name: 'Drafts', count: counts.draft || 0 },
        { id: 'deactivated', name: 'Deactivated', count: counts.deactivated || 0 },
      ],
      templates: templates.map((t) => ({ id: String(t._id), name: t.name })),
      sources: sources.filter(Boolean).map((x: string) => ({ id: x, name: SOURCE_LABEL[x] || x })),
      departments: departments.filter(Boolean).sort(),
      offices: offices.filter(Boolean).sort(),
      items: items.map((c) => ({
        id: String(c._id),
        name: c.fields?.name,
        title: c.fields?.title,
        dept: c.fields?.department,
        office: c.fields?.office,
        photoUrl: c.fields?.photoUrl,
        status: c.status,
        layout: c.layout,
        theme: c.theme,
        views: vmap.get(String(c._id)) || 0,
        source: SOURCE_LABEL[emap.get(String(c.employeeId)) || 'manual'] || 'Added by hand',
        url: displayUrl(cardUrl(company, c.slug)),
      })),
      brand: { companyName: company.name, logos: company.brand?.logos || {}, colors: company.brand?.colors || [], fonts: company.brand?.fonts },
    };
  }

  @Get('cards/slug-available')
  async slugAvailable(@Query('slug') slug: string, @Query('exceptId') exceptId: string, @CurrentUser() u: SessionUser) {
    const clean = slugify(slug || '');
    const q: any = { companyId: oid(u.companyId!), slug: clean };
    if (exceptId) q._id = { $ne: requireId(exceptId) };
    return { slug: clean, available: clean.length >= 2 && !(await db.Card.exists(q)) };
  }

  @Get('cards/qr-codes.zip')
  async allQr(@CurrentUser() u: SessionUser, @Res() res: Response) {
    const company = await this.company(u);
    const cards = await db.Card.find({ companyId: company._id, status: 'live' }).select('slug').lean<any[]>();
    const zip = new JSZip();
    for (const c of cards) {
      const svg = await QRCode.toString(`${cardUrl(company, c.slug)}?src=qr`, { type: 'svg', margin: 1, errorCorrectionLevel: 'H', color: { dark: '#17171B', light: '#FFFFFF' } });
      zip.file(`${c.slug}.svg`, svg);
    }
    const buf = await zip.generateAsync({ type: 'nodebuffer' });
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${company.slug}-qr-codes.zip"`);
    res.send(buf);
  }

  @Get('cards/:id')
  async get(@Param('id') id: string, @CurrentUser() u: SessionUser) {
    const card = await this.ownCard(u, id);
    const company = await this.company(u);
    const employee = card.employeeId ? await db.Employee.findById(card.employeeId).lean<any>() : null;
    const s30 = daysAgo(30);
    const s60 = daysAgo(60);
    const agg = async (from: Date, to?: Date) => {
      const rows = await db.Event.aggregate([
        { $match: { cardId: card._id, ts: to ? { $gte: from, $lt: to } : { $gte: from } } },
        { $group: { _id: '$type', n: { $sum: 1 } } },
      ]);
      return Object.fromEntries(rows.map((r) => [r._id, r.n])) as Record<string, number>;
    };
    const [cur, prev, channels, leads, devices, leadCount] = await Promise.all([
      agg(s30),
      agg(s60, s30),
      db.Event.aggregate([
        { $match: { cardId: card._id, type: 'view', ts: { $gte: s30 } } },
        { $group: { _id: '$channel', n: { $sum: 1 } } },
        { $sort: { n: -1 } },
      ]),
      db.Lead.find({ cardId: card._id }).sort({ createdAt: -1 }).limit(4).lean<any[]>(),
      db.NfcDevice.find({ cardId: card._id }).lean<any[]>(),
      db.Lead.countDocuments({ cardId: card._id }),
    ]);
    const totalViews = channels.reduce((a, c) => a + c.n, 0) || 1;
    const [nfcNow, nfcPrev] = await Promise.all([
      db.Event.countDocuments({ cardId: card._id, type: 'view', channel: 'nfc', ts: { $gte: s30 } }),
      db.Event.countDocuments({ cardId: card._id, type: 'view', channel: 'nfc', ts: { $gte: s60, $lt: s30 } }),
    ]);
    const delta = (k: string) => {
      const d = pct(cur[k] || 0, prev[k] || 0);
      return `${d >= 0 ? '+' : ''}${d}%`;
    };
    const wallet = await db.Event.countDocuments({ cardId: card._id, type: 'wallet_add' });

    return {
      card: serializeCard(card.toObject(), company, employee),
      sourceLabel: SOURCE_LABEL[employee?.source || 'manual'],
      stats: [
        { label: 'Views', value: (cur.view || 0).toLocaleString(), delta: `${delta('view')} this month` },
        { label: 'Contact saves', value: (cur.save || 0).toLocaleString(), delta: `${delta('save')} this month` },
        { label: 'Leads', value: (cur.lead || 0).toLocaleString(), delta: `+${cur.lead || 0} this month` },
        { label: 'NFC taps', value: nfcNow.toLocaleString(), delta: `${pct(nfcNow, nfcPrev) >= 0 ? '+' : ''}${pct(nfcNow, nfcPrev)}% this month` },
      ],
      channels: channels.map((c) => ({ name: CHANNEL_LONG[c._id] || 'Shared link', pct: Math.round((c.n / totalViews) * 100) })),
      leadCount,
      leads: leads.map((l) => ({ id: String(l._id), ini: initials(l.name), name: l.name, co: l.company, via: channelName(l.via), when: relTime(l.createdAt) })),
      // Rows of "Where this card lives", as in the design
      devices: [
        ...devices.map((d) => ({
          id: String(d._id),
          kind: 'nfc',
          name: `${d.material ? materialLabel(d.material) : 'NFC'} NFC card`,
          sub: d.lastTapAt ? `Last tap ${relTime(d.lastTapAt)}` : 'Not tapped yet',
          state: d.status === 'active' ? 'Active' : d.status === 'lost' ? 'Lost' : 'Off',
        })),
        { kind: 'wallet', name: 'Wallet pass', sub: wallet ? `Added ${wallet} ${wallet === 1 ? 'time' : 'times'}` : 'Apple and Google Wallet', state: card.status !== 'live' ? 'Off' : wallet ? 'Installed' : 'Available' },
        ...(card.delivery?.includes('signature') ? [{ kind: 'signature', name: 'Email signature', sub: 'Outlook and Gmail', state: 'Ready' }] : []),
        ...(employee && employee.source !== 'manual'
          ? [{ kind: 'sync', name: 'HR sync', sub: `${SOURCE_LABEL[employee.source] || employee.source} · last update ${relTime(employee.updatedAt)}`, state: card.syncedFields?.length ? 'In sync' : 'Edited by hand' }]
          : []),
        { kind: 'link', name: 'Online card', sub: displayUrl(cardUrl(company, card.slug)), state: card.status === 'live' ? 'Live' : statusLabel(card.status) },
      ],
    };
  }

  @Get('cards/:id/history')
  async history(@Param('id') id: string, @CurrentUser() u: SessionUser) {
    const card = await this.ownCard(u, id);
    const rows = await db.Activity.find({ cardId: card._id }).sort({ createdAt: -1 }).limit(50).lean<any[]>();
    return rows.map((r) => ({ id: String(r._id), text: r.text, actor: r.actor, when: relTime(r.createdAt), at: r.createdAt }));
  }

  @Get('cards/:id/leads')
  async leads(@Param('id') id: string, @CurrentUser() u: SessionUser) {
    const card = await this.ownCard(u, id);
    const rows = await db.Lead.find({ cardId: card._id }).sort({ createdAt: -1 }).limit(200).lean<any[]>();
    return rows.map((l) => ({ id: String(l._id), ini: initials(l.name), name: l.name, co: l.company, email: l.email, via: channelName(l.via), when: relTime(l.createdAt), status: l.status }));
  }

  @Get('cards/:id/qr')
  async qr(@Param('id') id: string, @Query('format') format: string, @CurrentUser() u: SessionUser, @Res() res: Response) {
    const card = await this.ownCard(u, id);
    const company = await this.company(u);
    const url = `${cardUrl(company, card.slug)}?src=qr`;
    if (format === 'png') {
      const buf = await QRCode.toBuffer(url, { width: 1024, margin: 2, errorCorrectionLevel: 'H', color: { dark: '#17171B', light: '#FFFFFF' } });
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Content-Disposition', `attachment; filename="${card.slug}-qr.png"`);
      return res.send(buf);
    }
    const svg = await QRCode.toString(url, { type: 'svg', margin: 1, errorCorrectionLevel: 'H', color: { dark: '#17171B', light: '#FFFFFF' } });
    res.setHeader('Content-Type', 'image/svg+xml');
    if (format === 'download') res.setHeader('Content-Disposition', `attachment; filename="${card.slug}-qr.svg"`);
    return res.send(svg);
  }

  @Get('cards/:id/signature')
  async signature(@Param('id') id: string, @CurrentUser() u: SessionUser) {
    const card = await this.ownCard(u, id);
    const company = await this.company(u);
    return { html: signatureHtml(card.toObject(), company) };
  }

  /** Start a card: for an existing employee, or a new person (creates them first). Returns a draft. */
  @Roles(...MANAGERS)
  @Post('cards')
  async create(@Body() body: unknown, @CurrentUser() u: SessionUser) {
    const data = parse(
      z.object({
        employeeId: z.string().optional(),
        person: z
          .object({
            name: z.string().min(2).max(120),
            title: z.string().max(120).optional(),
            department: z.string().max(120).optional(),
            office: z.string().max(120).optional(),
            email: z.string().email().optional().or(z.literal('')),
            phone: z.string().max(40).optional(),
          })
          .optional(),
      }),
      body,
    );
    const company = await this.company(u);
    let employee: any;
    if (data.employeeId) {
      employee = found(await db.Employee.findOne({ _id: requireId(data.employeeId), companyId: company._id }).lean<any>(), 'Employee');
    } else if (data.person) {
      employee = (await db.Employee.create({ companyId: company._id, source: 'manual', ...data.person })).toObject();
    } else {
      throw new BadRequestException('Choose a person');
    }
    const card = await createCardForEmployee(company, employee, { actor: u.name });
    return serializeCard(card.toObject ? card.toObject() : card, company, employee);
  }

  /** Create (and publish) cards for many people at once. */
  @Roles(...MANAGERS)
  @Post('cards/bulk')
  async bulk(@Body() body: unknown, @CurrentUser() u: SessionUser) {
    const data = parse(
      z.object({ employeeIds: z.array(z.string()).max(2000).optional(), allWithoutCard: z.boolean().optional(), publish: z.boolean().default(true) }),
      body,
    );
    const company = await this.company(u);
    const filter: any = { companyId: company._id, status: 'active' };
    if (data.allWithoutCard) filter.cardId = null;
    else filter._id = { $in: (data.employeeIds || []).map(requireId) };
    const emps = await db.Employee.find(filter).lean<any[]>();
    let created = 0;
    for (const e of emps) {
      const card = await createCardForEmployee(company, e, { actor: u.name });
      if (data.publish && card.status === 'draft') await publishCard(card._id, u);
      created++;
    }
    return { created };
  }

  @Roles(...MANAGERS)
  @Patch('cards/:id')
  async update(@Param('id') id: string, @Body() body: unknown, @CurrentUser() u: SessionUser) {
    const card = await this.ownCard(u, id);
    const data = parse(cardPatch, body);
    if (data.slug && data.slug !== card.slug) {
      const clean = slugify(data.slug);
      if (await db.Card.exists({ companyId: card.companyId, slug: clean, _id: { $ne: card._id } })) {
        throw new BadRequestException('This link is already taken');
      }
      card.slug = clean;
    }
    if (data.layout) card.layout = data.layout;
    if (data.theme) card.theme = data.theme;
    if (data.cover !== undefined) card.cover = data.cover;
    if (data.links) card.links = data.links as any;
    if (data.delivery) card.delivery = data.delivery as any;
    if (data.translations) card.translations = data.translations;
    if (data.fields) {
      const changedSynced = Object.keys(data.fields).filter(
        (k) => card.syncedFields.includes(k) && (card.fields as any)[k] !== (data.fields as any)[k],
      );
      card.fields = { ...(card.toObject().fields || {}), ...data.fields } as any;
      // A field edited by hand stops following HR
      if (changedSynced.length) card.syncedFields = card.syncedFields.filter((f: string) => !changedSynced.includes(f));
    }
    card.markModified('translations');
    await card.save();
    if (card.status === 'live') {
      await logActivity({ companyId: card.companyId, cardId: card._id, actor: u.name, action: 'card.updated', text: 'Card details updated' });
    }
    const company = await this.company(u);
    return serializeCard(card.toObject(), company);
  }

  @Roles(...MANAGERS)
  @Post('cards/:id/publish')
  async publish(@Param('id') id: string, @Body() body: unknown, @CurrentUser() u: SessionUser) {
    const data = parse(
      z.object({ publishAt: z.string().datetime().nullable().optional(), nfcMaterial: z.string().nullable().optional() }),
      body || {},
    );
    const card = await this.ownCard(u, id);
    if (!card.fields?.name) throw new BadRequestException('The card needs a name');
    const result = await publishCard(card._id, u, {
      publishAt: data.publishAt ? new Date(data.publishAt) : null,
      nfcMaterial: data.nfcMaterial || null,
    });
    const company = await this.company(u);
    const fresh = await db.Card.findById(card._id).lean<any>();
    return { ...result, card: serializeCard(fresh, company) };
  }

  @Roles(...MANAGERS)
  @Post('cards/:id/deactivate')
  async deactivate(@Param('id') id: string, @CurrentUser() u: SessionUser) {
    const card = await this.ownCard(u, id);
    await deactivateCard(card._id, u.name);
    return { ok: true };
  }

  @Roles(...MANAGERS)
  @Post('cards/:id/reactivate')
  async reactivate(@Param('id') id: string, @CurrentUser() u: SessionUser) {
    const card = await this.ownCard(u, id);
    await db.Card.updateOne({ _id: card._id }, { status: 'draft', deactivatedAt: null });
    const r = await publishCard(card._id, u, { skipApproval: true });
    await db.NfcDevice.updateMany({ cardId: card._id, status: 'disabled' }, { status: 'active' });
    return r;
  }

  @Roles(...MANAGERS)
  @Delete('cards/:id')
  async remove(@Param('id') id: string, @CurrentUser() u: SessionUser) {
    const card = await this.ownCard(u, id);
    if (card.status !== 'draft') throw new BadRequestException('Only drafts can be deleted. Deactivate live cards instead.');
    await db.Card.deleteOne({ _id: card._id });
    await db.Employee.updateOne({ cardId: card._id }, { cardId: null });
    return { ok: true };
  }

  /* ---------- Approvals ---------- */

  @Roles(...MANAGERS)
  @Get('approvals')
  async approvals(@CurrentUser() u: SessionUser) {
    const company = await this.company(u);
    const cards = await db.Card.find({
      companyId: company._id,
      $or: [{ status: 'pending_approval' }, { 'approval.pendingPhoto': { $nin: [null, ''] } }, { 'approval.changes': { $exists: true, $nin: [null, []] } }],
    })
      .sort({ 'approval.requestedAt': -1 })
      .lean<any[]>();
    const recent = await db.Activity.find({ companyId: company._id, action: { $in: ['card.approved', 'card.rejected'] } })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean<any[]>();

    const pending = cards.map((c) => {
      const reqBy = c.approval?.requestedBy || 'Workday sync';
      const source = reqBy.toLowerCase().includes('workday')
        ? 'Workday'
        : reqBy.toLowerCase().includes('sap')
          ? 'SAP'
          : reqBy.toLowerCase().includes('bamboo')
            ? 'BambooHR'
            : 'Employee';

      let what = 'Card change';
      let headerWhat = 'card change';
      let changes: { field: string; before?: string; after?: string }[] = [];
      const beforeFields = c.approval?.before ? { ...c.fields, ...c.approval.before } : (c.status === 'pending_approval' && !c.publishedAt ? {} : c.fields);
      let afterFields = c.approval?.after ? { ...c.fields, ...c.approval.after } : c.fields;

      if (c.approval?.changes && Array.isArray(c.approval.changes) && c.approval.changes.length) {
        changes = c.approval.changes;
        what = c.approval.reason || 'Title and department changed';
        headerWhat = what.toLowerCase().includes('title') ? 'title change' : what.toLowerCase();
      } else if (c.approval?.pendingPhoto) {
        what = 'New profile photo';
        headerWhat = 'photo change';
        changes = [{ field: 'Profile photo', before: c.fields?.photoUrl ? 'Current photo' : 'None', after: 'New photo' }];
        afterFields = { ...c.fields, photoUrl: c.approval.pendingPhoto };
      } else if (c.approval?.before) {
        const b = c.approval.before;
        const a = c.approval.after || c.fields;
        const keys = Array.from(new Set([...Object.keys(b), ...Object.keys(a)]));
        changes = keys.map((k) => ({
          field: k === 'title' ? 'Job title' : k === 'department' ? 'Department' : k === 'office' ? 'Office' : k,
          before: b[k] || 'None',
          after: b[k] === a[k] ? 'No change' : a[k] || 'None',
        }));
        what = c.approval.reason || 'Details updated';
        headerWhat = 'details updated';
      } else {
        what = c.approval?.reason === 'New joiner from HR' ? 'New card for new joiner' : (c.approval?.reason || 'New card');
        headerWhat = 'new card';
        changes = [
          { field: 'Job title', before: 'None', after: c.fields?.title || 'None' },
          { field: 'Department', before: 'None', after: c.fields?.department || 'None' },
          { field: 'Office', before: 'None', after: c.fields?.office || 'None' },
        ];
      }

      return {
        ...serializeCard(c, company),
        ini: initials(c.fields?.name),
        name: c.fields?.name,
        requestedBy: reqBy,
        source,
        reason: c.approval?.reason,
        what,
        headerWhat,
        pendingPhoto: c.approval?.pendingPhoto || null,
        when: relTime(c.approval?.requestedAt),
        before: {
          fields: beforeFields,
        },
        after: {
          fields: afterFields,
        },
        changes,
      };
    });

    return {
      pending,
      recent: recent.map((r) => ({ id: String(r._id), text: r.text, actor: r.actor, when: relTime(r.createdAt) })),
    };
  }

  @Roles(...MANAGERS)
  @Post('approvals/bulk-approve')
  async bulkApprove(@Body() body: unknown, @CurrentUser() u: SessionUser) {
    const { source } = parse(z.object({ source: z.string().optional() }), body || {});
    const company = await this.company(u);
    const filter: any = {
      companyId: company._id,
      $or: [{ status: 'pending_approval' }, { 'approval.pendingPhoto': { $nin: [null, ''] } }, { 'approval.changes': { $exists: true, $nin: [null, []] } }],
    };
    if (source) {
      filter['approval.requestedBy'] = { $regex: new RegExp(source, 'i') };
    }
    const cards = await db.Card.find(filter);
    let approved = 0;
    for (const card of cards) {
      const pendingPhoto = card.approval?.pendingPhoto;
      if (pendingPhoto && card.status !== 'pending_approval') {
        card.fields = { ...(card.toObject().fields || {}), photoUrl: pendingPhoto } as any;
        card.approval = { ...(card.toObject().approval || {}), pendingPhoto: null, reviewedBy: u.name, reviewedAt: new Date() } as any;
        await card.save();
        await logActivity({ companyId: card.companyId, cardId: card._id, actor: u.name, action: 'card.approved', text: `${u.name} approved ${card.fields?.name}'s new photo` });
        approved++;
      } else if (card.approval?.after && card.status !== 'pending_approval') {
        card.fields = { ...(card.toObject().fields || {}), ...card.approval.after } as any;
        card.approval = { ...(card.toObject().approval || {}), before: null, after: null, changes: null, reviewedBy: u.name, reviewedAt: new Date() } as any;
        await card.save();
        await logActivity({ companyId: card.companyId, cardId: card._id, actor: u.name, action: 'card.approved', text: `${u.name} approved ${card.fields?.name}'s changes` });
        approved++;
      } else if (card.status === 'pending_approval') {
        card.approval = { ...(card.toObject().approval || {}), reviewedBy: u.name, reviewedAt: new Date() } as any;
        card.status = 'draft';
        await card.save();
        await logActivity({ companyId: card.companyId, cardId: card._id, actor: u.name, action: 'card.approved', text: `${u.name} approved ${card.fields?.name}'s card` });
        await publishCard(card._id, u, { skipApproval: true, publishAt: card.publishAt || null });
        approved++;
      }
    }
    return { approved };
  }

  @Roles(...MANAGERS)
  @Post('approvals/:id/approve')
  async approve(@Param('id') id: string, @CurrentUser() u: SessionUser) {
    const card = await this.ownCard(u, id);
    const pendingPhoto = card.approval?.pendingPhoto;
    if (pendingPhoto && card.status !== 'pending_approval') {
      card.fields = { ...(card.toObject().fields || {}), photoUrl: pendingPhoto } as any;
      card.approval = { ...(card.toObject().approval || {}), pendingPhoto: null, reviewedBy: u.name, reviewedAt: new Date() } as any;
      await card.save();
      await logActivity({ companyId: card.companyId, cardId: card._id, actor: u.name, action: 'card.approved', text: `${u.name} approved ${card.fields?.name}'s new photo` });
      return { status: card.status, steps: [] };
    }
    if (card.approval?.after && card.status !== 'pending_approval') {
      card.fields = { ...(card.toObject().fields || {}), ...card.approval.after } as any;
      card.approval = { ...(card.toObject().approval || {}), before: null, after: null, changes: null, reviewedBy: u.name, reviewedAt: new Date() } as any;
      await card.save();
      await logActivity({ companyId: card.companyId, cardId: card._id, actor: u.name, action: 'card.approved', text: `${u.name} approved ${card.fields?.name}'s changes` });
      return { status: card.status, steps: [] };
    }
    if (card.status !== 'pending_approval') throw new BadRequestException('Nothing to approve');
    card.approval = { ...(card.toObject().approval || {}), reviewedBy: u.name, reviewedAt: new Date() } as any;
    card.status = 'draft';
    await card.save();
    await logActivity({ companyId: card.companyId, cardId: card._id, actor: u.name, action: 'card.approved', text: `${u.name} approved ${card.fields?.name}'s card` });
    return publishCard(card._id, u, { skipApproval: true, publishAt: card.publishAt || null });
  }

  @Roles(...MANAGERS)
  @Post('approvals/:id/reject')
  async reject(@Param('id') id: string, @Body() body: unknown, @CurrentUser() u: SessionUser) {
    const { note } = parse(z.object({ note: z.string().max(500).default('') }), body || {});
    const card = await this.ownCard(u, id);
    if (card.status === 'pending_approval') card.status = card.publishedAt ? 'live' : 'draft';
    card.approval = { ...(card.toObject().approval || {}), pendingPhoto: null, before: null, after: null, changes: null, reviewedBy: u.name, reviewedAt: new Date(), note } as any;
    await card.save();
    await logActivity({ companyId: card.companyId, cardId: card._id, actor: u.name, action: 'card.rejected', text: `${u.name} sent ${card.fields?.name}'s card back${note ? `: ${note}` : ''}` });
    return { ok: true };
  }

  /* ---------- Templates ---------- */

  @Get('templates')
  async templates(@CurrentUser() u: SessionUser) {
    const companyId = oid(u.companyId!);
    const rows = await db.Template.find({ companyId }).sort({ isDefault: -1, name: 1 }).lean<any[]>();
    const usage = await db.Card.aggregate([{ $match: { companyId, templateId: { $ne: null } } }, { $group: { _id: '$templateId', n: { $sum: 1 } } }]);
    const umap = new Map(usage.map((x) => [String(x._id), x.n]));
    return rows.map((t) => ({
      id: String(t._id),
      name: t.name,
      layout: t.layout,
      layoutName: LAYOUTS.find((l) => l.id === t.layout)?.name,
      theme: t.theme,
      themeName: THEMES.find((x) => x.id === t.theme)?.name,
      cover: t.cover,
      isDefault: t.isDefault,
      departments: t.departments || [],
      cards: umap.get(String(t._id)) || 0,
    }));
  }

  @Roles(...MANAGERS)
  @Post('templates')
  async createTemplate(@Body() body: unknown, @CurrentUser() u: SessionUser) {
    const data = parse(templateSchema, body);
    const companyId = oid(u.companyId!);
    if (data.isDefault) await db.Template.updateMany({ companyId }, { isDefault: false });
    const t = await db.Template.create({ ...data, companyId });
    return { id: String(t._id) };
  }

  @Roles(...MANAGERS)
  @Patch('templates/:id')
  async updateTemplate(@Param('id') id: string, @Body() body: unknown, @CurrentUser() u: SessionUser) {
    const data = parse(templateSchema.partial(), body);
    const companyId = oid(u.companyId!);
    if (data.isDefault) await db.Template.updateMany({ companyId }, { isDefault: false });
    found(await db.Template.findOneAndUpdate({ _id: requireId(id), companyId }, data), 'Template');
    return { ok: true };
  }

  @Roles(...MANAGERS)
  @Post('templates/:id/apply')
  async applyTemplate(@Param('id') id: string, @CurrentUser() u: SessionUser) {
    const companyId = oid(u.companyId!);
    const t = found(await db.Template.findOne({ _id: requireId(id), companyId }).lean<any>(), 'Template');
    const filter: any = { companyId, status: { $ne: 'deactivated' } };
    filter.$or = [{ templateId: t._id }, ...(t.departments?.length ? [{ 'fields.department': { $in: t.departments } }] : [])];
    const r = await db.Card.updateMany(filter, { layout: t.layout, theme: t.theme, cover: t.cover, templateId: t._id });
    await logActivity({ companyId, actor: u.name, action: 'template.applied', text: `Template "${t.name}" applied to ${r.modifiedCount} cards` });
    return { updated: r.modifiedCount };
  }

  @Roles(...MANAGERS)
  @Delete('templates/:id')
  async deleteTemplate(@Param('id') id: string, @CurrentUser() u: SessionUser) {
    await db.Template.deleteOne({ _id: requireId(id), companyId: oid(u.companyId!) });
    return { ok: true };
  }
}

const templateSchema = z.object({
  name: z.string().min(1).max(80),
  layout: z.string().refine(isLayout, 'Unknown layout'),
  theme: z.string().refine(isTheme, 'Unknown theme'),
  cover: z.string().max(300).default('brand'),
  isDefault: z.boolean().default(false),
  departments: z.array(z.string().max(120)).default([]),
});

export function channelName(c?: string) {
  return ({ nfc: 'NFC tap', qr: 'QR scan', link: 'Link', wallet: 'Wallet', email: 'Email signature', signature: 'Email signature', paper: 'Paper card', team: 'Team page' } as Record<string, string>)[c || ''] || 'Link';
}
export function statusLabel(s: string) {
  return ({ live: 'Live', draft: 'Draft', pending_approval: 'Waiting approval', scheduled: 'Scheduled', deactivated: 'Deactivated' } as Record<string, string>)[s] || s;
}
function materialLabel(id: string) {
  return ({ metal_obsidian: 'Obsidian Metal', metal_steel: 'Brushed Steel', metal_gold: '24K Gold', wood_walnut: 'Walnut', pvc_black: 'Matte PVC' } as Record<string, string>)[id] || id;
}
