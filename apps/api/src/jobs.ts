import { Controller, Get, Headers, Injectable, Logger, NotFoundException, OnApplicationBootstrap, OnApplicationShutdown, Param, UnauthorizedException } from '@nestjs/common';
import { timingSafeEqual } from 'crypto';
import { config } from './config';
import { Public } from './common/auth';
import { publishDueCards } from './common/cards';
import { ensureLibrary, ensurePlatformAdmins, loadPlans } from './common/platform';
import { db } from './db/db';
import { fetchRecords } from './modules/integrations/fetchers';
import { executeSync, planSync } from './modules/integrations/sync';
import { sampleHealth } from './modules/platform/health-checks';

const log = new Logger('Jobs');

/** Every background task, by name. Each returns a short summary, or null when nothing happened. */
export const TASKS: Record<string, () => Promise<string | null>> = {
  // Scheduled cards whose start date has come go live
  publish: async () => {
    const n = await publishDueCards();
    return n ? `${n} scheduled cards went live` : null;
  },
  // Connected HR systems sync joiners, movers and leavers
  'hr-sync': syncAll,
  // Trials that ended are marked past due
  trials: async () => {
    const r = await db.Company.updateMany({ status: 'trial', trialEndsAt: { $lt: new Date() } }, { status: 'past_due' });
    return r.modifiedCount ? `${r.modifiedCount} trials ended` : null;
  },
  // Service checks are saved for System health
  health: async () => {
    await sampleHealth();
    return null;
  },
};

async function syncAll() {
  const list = await db.Integration.find({ status: 'connected', provider: { $in: ['workday', 'sap', 'bamboohr'] } })
    .select('+credentials')
    .lean<any[]>();
  let synced = 0;
  for (const i of list) {
    if (!i.credentials || !Object.keys(i.credentials).length) continue;
    try {
      const company = await db.Company.findById(i.companyId).lean<any>();
      if (!company || ['suspended', 'churned'].includes(company.status)) continue;
      const plan = await planSync(company, i, await fetchRecords(i));
      await executeSync(company, i, plan, 'Hourly sync');
      synced++;
    } catch (e) {
      await db.Integration.updateOne({ _id: i._id }, { status: 'error', lastError: (e as Error).message });
    }
  }
  return synced ? `${synced} HR systems synced` : null;
}

/**
 * On a normal server (local or long-running) the tasks run on timers inside the API.
 * On Vercel the process sleeps between requests, so Vercel Cron calls /cron/<task> instead.
 * Plans and the template library get their defaults on start either way.
 */
@Injectable()
export class Jobs implements OnApplicationBootstrap, OnApplicationShutdown {
  private timers: NodeJS.Timeout[] = [];
  private running = new Set<string>();

  async onApplicationBootstrap() {
    await loadPlans();
    await ensureLibrary();
    await ensurePlatformAdmins();
    if (config.serverless || process.env.DISABLE_JOBS === '1') return;
    this.every(60_000, 'publish');
    this.every(5 * 60_000, 'health');
    this.every(60 * 60_000, 'hr-sync');
    this.every(60 * 60_000, 'trials');
  }

  onApplicationShutdown() {
    this.timers.forEach(clearInterval);
  }

  private every(ms: number, name: string) {
    const run = async () => {
      if (this.running.has(name)) return;
      this.running.add(name);
      try {
        const summary = await TASKS[name]!();
        if (summary) log.log(summary);
      } catch (e) {
        log.error(`${name} failed: ${(e as Error).message}`);
      } finally {
        this.running.delete(name);
      }
    };
    this.timers.push(setInterval(run, ms));
  }
}

/** Vercel Cron entry point. Vercel sends `Authorization: Bearer <CRON_SECRET>`. */
@Controller('cron')
export class CronController {
  @Public()
  @Get(':task')
  async run(@Param('task') task: string, @Headers('authorization') auth?: string) {
    const expected = `Bearer ${config.cronSecret}`;
    const ok = !!config.cronSecret && !!auth && auth.length === expected.length && timingSafeEqual(Buffer.from(auth), Buffer.from(expected));
    if (!ok) throw new UnauthorizedException();
    if (!TASKS[task]) throw new NotFoundException('Unknown task');
    return { task, result: await TASKS[task]() };
  }
}
