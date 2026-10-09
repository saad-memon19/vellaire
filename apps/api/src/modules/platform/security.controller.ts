import { BadRequestException, Body, Controller, Get, Param, Post, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { z } from 'zod';
import { CurrentUser, Platform, SessionUser } from '../../common/auth';
import { deactivateCard } from '../../common/cards';
import { getSetting, setSetting } from '../../common/platform';
import { daysAgo, escapeRegex, found, logActivity, parse, relTime, requireId, toCsv } from '../../common/util';
import { db } from '../../db/db';
import { dayLabel } from './shared';

const KIND: Record<string, string> = { export_person: 'Export all data for one person', delete_person: 'Delete personal data', delete_company: 'Delete company workspace' };
const REVIEW_EVERY_DAYS = 90;
const DELETED = 'Deleted person';

/**
 * Collections that belong to one company and go when its workspace is deleted.
 * Invoices stay (accounting records) and so does the staff audit trail.
 */
const COMPANY_DATA = [
  'Department',
  'Employee',
  'Template',
  'Card',
  'Lead',
  'Event',
  'NfcDevice',
  'NfcOrder',
  'Integration',
  'SyncRun',
  'Ticket',
  'Note',
  'AiUsage',
  'User',
] as const;

@Platform()
@Controller('console')
export class ConsoleSecurityController {
  private auditFilter(q?: string) {
    const f: any = { platform: true };
    if (q) {
      const rx = new RegExp(escapeRegex(q), 'i');
      f.$or = [{ text: rx }, { actor: rx }, { action: rx }];
    }
    return f;
  }

  @Get('security')
  async overview(@Query('q') q?: string) {
    const [staff, impersonations, signins, lastReview, requests, log] = await Promise.all([
      db.User.countDocuments({ platformRole: 'staff', status: { $ne: 'disabled' } }),
      db.Activity.countDocuments({ action: 'impersonate', createdAt: { $gte: daysAgo(30) } }),
      db.Activity.countDocuments({ action: 'staff.signin', createdAt: { $gte: daysAgo(30) } }),
      getSetting<string | null>('security.lastAccessReview', null),
      db.DataRequest.find({ status: 'open' }).sort({ dueAt: 1 }).lean<any[]>(),
      db.Activity.find(this.auditFilter(q)).sort({ createdAt: -1 }).limit(60).lean<any[]>(),
    ]);
    const companyIds = [...requests.map((r) => r.companyId), ...log.map((l) => l.companyId)].filter(Boolean);
    const companies = await db.Company.find({ _id: { $in: companyIds } })
      .select('name')
      .lean<any[]>();
    const cmap = new Map(companies.map((c) => [String(c._id), c.name]));

    const nextReview = lastReview ? new Date(new Date(lastReview).getTime() + REVIEW_EVERY_DAYS * 86400_000) : null;
    const daysToReview = nextReview ? Math.ceil((+nextReview - Date.now()) / 86400_000) : null;

    return {
      kpis: [
        { label: 'Staff with access', value: String(staff), note: 'Vellaire team accounts' },
        { label: 'Impersonations · 30 days', value: String(impersonations), note: 'Each one logged with the company' },
        { label: 'Staff sign-ins · 30 days', value: String(signins), note: 'Console sign-ins' },
        {
          label: 'Next access review',
          value: daysToReview === null ? 'Due' : daysToReview <= 0 ? 'Overdue' : `${daysToReview} days`,
          note: lastReview ? `Last done ${dayLabel(new Date(lastReview))}` : `Every ${REVIEW_EVERY_DAYS} days`,
          tone: daysToReview === null || daysToReview <= 0 ? 'warn' : undefined,
        },
      ],
      requests: requests.map((r) => {
        const days = Math.ceil((+new Date(r.dueAt) - Date.now()) / 86400_000);
        return {
          id: String(r._id),
          kind: r.kind,
          title: `${KIND[r.kind]}${r.subjectEmail ? ` · ${r.subjectEmail}` : ''}`,
          company: cmap.get(String(r.companyId)) || 'Deleted workspace',
          due: days < 0 ? `${-days} days late` : days === 0 ? 'Due today' : `Due in ${days} days`,
          urgent: days <= 7,
        };
      }),
      log: log.map((l) => ({
        id: String(l._id),
        when: relTime(l.createdAt),
        who: l.actor || 'System',
        action: l.text,
        target: l.companyId ? cmap.get(String(l.companyId)) || '—' : 'Platform',
        ip: l.ip || '—',
      })),
      companies: (
        await db.Company.find({ status: { $ne: 'churned' } })
          .select('name')
          .sort({ name: 1 })
          .lean<any[]>()
      ).map((c) => ({ id: String(c._id), name: c.name })),
    };
  }

  @Get('security/export')
  async exportLog(@Query('q') q: string | undefined, @Res() res: Response) {
    const log = await db.Activity.find(this.auditFilter(q)).sort({ createdAt: -1 }).limit(5000).lean<any[]>();
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="vellaire-audit-log.csv"');
    res.send(toCsv(log.map((l) => ({ when: l.createdAt, who: l.actor, action: l.action, detail: l.text, company_id: l.companyId ? String(l.companyId) : '', ip: l.ip || '' }))));
  }

  /** Records that someone confirmed every staff account still needs its access. */
  @Post('security/access-review')
  async accessReview(@CurrentUser() u: SessionUser) {
    await setSetting('security.lastAccessReview', new Date().toISOString());
    const staff = await db.User.find({ platformRole: 'staff', status: { $ne: 'disabled' } })
      .select('email')
      .lean<any[]>();
    await logActivity({ actor: u.name, action: 'security.access_review', text: `Completed access review · ${staff.length} staff accounts confirmed`, platform: true });
    return { ok: true };
  }

  /* ---------- Data requests (GDPR and local privacy laws: one month to answer) ---------- */

  @Post('data-requests')
  async createRequest(@Body() body: unknown, @CurrentUser() u: SessionUser) {
    const d = parse(z.object({ companyId: z.string(), kind: z.enum(['export_person', 'delete_person', 'delete_company']), subjectEmail: z.string().email().optional() }), body);
    if (d.kind !== 'delete_company' && !d.subjectEmail) throw new BadRequestException('Which person is this about?');
    const company = found(await db.Company.findById(requireId(d.companyId)).select('name').lean<any>(), 'Company');
    await db.DataRequest.create({ ...d, subjectEmail: d.subjectEmail?.toLowerCase(), companyId: company._id, dueAt: new Date(Date.now() + 30 * 86400_000) });
    await logActivity({ companyId: company._id, actor: u.name, action: 'privacy.request', text: `Logged request: ${KIND[d.kind]}`, platform: true });
    return { ok: true };
  }

  /** The person's data as JSON: profile, card, sign-in account and NFC cards. */
  @Get('data-requests/:id/export')
  async exportPerson(@Param('id') id: string, @CurrentUser() u: SessionUser, @Res() res: Response) {
    const r = found(await db.DataRequest.findById(requireId(id)).lean<any>(), 'Request');
    if (r.kind !== 'export_person') throw new BadRequestException('This request is not an export');
    const employee = await db.Employee.findOne({ companyId: r.companyId, email: r.subjectEmail }).lean<any>();
    const [card, user, devices] = await Promise.all([
      employee?.cardId ? db.Card.findById(employee.cardId).lean<any>() : null,
      db.User.findOne({ email: r.subjectEmail }).select('email name role status lastLoginAt createdAt').lean<any>(),
      employee ? db.NfcDevice.find({ employeeId: employee._id }).select('material status lastTapAt createdAt').lean<any[]>() : [],
    ]);
    await db.DataRequest.updateOne({ _id: r._id }, { status: 'done', resolvedBy: u.name, resolvedAt: new Date() });
    await logActivity({ companyId: r.companyId, actor: u.name, action: 'privacy.export', text: `Exported personal data for ${r.subjectEmail}`, platform: true });
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="personal-data-${r.subjectEmail}.json"`);
    res.send(JSON.stringify({ exportedAt: new Date(), employee, card, account: user, nfcCards: devices }, null, 2));
  }

  @Post('data-requests/:id/resolve')
  async resolve(@Param('id') id: string, @Body() body: unknown, @CurrentUser() u: SessionUser) {
    const d = parse(z.object({ decision: z.enum(['approve', 'reject']), confirmName: z.string().optional() }), body);
    const r = found(await db.DataRequest.findById(requireId(id)), 'Request');
    if (r.status !== 'open') throw new BadRequestException('This request is already closed');

    if (d.decision === 'approve') {
      if (r.kind === 'delete_person') await this.deletePerson(r.companyId, r.subjectEmail!, u.name);
      if (r.kind === 'delete_company') {
        const company = found(await db.Company.findById(r.companyId).lean<any>(), 'Company');
        if (d.confirmName?.trim() !== company.name) throw new BadRequestException('Type the company name exactly to confirm');
        await this.deleteCompany(company);
      }
      if (r.kind === 'export_person') throw new BadRequestException('Download the export to complete this request');
    }
    Object.assign(r, { status: d.decision === 'approve' ? 'done' : 'rejected', resolvedBy: u.name, resolvedAt: new Date() });
    await r.save();
    await logActivity({
      companyId: r.companyId,
      actor: u.name,
      action: 'privacy.resolved',
      text: `${d.decision === 'approve' ? 'Completed' : 'Rejected'}: ${KIND[r.kind]}${r.subjectEmail ? ` · ${r.subjectEmail}` : ''}`,
      platform: true,
    });
    return { ok: true };
  }

  /** Removes a person's details everywhere; leads they collected stay with the company, unattributed. */
  private async deletePerson(companyId: unknown, email: string, actor: string) {
    const employee = await db.Employee.findOne({ companyId, email });
    if (employee?.cardId) {
      await deactivateCard(employee.cardId, actor, 'Personal data deleted');
      await db.Card.updateOne({ _id: employee.cardId }, { fields: { name: DELETED }, links: [], translations: {}, 'approval.pendingPhoto': null });
    }
    if (employee) {
      await db.NfcDevice.updateMany({ employeeId: employee._id }, { holderName: DELETED, status: 'disabled' });
      await db.Lead.updateMany({ employeeId: employee._id }, { ownerName: 'Former employee' });
      employee.set({ name: DELETED, firstName: undefined, lastName: undefined, email: undefined, phone: undefined, mobile: undefined, photoUrl: undefined, status: 'leaver' });
      await employee.save();
    }
    await db.User.deleteOne({ companyId, email, platformRole: { $ne: 'staff' } });
  }

  /** Deletes every record the company owns and strips the company to the name its invoices need. */
  private async deleteCompany(company: any) {
    for (const model of COMPANY_DATA) await db[model].deleteMany({ companyId: company._id });
    await db.Activity.deleteMany({ companyId: company._id, platform: { $ne: true } });
    await db.Company.updateOne(
      { _id: company._id },
      { $set: { status: 'churned', churnedAt: company.churnedAt || new Date() }, $unset: { brand: 1, settings: 1, domain: 1, couponCode: 1 } },
    );
  }
}
