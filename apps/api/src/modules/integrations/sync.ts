import { createCardForEmployee, deactivateCard, orderNfcFor, publishCard } from '../../common/cards';
import { logActivity } from '../../common/util';
import { db } from '../../db/db';

/** Card / person fields an HR field can fill. */
export const TARGETS: { id: string; label: string }[] = [
  { id: 'hrId', label: 'HR ID' },
  { id: 'firstName', label: 'First name' },
  { id: 'lastName', label: 'Last name' },
  { id: 'name', label: 'Full name' },
  { id: 'email', label: 'Work email' },
  { id: 'title', label: 'Job title' },
  { id: 'department', label: 'Department' },
  { id: 'office', label: 'Office' },
  { id: 'country', label: 'Country' },
  { id: 'phone', label: 'Work phone' },
  { id: 'mobile', label: 'Mobile' },
  { id: 'startDate', label: 'Start date' },
  { id: 'workerType', label: 'Worker type' },
  { id: 'photoUrl', label: 'Photo' },
];

const SYNONYMS: Record<string, string[]> = {
  hrId: ['employeeid', 'workerid', 'id', 'employeenumber', 'personid', 'userid'],
  firstName: ['firstname', 'givenname', 'legalfirstname', 'preferredfirstname', 'first'],
  lastName: ['lastname', 'surname', 'familyname', 'legallastname', 'last'],
  name: ['name', 'fullname', 'displayname', 'preferredname', 'workername'],
  email: ['email', 'workemail', 'emailaddress', 'primaryworkemail', 'mail', 'username'],
  title: ['title', 'jobtitle', 'businesstitle', 'position', 'positiontitle', 'jobprofile'],
  department: ['department', 'supervisoryorganization', 'costcenter', 'division', 'team', 'businessunit', 'organization'],
  office: ['office', 'location', 'worklocation', 'site', 'primaryworkaddress'],
  country: ['country', 'locationcountry', 'workcountry'],
  phone: ['phone', 'workphone', 'businessphone', 'telephone', 'phonenumber'],
  mobile: ['mobile', 'mobilephone', 'cellphone', 'cell'],
  startDate: ['startdate', 'hiredate', 'originalhiredate', 'joindate', 'continuousservicedate'],
  workerType: ['workertype', 'employeetype', 'employmenttype', 'workersubtype'],
  photoUrl: ['photo', 'photourl', 'image', 'profilephoto'],
};
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

/** Rule-based matching by common field names. AI can improve unclear ones. */
export function autoMap(sources: { src: string; sample?: string }[]) {
  return sources.map(({ src, sample }) => {
    const n = norm(src);
    const hit = Object.entries(SYNONYMS).find(([, names]) => names.includes(n))?.[0];
    return { src, sample: sample || '', dst: hit || '', sourceOfTruth: 'hr', match: hit ? 'auto' : 'manual', accepted: !!hit };
  });
}

export function sampleFields(records: any[]) {
  const first = records[0] || {};
  return Object.keys(first).map((k) => ({ src: k, sample: String(first[k] ?? '').slice(0, 60) }));
}

export function toPerson(record: any, mapping: { src: string; dst: string; accepted?: boolean }[]) {
  const p: any = {};
  for (const m of mapping) {
    if (!m.dst || m.accepted === false) continue;
    const v = record[m.src];
    if (v === undefined || v === null || v === '') continue;
    p[m.dst] = typeof v === 'string' ? v.trim() : v;
  }
  if (!p.name && (p.firstName || p.lastName)) p.name = [p.firstName, p.lastName].filter(Boolean).join(' ');
  if (p.email) p.email = String(p.email).toLowerCase();
  if (p.startDate) {
    const d = new Date(p.startDate);
    p.startDate = isNaN(d.getTime()) ? undefined : d;
  }
  if (p.hrId !== undefined) p.hrId = String(p.hrId);
  return p;
}

const COMPARE = ['name', 'email', 'title', 'department', 'office', 'country', 'phone', 'mobile', 'workerType'];

export interface SyncPlan {
  create: any[];
  update: { employee: any; changes: Record<string, any> }[];
  leave: any[];
  skipped: { name: string; reason: string }[];
  issues: string[];
  guardTripped: boolean;
  guardMessage?: string;
}

export async function planSync(company: any, integration: any, records: any[]): Promise<SyncPlan> {
  const plan: SyncPlan = { create: [], update: [], leave: [], skipped: [], issues: [], guardTripped: false };
  const existing = await db.Employee.find({ companyId: company._id }).lean<any[]>();
  const byHr = new Map(existing.filter((e) => e.hrId).map((e) => [e.hrId, e]));
  const byEmail = new Map(existing.filter((e) => e.email).map((e) => [e.email, e]));
  const seen = new Set<string>();
  const skipTypes = (integration.rules?.skipWorkerTypes || []).map((s: string) => s.toLowerCase());
  let noEmail = 0;

  for (const r of records) {
    const p = toPerson(r, integration.mapping || []);
    // Anyone still in the feed is not a leaver, even if their record is skipped below
    const known = (p.hrId && byHr.get(p.hrId)) || (p.email && byEmail.get(p.email));
    if (known) seen.add(String(known._id));
    if (!p.name) {
      plan.skipped.push({ name: '(no name)', reason: 'No name' });
      continue;
    }
    if (p.workerType && skipTypes.includes(String(p.workerType).toLowerCase())) {
      plan.skipped.push({ name: p.name, reason: `Worker type is ${p.workerType}` });
      continue;
    }
    if (!p.email) {
      noEmail++;
      plan.skipped.push({ name: p.name, reason: 'No work email' });
      continue;
    }
    const match = (p.hrId && byHr.get(p.hrId)) || byEmail.get(p.email);
    if (match) {
      seen.add(String(match._id));
      const changes: Record<string, any> = {};
      for (const k of COMPARE) if (p[k] !== undefined && String(p[k] ?? '') !== String(match[k] ?? '')) changes[k] = p[k];
      if (p.hrId && !match.hrId) changes.hrId = p.hrId;
      if (match.status === 'leaver') changes.status = 'active';
      if (Object.keys(changes).length) plan.update.push({ employee: match, changes });
    } else {
      plan.create.push(p);
    }
  }
  if (noEmail) plan.issues.push(`${noEmail} workers have no work email. Fix them in your HR system or add emails here.`);

  // Leavers: synced from this provider, still active, missing from the feed
  plan.leave = existing.filter((e) => e.source === integration.provider && e.status === 'active' && !seen.has(String(e._id)));
  const synced = existing.filter((e) => e.source === integration.provider && e.status === 'active').length;
  const limit = Math.ceil((synced * (integration.guardPct ?? 10)) / 100);
  if (synced > 0 && plan.leave.length > Math.max(limit, 2)) {
    plan.guardTripped = true;
    plan.guardMessage = `This sync would switch off ${plan.leave.length} of ${synced} cards (over ${integration.guardPct ?? 10}%). It is paused for your review.`;
  }
  return plan;
}

function designOverride(integration: any, person: any) {
  const rule = (integration.rules?.templateByCountry || []).find((r: any) =>
    (r.countries || []).some((c: string) => c.toLowerCase() === String(person.country || '').toLowerCase()),
  );
  return rule ? { layout: rule.layout, ...(rule.theme ? { theme: rule.theme } : {}) } : undefined;
}

export async function executeSync(company: any, integration: any, plan: SyncPlan, trigger: string, force = false) {
  const run = await db.SyncRun.create({
    companyId: company._id,
    integrationId: integration._id,
    provider: integration.provider,
    dryRun: false,
    trigger,
    skipped: plan.skipped.length,
    issues: plan.issues,
  });
  if (plan.guardTripped && !force) {
    run.status = 'paused';
    run.issues = [...plan.issues, plan.guardMessage!];
    run.finishedAt = new Date();
    await run.save();
    await db.Integration.updateOne({ _id: integration._id }, { status: 'paused', lastError: plan.guardMessage });
    await logActivity({ companyId: company._id, actor: 'Sync guard', action: 'sync.paused', text: plan.guardMessage! });
    return run;
  }

  const actor = { name: `${providerName(integration.provider)} sync`, role: 'admin' };
  const nfcItems: { employee: any; card: any }[] = [];

  for (const p of plan.create) {
    const employee = (await db.Employee.create({ ...p, companyId: company._id, source: integration.provider })).toObject();
    const card = await createCardForEmployee(company, employee, { actor: actor.name, overrides: designOverride(integration, p) });
    if (integration.rules?.joinersToApproval) {
      await db.Card.updateOne(
        { _id: card._id },
        { status: 'pending_approval', publishAt: p.startDate, approval: { requestedBy: actor.name, requestedAt: new Date(), reason: 'New joiner from HR' } },
      );
    } else {
      await publishCard(card._id, actor, { publishAt: p.startDate || null, skipApproval: true });
    }
    if (company.settings?.autoOrderNfc) nfcItems.push({ employee, card });
    run.created++;
  }

  for (const { employee, changes } of plan.update) {
    await db.Employee.updateOne({ _id: employee._id }, changes);
    if (employee.cardId) {
      const card = await db.Card.findById(employee.cardId);
      if (card) {
        for (const k of Object.keys(changes)) {
          if (card.syncedFields.includes(k)) (card.fields as any)[k] = changes[k];
        }
        if (changes.status === 'active' && card.status === 'deactivated') card.status = 'live';
        await card.save();
        if (Object.keys(changes).some((k) => card.syncedFields.includes(k))) {
          await logActivity({ companyId: company._id, cardId: card._id, actor: actor.name, action: 'card.synced', text: `Updated from HR: ${Object.keys(changes).join(', ')}` });
        }
      }
    }
    run.updated++;
  }

  for (const e of plan.leave) {
    await db.Employee.updateOne({ _id: e._id }, { status: 'leaver' });
    if (e.cardId) await deactivateCard(e.cardId, actor.name, `${e.name} left (from HR)`);
    await db.User.updateMany({ employeeId: e._id, role: 'member' }, { status: 'disabled' });
    run.deactivated++;
  }

  if (nfcItems.length) await orderNfcFor(company, nfcItems, company.settings?.autoOrderMaterial || 'pvc_black', actor.name, true);

  run.status = 'done';
  run.finishedAt = new Date();
  await run.save();
  await db.Integration.updateOne({ _id: integration._id }, { status: 'connected', lastSyncAt: new Date(), lastError: null });
  await logActivity({
    companyId: company._id,
    actor: actor.name,
    action: 'sync.done',
    text: `${providerName(integration.provider)} sync: ${run.created} created, ${run.updated} updated, ${run.deactivated} switched off`,
  });
  return run;
}

export function providerName(p: string) {
  return ({ workday: 'Workday', sap: 'SAP SuccessFactors', bamboohr: 'BambooHR', entra: 'Microsoft Entra ID', scim: 'SCIM' } as Record<string, string>)[p] || p;
}
