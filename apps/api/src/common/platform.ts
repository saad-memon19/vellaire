import { createHash } from 'crypto';
import { config, PLANS, PlanId } from '../config';
import { db } from '../db/db';
import { LAYOUTS } from './catalog';

/* ---------- Key/value settings ---------- */

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const row = await db.PlatformSetting.findOne({ key }).lean<any>();
  return row ? (row.value as T) : fallback;
}

export async function setSetting(key: string, value: unknown) {
  await db.PlatformSetting.updateOne({ key }, { value }, { upsert: true });
}

/* ---------- Plans ---------- */

const PLAN_DEFAULTS: Record<PlanId, { features: [string, boolean][]; limits: Record<string, string | number | null> }> = {
  starter: {
    features: [
      ['Brand kit and templates', true],
      ['QR and wallet passes', true],
      ['CSV import', true],
      ['HR and SSO integrations', false],
      ['Approvals and sub-brands', false],
      ['Custom domain', false],
    ],
    limits: { subBrands: '1', hrConnections: '—', aiCredits: 20, admins: '3', support: 'Email' },
  },
  professional: {
    features: [
      ['Brand kit and templates', true],
      ['QR and wallet passes', true],
      ['HR, SCIM and CRM integrations', true],
      ['Approvals and sub-brands', true],
      ['Custom domain', true],
      ['Data residency choice', false],
    ],
    limits: { subBrands: '5', hrConnections: '2', aiCredits: 100, admins: '15', support: 'Priority chat' },
  },
  enterprise: {
    features: [
      ['Everything in Professional', true],
      ['Workday, SAP, Oracle, custom API', true],
      ['Data residency choice', true],
      ['Audit export and IP allow-list', true],
      ['Named account manager', true],
      ['Bespoke template design', true],
    ],
    limits: { subBrands: 'Unlimited', hrConnections: 'Unlimited', aiCredits: null, admins: 'Unlimited', support: 'Account manager and SLA' },
  },
};

/** Copies a stored plan into the live PLANS object so every price calculation uses it. */
export function applyPlan(p: { key: string; name: string; pricePerSeat: number; minSeats: number }) {
  if (p.key in PLANS) PLANS[p.key as PlanId] = { name: p.name, pricePerSeat: p.pricePerSeat, minSeats: p.minSeats };
}

/** AI credits per live card per month; null = no limit. */
const aiCredits = new Map<string, number | null>();
export const aiCreditsFor = (plan: string) => (aiCredits.has(plan) ? aiCredits.get(plan)! : 20);

export async function loadPlans() {
  for (const [key, terms] of Object.entries(PLANS)) {
    const d = PLAN_DEFAULTS[key as PlanId];
    await db.Plan.updateOne(
      { key },
      { $setOnInsert: { key, ...terms, features: d.features.map(([name, on]) => ({ name, on })), limits: d.limits, history: [] } },
      { upsert: true },
    );
  }
  for (const p of await db.Plan.find().lean<any[]>()) {
    applyPlan(p);
    aiCredits.set(p.key, p.limits?.aiCredits ?? null);
  }
}

export function refreshPlanCache(p: any) {
  applyPlan(p);
  aiCredits.set(p.key, p.limits?.aiCredits ?? null);
}

/* ---------- Staff accounts ---------- */

/** Every PLATFORM_ADMIN_EMAILS address gets a console account, so a fresh database can be signed into. */
export async function ensurePlatformAdmins() {
  for (const email of config.platformAdmins) {
    await db.User.updateOne({ email }, { $setOnInsert: { email, name: email.split('@')[0], platformRole: 'staff' } }, { upsert: true });
  }
}

/* ---------- Template library ---------- */

export async function ensureLibrary() {
  if (await db.LibraryTemplate.estimatedDocumentCount()) return;
  await db.LibraryTemplate.insertMany(LAYOUTS.map((l) => ({ name: l.name, layout: l.id, theme: 'obsidian_gold', status: 'live' })));
}

/* ---------- Feature flags ---------- */

/** Stable 0–99 bucket, so a company stays in or out of a rollout as the percentage grows. */
const bucket = (key: string, companyId: string) => parseInt(createHash('sha1').update(`${key}:${companyId}`).digest('hex').slice(0, 8), 16) % 100;

export function flagOn(flag: any, company: { _id: unknown; plan?: string; dataRegion?: string }) {
  if (!flag.on) return false;
  const id = String(company._id);
  if ((flag.companyIds || []).some((c: unknown) => String(c) === id)) return true;
  if (flag.plans?.length && !flag.plans.includes(company.plan)) return false;
  if (flag.regions?.length && !flag.regions.includes(company.dataRegion)) return false;
  return bucket(flag.key, id) < (flag.rolloutPct ?? 0);
}

/** Keys of every flag that is on for this company. */
export async function flagsFor(company: any) {
  const flags = await db.FeatureFlag.find({ on: true }).lean<any[]>();
  return flags.filter((f) => flagOn(f, company)).map((f) => f.key as string);
}
