import mongoose from 'mongoose';
import { config } from '../../config';
import { responseTime } from '../../common/context';
import { daysAgo } from '../../common/util';
import { db } from '../../db/db';
import { appleReady, googleReady } from '../public/wallet';

export type ServiceStatus = 'healthy' | 'degraded' | 'down' | 'off';
export interface ServiceCheck {
  id: string;
  name: string;
  desc: string;
  status: ServiceStatus;
  note: string;
}

const RANK: Record<ServiceStatus, number> = { off: 0, healthy: 1, degraded: 2, down: 3 };
const worst = (a: ServiceStatus, b: ServiceStatus) => (RANK[a] >= RANK[b] ? a : b);

async function reachable(url: string) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    return res.status < 500;
  } catch {
    return false;
  }
}

async function databaseUp() {
  try {
    await mongoose.connection.db?.admin().ping();
    return true;
  } catch {
    return false;
  }
}

/** Checks every service the product depends on, right now. */
export async function checkServices(): Promise<ServiceCheck[]> {
  const hourAgo = new Date(Date.now() - 60 * 60_000);
  const [dbUp, webUp, hrBroken, hrPaused, mailDay, mailFailed, aiHour, aiFailed] = await Promise.all([
    databaseUp(),
    // A small static file: the home page can take seconds to build in development
    reachable(`${config.webUrl}/icon.svg`),
    db.Integration.countDocuments({ status: 'error' }),
    db.Integration.countDocuments({ status: 'paused' }),
    db.EmailLog.countDocuments({ ts: { $gte: daysAgo(1) } }),
    db.EmailLog.countDocuments({ ts: { $gte: daysAgo(1) }, delivered: false }),
    db.AiUsage.countDocuments({ ts: { $gte: hourAgo } }),
    db.AiUsage.countDocuments({ ts: { $gte: hourAgo }, ok: false }),
  ]);
  const p95 = responseTime(95);
  const publicP50 = responseTime(50, '/public');

  return [
    {
      id: 'cards',
      name: 'Public card pages',
      desc: 'What clients open after a tap or scan',
      status: !dbUp ? 'down' : publicP50 !== null && publicP50 > 1500 ? 'degraded' : 'healthy',
      note: publicP50 === null ? 'No card opened in the last hour' : `Median ${publicP50} ms`,
    },
    { id: 'web', name: 'Company dashboard', desc: 'Web app', status: webUp ? 'healthy' : 'down', note: webUp ? 'Reachable' : `${config.webUrl} did not answer` },
    {
      id: 'api',
      name: 'API',
      desc: 'REST and SCIM',
      status: p95 !== null && p95 > 2000 ? 'degraded' : 'healthy',
      note: p95 === null ? 'No traffic in the last hour' : `95% of requests under ${p95} ms`,
    },
    { id: 'database', name: 'Database', desc: 'MongoDB Atlas', status: dbUp ? 'healthy' : 'down', note: dbUp ? 'Connected' : 'Not answering' },
    {
      id: 'hr',
      name: 'HR sync workers',
      desc: 'Background jobs',
      status: hrBroken ? 'degraded' : 'healthy',
      note: hrBroken || hrPaused ? `${hrBroken} with errors · ${hrPaused} paused by the guard` : 'Every connection is syncing',
    },
    { id: 'apple', name: 'Apple Wallet updates', desc: 'Pass signing', status: appleReady() ? 'healthy' : 'off', note: appleReady() ? 'Certificates loaded' : 'Not set up yet' },
    {
      id: 'google',
      name: 'Google Wallet updates',
      desc: 'Wallet API',
      status: googleReady() ? 'healthy' : 'off',
      note: googleReady() ? 'Service account loaded' : 'Not set up yet',
    },
    {
      id: 'email',
      name: 'Email delivery',
      desc: 'Transactional email',
      status: !config.mail.resendKey ? 'off' : mailDay && mailFailed / mailDay > 0.1 ? 'degraded' : 'healthy',
      note: !config.mail.resendKey ? 'No email key yet · emails print to the API log' : `${mailDay - mailFailed} of ${mailDay} delivered today`,
    },
    {
      id: 'ai',
      name: 'AI gateway',
      desc: 'Language model provider',
      status: config.ai.provider === 'none' ? 'off' : aiHour && aiFailed / aiHour > 0.1 ? 'degraded' : 'healthy',
      note: config.ai.provider === 'none' ? 'AI is switched off' : aiHour ? `${aiHour - aiFailed} of ${aiHour} requests answered this hour` : 'No requests this hour',
    },
  ];
}

/** Saves the worst status of the day per service, for the 30-day bars. */
export async function sampleHealth() {
  const day = new Date().toISOString().slice(0, 10);
  for (const s of await checkServices()) {
    if (s.status === 'off') continue;
    const prev = await db.HealthSample.findOne({ service: s.id, day }).lean<any>();
    const status = prev ? worst(prev.status, s.status) : s.status;
    await db.HealthSample.updateOne({ service: s.id, day }, { status }, { upsert: true });
  }
}
