import { AsyncLocalStorage } from 'async_hooks';
import type { NextFunction, Request, Response } from 'express';

/** Per-request facts that deep code (audit log, AI usage) needs without threading them through every call. */
export interface RequestContext {
  ip?: string;
  companyId?: string | null;
}

const store = new AsyncLocalStorage<RequestContext>();

export const requestContext = () => store.getStore();

/* ---------- Response-time samples for System health ---------- */

const WINDOW = 2000;
const samples: { ms: number; path: string; at: number }[] = [];

function record(ms: number, path: string) {
  samples.push({ ms, path, at: Date.now() });
  if (samples.length > WINDOW) samples.splice(0, samples.length - WINDOW);
}

/** Percentile of response times in the last hour, optionally for paths starting with `prefix`. */
export function responseTime(p: number, prefix = '') {
  const since = Date.now() - 60 * 60_000;
  const list = samples
    .filter((s) => s.at >= since && s.path.startsWith(prefix))
    .map((s) => s.ms)
    .sort((a, b) => a - b);
  if (!list.length) return null;
  return Math.round(list[Math.min(list.length - 1, Math.floor((p / 100) * list.length))]!);
}

/** Express middleware: opens the context and times the response. */
export function contextMiddleware(req: Request, res: Response, next: NextFunction) {
  const started = process.hrtime.bigint();
  res.on('finish', () => record(Number(process.hrtime.bigint() - started) / 1e6, req.path));
  store.run({ ip: req.ip }, next);
}
