import { BadRequestException, Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { z } from 'zod';
import { config } from '../../config';
import { ADMINS, CurrentUser, Roles, SessionUser } from '../../common/auth';
import { LAYOUTS } from '../../common/catalog';
import { encryptJson, found, logActivity, parse, relTime, requireId, sha256, token } from '../../common/util';
import { db } from '../../db/db';
import { oid } from '../../db/schemas';
import { AiService } from '../ai/ai.service';
import { fetchRecords, PROVIDERS } from './fetchers';
import { autoMap, executeSync, planSync, providerName, sampleFields, TARGETS } from './sync';

const STEPS = ['Sign in', 'Map fields', 'Rules', 'Review and sync'];

@Controller('integrations')
export class IntegrationsController {
  constructor(private ai: AiService) {}

  private provider(id: string) {
    const p = PROVIDERS.find((x) => x.id === id);
    if (!p) throw new BadRequestException('Unknown HR system');
    return p;
  }

  private async load(u: SessionUser, provider: string) {
    this.provider(provider);
    const companyId = oid(u.companyId!);
    let i = await db.Integration.findOne({ companyId, provider });
    if (!i) i = await db.Integration.create({ companyId, provider });
    return i;
  }

  @Get()
  async list(@CurrentUser() u: SessionUser) {
    const companyId = oid(u.companyId!);
    const rows = await db.Integration.find({ companyId }).lean<any[]>();
    const counts = await db.Employee.aggregate([{ $match: { companyId, status: 'active' } }, { $group: { _id: '$source', n: { $sum: 1 } } }]);
    const cmap = new Map(counts.map((c) => [c._id, c.n]));
    return {
      providers: PROVIDERS.map((p) => {
        const i = rows.find((r) => r.provider === p.id);
        return {
          id: p.id,
          name: p.name,
          desc: p.desc,
          status: i?.status || 'not_connected',
          lastSync: i?.lastSyncAt ? relTime(i.lastSyncAt) : null,
          people: cmap.get(p.id) || 0,
          error: i?.lastError || null,
        };
      }),
      csvPeople: cmap.get('csv') || 0,
    };
  }

  @Get('activity')
  async activity(@CurrentUser() u: SessionUser) {
    const companyId = oid(u.companyId!);
    const integration =
      (await db.Integration.findOne({ companyId, status: { $ne: 'draft' } }).lean<any>()) ||
      (await db.Integration.findOne({ companyId }).lean<any>());
    const provider = integration ? providerName(integration.provider) : null;
    const guardPct = integration?.guardPct ?? 10;

    const runs = await db.SyncRun.find({ companyId }).sort({ createdAt: -1 }).limit(50).lean<any[]>();
    // What needs a look: the messages of the latest finished sync (sync.ts), each one skippable
    const latest = runs.find((r) => r.status !== 'running');
    const issues = (latest?.issues || []).filter(Boolean).map((why: string, i: number) => ({
      id: `${latest._id}:${i}`,
      who: `${providerName(latest.provider)} sync`,
      why,
      fix: integration ? 'Open settings' : '',
    }));

    return {
      provider,
      providerId: integration?.provider || null,
      guardPct,
      issues,
      runs: runs.map((r) => {
        let status = 'Synced';
        if (r.status === 'paused' || r.status === 'review') status = 'Review';
        else if (r.status === 'failed' || r.status === 'error') status = 'Failed';
        else if (r.status === 'running') status = 'Pending';
        else if (r.status === 'done') status = 'Synced';

        const d = new Date(r.createdAt);
        const now = new Date();
        const isToday = d.toDateString() === now.toDateString();
        const yesterday = new Date(now.getTime() - 86400000);
        const isYesterday = d.toDateString() === yesterday.toDateString();
        const timeStr = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
        let when = '';
        if (isToday) when = `Today ${timeStr}`;
        else if (isYesterday) when = `Yesterday ${timeStr}`;
        else when = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

        let src = `${providerName(r.provider)} · automatic`;
        if (r.trigger) {
          if (r.trigger.startsWith('Manual ·')) src = r.trigger;
          else if (r.trigger.startsWith('Started by')) src = `Manual · ${r.trigger.replace(/^Started by\s*/, '')}`;
        }

        return {
          id: String(r._id),
          when,
          src,
          add: r.created ?? 0,
          up: r.updated ?? 0,
          off: r.deactivated ?? 0,
          skip: r.skipped ?? 0,
          status,
          rawStatus: r.status,
          at: r.createdAt,
        };
      }),
    };
  }

  /** Skip: removes one message (`<runId>:<index>`) from that sync run, so the box stops showing it. */
  @Roles(...ADMINS)
  @Post('activity/skip-issue')
  async skipIssue(@Body() body: unknown, @CurrentUser() u: SessionUser) {
    const { id } = parse(z.object({ id: z.string().regex(/^[0-9a-f]{24}:\d+$/) }), body);
    const [runId, index] = id.split(':');
    const run = found(await db.SyncRun.findOne({ _id: requireId(runId!), companyId: oid(u.companyId!) }), 'Sync');
    run.issues = (run.issues || []).filter((_: string, i: number) => i !== Number(index));
    await run.save();
    return { ok: true };
  }

  @Get(':provider')
  async get(@Param('provider') provider: string, @CurrentUser() u: SessionUser) {
    const p = this.provider(provider);
    const i = await this.load(u, provider);
    const company = await db.Company.findById(i.companyId).lean<any>();
    const full = await db.Integration.findById(i._id).select('+credentials').lean<any>();
    return {
      provider: { id: p.id, name: p.name, desc: p.desc, fields: p.fields, scim: 'scim' in p ? p.scim : false },
      steps: STEPS,
      step: i.step,
      status: i.status,
      connected: !!(full?.credentials && Object.keys(full.credentials).length) || i.step > 1,
      accountName: i.accountName,
      mapping: i.mapping,
      aiMatches: i.mapping.filter((m: any) => m.match === 'ai' && !m.accepted).length,
      targets: TARGETS,
      rules: i.rules,
      guardPct: i.guardPct,
      lastSync: i.lastSyncAt ? relTime(i.lastSyncAt) : null,
      lastError: i.lastError,
      layouts: LAYOUTS,
      aiEnabled: this.ai.enabled,
      scimUrl: `${config.webUrl}/api/scim/v2`,
      scimConfigured: !!company?.settings?.scimTokenHash,
    };
  }

  /** Step 1: save credentials and read a sample of workers to build the field mapping. */
  @Roles(...ADMINS)
  @Post(':provider/connect')
  async connect(@Param('provider') provider: string, @Body() body: unknown, @CurrentUser() u: SessionUser) {
    const p = this.provider(provider);
    const creds = parse(z.record(z.string().max(1000)), body || {});
    for (const f of p.fields) if (!creds[f.key]) throw new BadRequestException(`${f.label} is required`);
    const i = await this.load(u, provider);
    if (Object.keys(creds).length) {
      await db.Integration.updateOne({ _id: i._id }, { credentials: encryptJson(creds) });
    }
    const records = await fetchRecords(i);
    if (!records.length) throw new BadRequestException('Connected, but no workers were returned. Check the report or permissions.');
    const mapping = autoMap(sampleFields(records));
    await db.Integration.updateOne(
      { _id: i._id },
      { mapping, step: Math.max(i.step, 2), accountName: creds.subdomain || creds.username || p.name, lastError: null },
    );
    await logActivity({ companyId: i.companyId, actor: u.name, action: 'integration.connected', text: `${p.name} connected · ${records.length} workers found` });
    return { workers: records.length, mapping };
  }

  /** Improve unmatched fields with AI (gold rows to accept). */
  @Roles(...ADMINS)
  @Post(':provider/ai-match')
  async aiMatch(@Param('provider') provider: string, @CurrentUser() u: SessionUser) {
    const i = await this.load(u, provider);
    const open = i.mapping.filter((m: any) => !m.dst);
    if (!open.length) return { matched: 0 };
    const out = await this.ai.mapFields(open.map((m: any) => ({ src: m.src, sample: m.sample })), TARGETS.map((t) => t.id));
    let matched = 0;
    for (const m of i.mapping as any[]) {
      const hit = out.find((o) => o.src === m.src && TARGETS.some((t) => t.id === o.dst));
      if (!m.dst && hit) {
        m.dst = hit.dst;
        m.match = 'ai';
        m.accepted = false;
        matched++;
      }
    }
    i.markModified('mapping');
    await i.save();
    return { matched };
  }

  @Roles(...ADMINS)
  @Post(':provider/accept-ai')
  async acceptAi(@Param('provider') provider: string, @CurrentUser() u: SessionUser) {
    const i = await this.load(u, provider);
    for (const m of i.mapping as any[]) if (m.match === 'ai') m.accepted = true;
    i.markModified('mapping');
    await i.save();
    return { ok: true };
  }

  @Roles(...ADMINS)
  @Patch(':provider')
  async update(@Param('provider') provider: string, @Body() body: unknown, @CurrentUser() u: SessionUser) {
    const data = parse(
      z.object({
        step: z.number().int().min(1).max(4).optional(),
        mapping: z
          .array(z.object({ src: z.string(), sample: z.string().optional(), dst: z.string(), sourceOfTruth: z.enum(['hr', 'employee']).default('hr'), match: z.string().default('manual'), accepted: z.boolean().default(true) }))
          .optional(),
        rules: z
          .object({
            templateByCountry: z.array(z.object({ countries: z.array(z.string()), layout: z.string(), theme: z.string().optional() })),
            skipWorkerTypes: z.array(z.string()),
            joinersToApproval: z.boolean(),
          })
          .partial()
          .optional(),
        guardPct: z.number().min(1).max(100).optional(),
      }),
      body,
    );
    const i = await this.load(u, provider);
    if (data.mapping) {
      if (!data.mapping.some((m) => m.dst === 'email')) throw new BadRequestException('Map a field to Work email so people can be matched');
      i.mapping = data.mapping as any;
    }
    if (data.rules) i.rules = { ...(i.toObject().rules || {}), ...data.rules } as any;
    if (data.guardPct) i.guardPct = data.guardPct;
    if (data.step) i.step = data.step;
    await i.save();
    return { ok: true };
  }

  @Roles(...ADMINS)
  @Post(':provider/dry-run')
  async dryRun(@Param('provider') provider: string, @CurrentUser() u: SessionUser) {
    const i = await this.load(u, provider);
    const company = await db.Company.findById(i.companyId).lean<any>();
    const plan = await planSync(company, i.toObject(), await fetchRecords(i));
    await db.Integration.updateOne({ _id: i._id }, { step: 4 });
    return {
      create: plan.create.length,
      update: plan.update.length,
      leave: plan.leave.length,
      skipped: plan.skipped.length,
      issues: plan.issues,
      guardTripped: plan.guardTripped,
      guardMessage: plan.guardMessage,
      guardPct: i.guardPct,
      preview: {
        create: plan.create.slice(0, 8).map((p) => ({ name: p.name, title: p.title, office: p.office })),
        update: plan.update.slice(0, 8).map((x) => ({ name: x.employee.name, changes: Object.keys(x.changes) })),
        leave: plan.leave.slice(0, 8).map((e) => ({ name: e.name, title: e.title })),
        skipped: plan.skipped.slice(0, 8),
      },
    };
  }

  @Roles(...ADMINS)
  @Post(':provider/sync')
  async sync(@Param('provider') provider: string, @Body() body: unknown, @CurrentUser() u: SessionUser) {
    const { force } = parse(z.object({ force: z.boolean().default(false) }), body || {});
    const i = await this.load(u, provider);
    const company = await db.Company.findById(i.companyId).lean<any>();
    const plan = await planSync(company, i.toObject(), await fetchRecords(i));
    const run = await executeSync(company, i.toObject(), plan, `Started by ${u.name}`, force);
    return { status: run.status, created: run.created, updated: run.updated, deactivated: run.deactivated, skipped: run.skipped, issues: run.issues };
  }

  @Roles(...ADMINS)
  @Post(':provider/disconnect')
  async disconnect(@Param('provider') provider: string, @CurrentUser() u: SessionUser) {
    const i = await this.load(u, provider);
    await db.Integration.updateOne({ _id: i._id }, { status: 'draft', step: 1, credentials: {}, lastError: null });
    await logActivity({ companyId: i.companyId, actor: u.name, action: 'integration.disconnected', text: `${providerName(provider)} disconnected. Existing cards stay as they are.` });
    return { ok: true };
  }

  /** Entra ID / any SCIM client: create a bearer token (shown once). */
  @Roles(...ADMINS)
  @Post('scim/token')
  async scimToken(@CurrentUser() u: SessionUser) {
    const t = `vl_scim_${token(32)}`;
    await db.Company.updateOne({ _id: oid(u.companyId!) }, { 'settings.scimTokenHash': sha256(t) });
    const i = await this.load(u, 'entra');
    await db.Integration.updateOne({ _id: i._id }, { status: 'connected', step: 4 });
    await logActivity({ companyId: oid(u.companyId!), actor: u.name, action: 'scim.token', text: 'New SCIM token created for automatic provisioning' });
    return { token: t, url: `${config.webUrl}/api/scim/v2` };
  }
}
