/** Small helpers shared by the console's platform pages. */

export const money = (n: number) => `$${Math.round(n).toLocaleString()}`;

/** UTC month key: 2026-10 */
export const monthKey = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;

/** First instant of the UTC month `offset` months from now (negative = past). */
export const monthStart = (offset = 0) => {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + offset, 1));
};

/** The last `n` UTC months, oldest first. */
export const lastMonths = (n: number) => Array.from({ length: n }, (_, i) => monthStart(i - n + 1));

export const monthLabel = (d: Date, withYear = false) => d.toLocaleDateString('en-GB', { month: 'short', ...(withYear ? { year: 'numeric' } : {}), timeZone: 'UTC' });

export const share = (part: number, whole: number) => (whole ? Math.round((part / whole) * 100) : 0);

export const dayLabel = (d?: Date | null) => (d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : '—');
