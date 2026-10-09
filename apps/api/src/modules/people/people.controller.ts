import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import Papa from 'papaparse';
import { z } from 'zod';
import { ADMINS, CurrentUser, MANAGERS, Roles, SessionUser } from '../../common/auth';
import { createCardForEmployee, deactivateCard, orderNfcFor, publishCard } from '../../common/cards';
import { escapeRegex, found, initials, logActivity, paging, parse, relTime, requireId, toCsv } from '../../common/util';
import { db } from '../../db/db';
import { oid } from '../../db/schemas';

const personSchema = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email().or(z.literal('')).optional(),
  title: z.string().max(120).optional(),
  department: z.string().max(120).optional(),
  office: z.string().max(120).optional(),
  phone: z.string().max(40).optional(),
  mobile: z.string().max(40).optional(),
  country: z.string().max(80).optional(),
  startDate: z.string().optional(),
  workerType: z.string().max(40).optional(),
});

const CARD_STATE: Record<string, string> = {
  live: 'Live', draft: 'Draft', pending_approval: 'Pending', scheduled: 'Scheduled', deactivated: 'Deactivated',
};
const SOURCE: Record<string, string> = {
  workday: 'Workday', sap: 'SAP', bamboohr: 'BambooHR', entra: 'Entra ID', scim: 'SCIM', csv: 'CSV', manual: 'Manual',
};

/** Finds a CSV column by any of its common names. */
function pick(row: Record<string, string>, names: string[]) {
  const keys = Object.keys(row);
  for (const n of names) {
    const k = keys.find((x) => x.trim().toLowerCase().replace(/[\s_-]+/g, '') === n);
    if (k && row[k]?.trim()) return row[k]!.trim();
  }
  return '';
}

@Controller()
export class PeopleController {
  @Get('employees')
  async list(@Query() q: any, @CurrentUser() u: SessionUser) {
    const companyId = oid(u.companyId!);
    const { limit, page, skip } = paging(q);
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    // Card status filters (from the summary tiles or the Card status dropdown)
    const byCardStatus = (st: string) => db.Card.find({ companyId, status: st }).distinct('_id');
    const cardStatus = q.filter === 'live' ? 'live' : q.filter === 'pending' ? 'pending_approval' : q.cardStatus || '';

    const filter: any = { companyId };
    if (q.filter === 'leavers') filter.status = 'leaver';
    else filter.status = 'active';
    if (q.filter === 'no-card' || cardStatus === 'none') filter.cardId = null;
    else if (cardStatus) filter.cardId = { $in: await byCardStatus(cardStatus) };
    if (q.filter === 'joined') filter.startDate = { $gte: monthStart };
    if (q.department) filter.department = q.department;
    if (q.office) filter.office = q.office;
    if (q.source) filter.source = q.source;
    if (q.q) {
      const rx = new RegExp(escapeRegex(q.q), 'i');
      filter.$or = [{ name: rx }, { email: rx }, { title: rx }];
    }

    const [rows, total, people, withoutCard, joined, leavers, integration, departments, offices, sources, liveCards, pendingCards] = await Promise.all([
      db.Employee.find(filter).sort({ name: 1 }).skip(skip).limit(limit).lean<any[]>(),
      db.Employee.countDocuments(filter),
      db.Employee.countDocuments({ companyId, status: 'active' }),
      db.Employee.countDocuments({ companyId, status: 'active', cardId: null }),
      db.Employee.countDocuments({ companyId, status: 'active', startDate: { $gte: monthStart } }),
      db.Employee.countDocuments({ companyId, status: 'leaver' }),
      db.Integration.findOne({ companyId, status: { $ne: 'draft' } }).sort({ lastSyncAt: -1 }).lean<any>(),
      db.Employee.distinct('department', { companyId }),
      db.Employee.distinct('office', { companyId }),
      db.Employee.distinct('source', { companyId }),
      db.Card.countDocuments({ companyId, status: 'live' }),
      db.Card.countDocuments({ companyId, status: 'pending_approval' }),
    ]);
    const cardIds = rows.map((r) => r.cardId).filter(Boolean);
    const [cards, devices, wallets] = await Promise.all([
      db.Card.find({ _id: { $in: cardIds } }).select('status').lean<any[]>(),
      db.NfcDevice.aggregate([{ $match: { cardId: { $in: cardIds } } }, { $group: { _id: '$cardId', n: { $sum: 1 } } }]),
      db.Event.distinct('cardId', { cardId: { $in: cardIds }, type: 'wallet_add' }),
    ]);
    const cmap = new Map(cards.map((c) => [String(c._id), c.status]));
    const dmap = new Map(devices.map((d) => [String(d._id), d.n]));
    const wset = new Set(wallets.map(String));

    return {
      total,
      page,
      limit,
      people,
      sync: integration ? { provider: integration.provider, when: relTime(integration.lastSyncAt), status: integration.status } : null,
      // Summary tiles as in the design; each one filters the table
      stats: [
        { id: 'live', label: 'Live cards', value: liveCards.toLocaleString(), dot: '#1F7A55' },
        { id: 'no-card', label: 'No card yet', value: withoutCard.toLocaleString(), dot: '#8E887E' },
        { id: 'pending', label: 'Waiting for approval', value: pendingCards.toLocaleString(), dot: '#B08D4F' },
        { id: 'leavers', label: 'Left the company', value: leavers.toLocaleString(), dot: '#A3283A' },
      ],
      joined,
      departments: departments.filter(Boolean).sort(),
      offices: offices.filter(Boolean).sort(),
      sources: sources.filter(Boolean).map((x: string) => ({ id: x, name: SOURCE[x] || x })),
      rows: rows.map((r) => {
        const st = r.cardId ? cmap.get(String(r.cardId)) : null;
        return {
          id: String(r._id),
          ini: initials(r.name),
          name: r.name,
          email: r.email,
          title: r.title,
          dept: r.department,
          office: r.office,
          photoUrl: r.photoUrl,
          cardId: r.cardId ? String(r.cardId) : null,
          status: r.status === 'leaver' ? 'Leaver' : st ? CARD_STATE[st] : 'No card',
          source: SOURCE[r.source] || r.source,
          devices: dmap.get(String(r.cardId)) || 0,
          nfc: (dmap.get(String(r.cardId)) || 0) > 0,
          wallet: r.cardId ? wset.has(String(r.cardId)) : false,
          startDate: r.startDate,
        };
      }),
    };
  }

  @Get('employees/export')
  async export(@CurrentUser() u: SessionUser, @Res() res: Response) {
    const rows = await db.Employee.find({ companyId: oid(u.companyId!) }).sort({ name: 1 }).lean<any[]>();
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="employees.csv"');
    res.send(
      toCsv(
        rows.map((r) => ({
          name: r.name, email: r.email, title: r.title, department: r.department, office: r.office,
          phone: r.phone, country: r.country, start_date: r.startDate, status: r.status, source: r.source,
        })),
      ),
    );
  }

  @Get('employees/:id')
  async get(@Param('id') id: string, @CurrentUser() u: SessionUser) {
    const e = found(await db.Employee.findOne({ _id: requireId(id), companyId: oid(u.companyId!) }).lean<any>(), 'Person');
    return { ...e, id: String(e._id) };
  }

  @Roles(...MANAGERS)
  @Post('employees')
  async create(@Body() body: unknown, @CurrentUser() u: SessionUser) {
    const data = parse(personSchema, body);
    const companyId = oid(u.companyId!);
    if (data.email && (await db.Employee.exists({ companyId, email: data.email.toLowerCase() }))) {
      throw new BadRequestException('Someone with this email already exists');
    }
    const e = await db.Employee.create({ ...data, startDate: data.startDate ? new Date(data.startDate) : undefined, companyId, source: 'manual' });
    await logActivity({ companyId, actor: u.name, action: 'employee.added', text: `${e.name} added` });
    return { id: String(e._id) };
  }

  @Roles(...MANAGERS)
  @Patch('employees/:id')
  async update(@Param('id') id: string, @Body() body: unknown, @CurrentUser() u: SessionUser) {
    const data = parse(personSchema.partial(), body);
    const e = found(
      await db.Employee.findOneAndUpdate(
        { _id: requireId(id), companyId: oid(u.companyId!) },
        { ...data, ...(data.startDate ? { startDate: new Date(data.startDate) } : {}) },
        { new: true },
      ),
      'Person',
    );
    // Keep card fields that follow HR in step
    if (e.cardId) {
      const card = await db.Card.findById(e.cardId);
      if (card) {
        for (const k of ['name', 'title', 'department', 'office', 'email', 'phone']) {
          if ((data as any)[k] !== undefined) (card.fields as any)[k] = (data as any)[k];
        }
        await card.save();
      }
    }
    return { ok: true };
  }

  /** Leaver: card off, wallet passes void, NFC disabled, sign-in removed. Leads stay with the company. */
  @Roles(...ADMINS)
  @Post('employees/:id/leave')
  async leave(@Param('id') id: string, @CurrentUser() u: SessionUser) {
    const e = found(await db.Employee.findOne({ _id: requireId(id), companyId: oid(u.companyId!) }), 'Person');
    e.status = 'leaver';
    await e.save();
    if (e.cardId) await deactivateCard(e.cardId, u.name, `${e.name} left the company`);
    await db.User.updateMany({ employeeId: e._id, role: 'member' }, { status: 'disabled' });
    return { ok: true };
  }

  @Roles(...MANAGERS)
  @Post('employees/import')
  async import(@Body() body: unknown, @CurrentUser() u: SessionUser) {
    const { csv, createCards } = parse(z.object({ csv: z.string().min(5).max(5_000_000), createCards: z.boolean().default(false) }), body);
    const companyId = oid(u.companyId!);
    const company = await db.Company.findById(companyId).lean<any>();
    const parsed = Papa.parse<Record<string, string>>(csv, { header: true, skipEmptyLines: true });
    let created = 0;
    let updated = 0;
    const skipped: string[] = [];
    for (const [i, row] of parsed.data.entries()) {
      const first = pick(row, ['firstname', 'givenname', 'first']);
      const last = pick(row, ['lastname', 'surname', 'familyname', 'last']);
      const name = pick(row, ['name', 'fullname', 'displayname']) || [first, last].filter(Boolean).join(' ');
      const email = pick(row, ['email', 'workemail', 'emailaddress', 'mail']).toLowerCase();
      if (!name) {
        skipped.push(`Row ${i + 2}: no name`);
        continue;
      }
      const start = pick(row, ['startdate', 'hiredate', 'joined']);
      const doc = {
        name,
        firstName: first || name.split(' ')[0],
        lastName: last || name.split(' ').slice(1).join(' '),
        email,
        title: pick(row, ['title', 'jobtitle', 'position', 'businesstitle']),
        department: pick(row, ['department', 'dept', 'team', 'businessunit']),
        office: pick(row, ['office', 'location', 'worklocation']),
        phone: pick(row, ['phone', 'workphone', 'telephone']),
        mobile: pick(row, ['mobile', 'cell', 'mobilephone']),
        country: pick(row, ['country']),
        startDate: start && !isNaN(Date.parse(start)) ? new Date(start) : undefined,
      };
      const existing = email ? await db.Employee.findOne({ companyId, email }) : null;
      let emp: any;
      if (existing) {
        Object.assign(existing, Object.fromEntries(Object.entries(doc).filter(([, v]) => v)));
        await existing.save();
        emp = existing.toObject();
        updated++;
      } else {
        emp = (await db.Employee.create({ ...doc, companyId, source: 'csv' })).toObject();
        created++;
      }
      if (createCards && !emp.cardId) {
        const card = await createCardForEmployee(company, emp, { actor: u.name });
        await publishCard(card._id, u);
      }
    }
    await logActivity({ companyId, actor: u.name, action: 'employees.imported', text: `CSV import: ${created} added, ${updated} updated` });
    return { created, updated, skipped, errors: parsed.errors.slice(0, 5).map((e) => e.message) };
  }

  @Roles(...MANAGERS)
  @Post('employees/bulk')
  async bulk(@Body() body: unknown, @CurrentUser() u: SessionUser) {
    const data = parse(
      z.object({
        ids: z.array(z.string()).min(1).max(2000),
        action: z.enum(['create-cards', 'assign-template', 'order-nfc']),
        templateId: z.string().optional(),
        material: z.string().optional(),
      }),
      body,
    );
    const companyId = oid(u.companyId!);
    const company = await db.Company.findById(companyId).lean<any>();
    const emps = await db.Employee.find({ companyId, _id: { $in: data.ids.map(requireId) }, status: 'active' }).lean<any[]>();

    if (data.action === 'create-cards') {
      let n = 0;
      for (const e of emps) {
        if (e.cardId) continue;
        const card = await createCardForEmployee(company, e, { actor: u.name });
        await publishCard(card._id, u);
        n++;
      }
      return { done: n, message: `${n} cards created` };
    }
    if (data.action === 'assign-template') {
      const t = found(await db.Template.findOne({ _id: requireId(data.templateId || ''), companyId }).lean<any>(), 'Template');
      const r = await db.Card.updateMany(
        { _id: { $in: emps.map((e) => e.cardId).filter(Boolean) } },
        { layout: t.layout, theme: t.theme, cover: t.cover, templateId: t._id },
      );
      return { done: r.modifiedCount, message: `Template applied to ${r.modifiedCount} cards` };
    }
    const items: { employee: any; card: any }[] = [];
    for (const e of emps) {
      const card = e.cardId ? await db.Card.findById(e.cardId).lean<any>() : await createCardForEmployee(company, e, { actor: u.name });
      items.push({ employee: e, card });
    }
    const order = await orderNfcFor(company, items, data.material || 'pvc_black', u.name);
    return { done: items.length, message: `Order ${order?.number} placed for ${items.length} cards` };
  }

  /* ---------- Departments ---------- */

  @Get('departments')
  async departments(@CurrentUser() u: SessionUser) {
    const companyId = oid(u.companyId!);
    const [rows, counts, cardCounts, templates] = await Promise.all([
      db.Department.find({ companyId }).sort({ name: 1 }).lean<any[]>(),
      db.Employee.aggregate([{ $match: { companyId, status: 'active' } }, { $group: { _id: '$department', n: { $sum: 1 } } }]),
      db.Card.aggregate([{ $match: { companyId, status: 'live' } }, { $group: { _id: '$fields.department', n: { $sum: 1 } } }]),
      db.Template.find({ companyId }).select('name departments').lean<any[]>(),
    ]);
    const pmap = new Map(counts.map((c) => [c._id, c.n]));
    const cmap = new Map(cardCounts.map((c) => [c._id, c.n]));
    // Departments seen in HR data but not yet saved are listed too
    const names = new Set([...rows.map((r) => r.name), ...counts.map((c) => c._id).filter(Boolean)]);
    return [...names].sort().map((name) => {
      const saved = rows.find((r) => r.name === name);
      const tpl = templates.find((t) => (saved?.templateId && String(t._id) === String(saved.templateId)) || t.departments?.includes(name));
      return {
        id: saved ? String(saved._id) : null,
        name,
        head: saved?.head || '',
        people: pmap.get(name) || 0,
        liveCards: cmap.get(name) || 0,
        template: tpl ? { id: String(tpl._id), name: tpl.name } : null,
      };
    });
  }

  @Roles(...MANAGERS)
  @Post('departments')
  async createDept(@Body() body: unknown, @CurrentUser() u: SessionUser) {
    const data = parse(z.object({ name: z.string().min(1).max(120), head: z.string().max(120).optional(), templateId: z.string().optional() }), body);
    const companyId = oid(u.companyId!);
    const d = await db.Department.findOneAndUpdate(
      { companyId, name: data.name },
      { head: data.head, templateId: data.templateId ? requireId(data.templateId) : undefined },
      { upsert: true, new: true },
    );
    if (data.templateId) {
      await db.Template.updateMany({ companyId }, { $pull: { departments: data.name } });
      await db.Template.updateOne({ _id: requireId(data.templateId), companyId }, { $addToSet: { departments: data.name } });
    }
    return { id: String(d._id) };
  }

  @Roles(...MANAGERS)
  @Delete('departments/:id')
  async deleteDept(@Param('id') id: string, @CurrentUser() u: SessionUser) {
    await db.Department.deleteOne({ _id: requireId(id), companyId: oid(u.companyId!) });
    return { ok: true };
  }
}
