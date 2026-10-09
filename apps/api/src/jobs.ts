import { Injectable, Logger, OnApplicationShutdown, OnApplicationBootstrap } from '@nestjs/common';
import { publishDueCards } from './common/cards';
import { ensureLibrary, loadPlans } from './common/platform';
import { db } from './db/db';
import { fetchRecords } from './modules/integrations/fetchers';
import { executeSync, planSync } from './modules/integrations/sync';
import { sampleHealth } from './modules/platform/health-checks';

/**
 * Background work that runs inside the API process:
 * - every minute: scheduled cards whose start date has come go live
 * - every hour: connected HR systems sync (joiners, movers, leavers)
 * - every hour: trials that ended are marked past due
 * - every 5 minutes: service checks are saved for System health
 * Plans and the template library get their defaults on start.
 */
@Injectable()
export class Jobs implements OnApplicationBootstrap, OnApplicationShutdown {
  private log = new Logger('Jobs');
  private timers: NodeJS.Timeout[] = [];
  private running = new Set<string>();

  async onApplicationBootstrap() {
    await loadPlans();
    await ensureLibrary();
    if (process.env.DISABLE_JOBS === '1') return;
    this.every(5 * 60_000, 'health', sampleHealth);
    this.every(60_000, 'publish', async () => {
      const n = await publishDueCards();
      if (n) this.log.log(`${n} scheduled cards went live`);
    });
    this.every(60 * 60_000, 'hr-sync', () => this.syncAll());
    this.every(60 * 60_000, 'trials', async () => {
      const r = await db.Company.updateMany({ status: 'trial', trialEndsAt: { $lt: new Date() } }, { status: 'past_due' });
      if (r.modifiedCount) this.log.log(`${r.modifiedCount} trials ended`);
    });
  }

  onApplicationShutdown() {
    this.timers.forEach(clearInterval);
  }

  private every(ms: number, name: string, fn: () => Promise<void>) {
    const run = async () => {
      if (this.running.has(name)) return;
      this.running.add(name);
      try {
        await fn();
      } catch (e) {
        this.log.error(`${name} failed: ${(e as Error).message}`);
      } finally {
        this.running.delete(name);
      }
    };
    this.timers.push(setInterval(run, ms));
  }

  private async syncAll() {
    const list = await db.Integration.find({ status: 'connected', provider: { $in: ['workday', 'sap', 'bamboohr'] } })
      .select('+credentials')
      .lean<any[]>();
    for (const i of list) {
      if (!i.credentials || !Object.keys(i.credentials).length) continue;
      try {
        const company = await db.Company.findById(i.companyId).lean<any>();
        if (!company || ['suspended', 'churned'].includes(company.status)) continue;
        const plan = await planSync(company, i, await fetchRecords(i));
        await executeSync(company, i, plan, 'Hourly sync');
      } catch (e) {
        await db.Integration.updateOne({ _id: i._id }, { status: 'error', lastError: (e as Error).message });
      }
    }
  }
}
