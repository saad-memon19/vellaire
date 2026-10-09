import { BadRequestException, NotFoundException } from '@nestjs/common';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';
import { z, ZodTypeAny } from 'zod';
import { db } from '../db/db';
import { requestContext } from './context';
import { isOid, oid } from '../db/schemas';

/** Validate a request body; throws 400 with the first problem. */
export function parse<S extends ZodTypeAny>(schema: S, body: unknown): z.infer<S> {
  const r = schema.safeParse(body);
  if (!r.success) {
    const i = r.error.issues[0];
    throw new BadRequestException(`${i.path.join('.') || 'body'}: ${i.message}`);
  }
  return r.data;
}

export function requireId(id: string) {
  if (!isOid(id)) throw new NotFoundException('Not found');
  return oid(id);
}

export function found<T>(doc: T, what = 'Item'): NonNullable<T> {
  if (!doc) throw new NotFoundException(`${what} not found`);
  return doc as NonNullable<T>;
}

export const slugify = (s: string) =>
  s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'card';

export const initials = (name = '') =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('');

export const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');
export const token = (bytes = 24) => randomBytes(bytes).toString('base64url');
export const shortId = (len = 10) =>
  randomBytes(len).toString('base64url').replace(/[-_]/g, '').slice(0, len).toLowerCase();

export const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Start of the UTC day n days ago (charts group by UTC day). */
export function daysAgo(n: number) {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - n);
  return d;
}

export function rangeDays(range?: string) {
  const n = Number(String(range || '30').replace(/\D/g, '')) || 30;
  return Math.min(Math.max(n, 1), 365);
}

export function pct(cur: number, prev: number) {
  if (!prev) return cur ? 100 : 0;
  return Math.round(((cur - prev) / prev) * 100);
}

export function paging(q: { page?: string; limit?: string }) {
  const limit = Math.min(Math.max(Number(q.limit) || 10, 1), 200);
  const page = Math.max(Number(q.page) || 1, 1);
  return { limit, page, skip: (page - 1) * limit };
}

export function toCsv(rows: Record<string, unknown>[]) {
  if (!rows.length) return '';
  const cols = Object.keys(rows[0]!);
  const esc = (v: unknown) => {
    const s = v == null ? '' : v instanceof Date ? v.toISOString() : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n');
}

export function relTime(d?: Date | string | null) {
  if (!d) return '—';
  const t = new Date(d).getTime();
  const s = Math.round((Date.now() - t) / 1000);
  if (s < 0) {
    return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  }
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  if (s < 2 * 86400) return 'yesterday';
  if (s < 7 * 86400) return `${Math.floor(s / 86400)} days ago`;
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

/** Write to the activity log (card history, company timeline, console). */
export async function logActivity(entry: {
  companyId?: unknown;
  cardId?: unknown;
  actor?: string;
  action: string;
  text: string;
  meta?: unknown;
  platform?: boolean;
}) {
  try {
    // Staff actions keep the address they came from, for the security audit
    await db.Activity.create(entry.platform ? { ...entry, ip: requestContext()?.ip } : entry);
  } catch (e) {
    console.error('activity log failed', e);
  }
}

/** Unique card slug inside a company: sara-khan, sara-khan-2, ... */
export async function uniqueSlug(companyId: unknown, base: string, exceptCardId?: unknown) {
  const root = slugify(base);
  for (let i = 0; i < 500; i++) {
    const slug = i === 0 ? root : `${root}-${i + 1}`;
    const q: any = { companyId, slug };
    if (exceptCardId) q._id = { $ne: exceptCardId };
    if (!(await db.Card.exists(q))) return slug;
  }
  return `${root}-${shortId(4)}`;
}

/* Secrets at rest (HR credentials): AES-256-GCM with a key derived from ENCRYPTION_KEY (or JWT_SECRET). */
const secretKey = () => createHash('sha256').update(process.env.ENCRYPTION_KEY || process.env.JWT_SECRET || 'dev-secret').digest();

export function encryptJson(value: unknown) {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', secretKey(), iv);
  const data = Buffer.concat([c.update(JSON.stringify(value), 'utf8'), c.final()]);
  return { enc: Buffer.concat([iv, c.getAuthTag(), data]).toString('base64') };
}

export function decryptJson<T = any>(stored: any): T | null {
  if (!stored) return null;
  if (!stored.enc) return stored as T; // older plain records
  const buf = Buffer.from(stored.enc, 'base64');
  const d = createDecipheriv('aes-256-gcm', secretKey(), buf.subarray(0, 12));
  d.setAuthTag(buf.subarray(12, 28));
  return JSON.parse(Buffer.concat([d.update(buf.subarray(28)), d.final()]).toString('utf8'));
}
