import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { z } from 'zod';
import { config, PLANS, PlanId } from '../../config';
import { CurrentUser, Platform, SessionUser } from '../../common/auth';
import { LAYOUTS, THEMES } from '../../common/catalog';
import { aiCreditsFor, getSetting, setSetting } from '../../common/platform';
import { daysAgo, found, logActivity, parse, relTime, requireId } from '../../common/util';
import { db } from '../../db/db';
import { AI_FEATURES, AiFeature } from '../ai/ai.service';
import { PROVIDERS } from '../integrations/fetchers';
import { money, monthStart, share } from './shared';

/** Every connector the console watches. HR and identity sync through SyncRuns; CRMs push leads. */
const CONNECTORS = [
  ...PROVIDERS.map((p) => ({ id: p.id, name: p.name, kind: p.id === 'entra' ? 'Identity' : 'HR' })),
  { id: 'scim', name: 'SCIM provisioning', kind: 'Identity' },
  { id: 'csv', name: 'CSV import', kind: 'File' },
  { id: 'hubspot', name: 'HubSpot', kind: 'CRM' },
  { id: 'salesforce', name: 'Salesforce', kind: 'CRM' },
  { id: 'webhook', name: 'CRM webhook', kind: 'CRM' },
];
const isCrm = (id: string) => ['hubspot', 'salesforce', 'webhook'].includes(id);

const templateBody = z.object({
  name: z.string().min(2).max(60),
  layout: z.enum(LAYOUTS.map((l) => l.id) as [string, ...string[]]),
  theme: z.enum(THEMES.map((t) => t.id) as [string, ...string[]]),
});

@Platform()
@Controller('console')
export class ConsoleOperationsController {
  /* ---------- Integration health ---------- */

  @Get('integration-health')
  async integrations(@Query('days') daysParam?: string) {
    const days = daysParam === '30' ? 30 : 7;
    const since = daysAgo(days);
    const [integrations, runs, today, crmCompanies] = await Promise.all([
      db.Integration.find({ status: { $ne: 'draft' } })
        .select('companyId provider status lastError updatedAt')
        .lean<any[]>(),
      db.SyncRun.find({ dryRun: { $ne: true }, createdAt: { $gte: since } })
        .select('provider status issues companyId')
        .lean<any[]>(),
      db.SyncRun.find({ dryRun: { $ne: true }, createdAt: { $gte: daysAgo(1) } })
        .select('companyId')
        .lean<any[]>(),
      db.Company.find({ 'settings.crm.provider': { $exists: true, $ne: null } })
        .select('settings.crm.provider')
        .lean<any[]>(),
    ]);

    const rows = CONNECTORS.map((c) => {
      if (isCrm(c.id)) {
        const n = crmCompanies.filter((co) => co.settings?.crm?.provider === c.id).length;
        return { ...c, companies: n, rate: null as number | null, lastError: '—', status: n ? 'healthy' : 'unused', runs: 0 };
      }
      const mine = integrations.filter((i) => i.provider === c.id);
      const myRuns = runs.filter((r) => r.provider === c.id);
      const ok = myRuns.filter((r) => r.status === 'done').length;
      const rate = myRuns.length ? Math.round((ok / myRuns.length) * 1000) / 10 : null;
      const broken = mine.filter((i) => i.status === 'error');
      const latest = broken.sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt))[0];
      // Degraded when a quarter or more of its companies are broken, or syncs often fail
      const status = !mine.length
        ? 'unused'
        : mine.some((i) => i.status === 'paused')
          ? 'review'
          : broken.length / mine.length >= 0.25 || (rate !== null && rate < 95)
            ? 'degraded'
            : 'healthy';
      return {
        ...c,
        companies: mine.length,
        rate,
        lastError: latest ? `${latest.lastError || 'Sync failed'} · ${broken.length} ${broken.length === 1 ? 'company' : 'companies'}` : '—',
        status,
        runs: myRuns.length,
      };
    });

    const done = runs.filter((r) => r.status === 'done').length;
    const degraded = rows.filter((r) => r.status === 'degraded');
    return {
      days,
      kpis: [
        { label: 'Syncs today', value: today.length.toLocaleString(), note: `Across ${new Set(today.map((r) => String(r.companyId))).size} companies` },
        { label: 'Success rate', value: runs.length ? `${Math.round((done / runs.length) * 1000) / 10}%` : '—', note: `Last ${days} days`, tone: 'ok' },
        { label: 'Records failed', value: runs.reduce((a, r) => a + (r.issues?.length || 0), 0).toLocaleString(), note: 'Waiting for customer action', tone: 'warn' },
        { label: 'Syncs paused by guard', value: String(integrations.filter((i) => i.status === 'paused').length), note: 'Large removals held for review' },
      ],
      rows: rows.sort((a, b) => b.companies - a.companies),
      alerts: degraded.map((r) => ({
        id: r.id,
        title: `${r.name} is degraded`,
        text: `${integrations.filter((i) => i.provider === r.id && i.status === 'error').length} companies affected. ${r.lastError.split(' · ')[0]}.`,
      })),
    };
  }

  @Get('integration-health/:provider')
  async connector(@Param('provider') provider: string) {
    const list = await db.Integration.find({ provider, status: { $ne: 'draft' } })
      .select('companyId status lastError lastSyncAt')
      .lean<any[]>();
    const companies = await db.Company.find({ _id: { $in: list.map((i) => i.companyId) } })
      .select('name')
      .lean<any[]>();
    const cmap = new Map(companies.map((c) => [String(c._id), c.name]));
    return list.map((i) => ({
      companyId: String(i.companyId),
      company: cmap.get(String(i.companyId)) || '—',
      status: i.status,
      lastSync: i.lastSyncAt ? relTime(i.lastSyncAt) : 'Never',
      error: i.lastError || '',
    }));
  }

  /** Shows a banner in each affected company's dashboard until the problem is fixed. */
  @Post('integration-health/:provider/notify')
  async notify(@Param('provider') provider: string, @CurrentUser() u: SessionUser) {
    const broken = await db.Integration.find({ provider, status: 'error' }).select('companyId').lean<any[]>();
    const name = CONNECTORS.find((c) => c.id === provider)?.name || provider;
    if (!broken.length) return { notified: 0 };
    await db.Announcement.create({
      message: `Your ${name} connection needs attention. Open HR integrations and sign in again so new hires keep getting cards.`,
      link: '/app/integrations',
      audience: { roles: 'admins', companyIds: broken.map((b) => b.companyId) },
      status: 'live',
      startsAt: new Date(),
      endsAt: new Date(Date.now() + 7 * 86400_000),
      createdBy: u.name,
    });
    await logActivity({ actor: u.name, action: 'integration.notified', text: `Notified ${broken.length} companies about ${name}`, platform: true });
    return { notified: broken.length };
  }

  /* ---------- Template library ---------- */

  @Get('library')
  async library() {
    const [templates, companyTemplates] = await Promise.all([
      db.LibraryTemplate.find().sort({ status: 1, createdAt: 1 }).lean<any[]>(),
      db.Template.find().select('companyId layout theme').lean<any[]>(),
    ]);
    const usedBy = (match: (t: any) => boolean) => new Set(companyTemplates.filter(match).map((t) => String(t.companyId))).size;
    return {
      templates: templates.map((t) => ({
        id: String(t._id),
        name: t.name,
        layout: t.layout,
        theme: t.theme,
        status: t.status,
        usedBy: usedBy((ct) => ct.layout === t.layout && ct.theme === t.theme),
      })),
      themes: THEMES.map((t) => ({ ...t, usedBy: usedBy((ct) => ct.theme === t.id) })),
      layouts: LAYOUTS,
    };
  }

  @Post('library')
  async addTemplate(@Body() body: unknown, @CurrentUser() u: SessionUser) {
    const d = parse(templateBody, body);
    await db.LibraryTemplate.create({ ...d, status: 'draft' });
    await logActivity({ actor: u.name, action: 'library.added', text: `Drafted template ${d.name}`, platform: true });
    return { ok: true };
  }

  @Patch('library/:id')
  async updateTemplate(@Param('id') id: string, @Body() body: unknown, @CurrentUser() u: SessionUser) {
    const d = parse(templateBody.partial().extend({ status: z.enum(['draft', 'live', 'retired']).optional() }), body);
    const t = found(await db.LibraryTemplate.findByIdAndUpdate(requireId(id), d, { new: true }), 'Template');
    const verb = d.status === 'live' ? 'Published' : d.status === 'retired' ? 'Retired' : 'Edited';
    await logActivity({ actor: u.name, action: 'library.updated', text: `${verb} template ${t.name}`, platform: true });
    return { ok: true };
  }

  /* ---------- AI usage and cost ---------- */

  @Get('ai')
  async ai() {
    const since = monthStart();
    const [usage, disabled, companies] = await Promise.all([
      db.AiUsage.find({ ts: { $gte: since } })
        .select('companyId feature costUsd helpful')
        .lean<any[]>(),
      getSetting<string[]>('ai.disabled', []),
      db.Company.find().select('name plan status').lean<any[]>(),
    ]);
    const live = await db.Card.aggregate([{ $match: { status: 'live' } }, { $group: { _id: '$companyId', n: { $sum: 1 } } }]);
    const cardsBy = new Map(live.map((r) => [String(r._id), r.n as number]));
    const totalCost = usage.reduce((a, u) => a + (u.costUsd || 0), 0);
    const helpfulPct = (list: any[]) => {
      const r = list.filter((u) => u.helpful !== null && u.helpful !== undefined);
      return r.length ? share(r.filter((u) => u.helpful).length, r.length) : null;
    };

    const perCompany = new Map<string, any[]>();
    for (const u of usage) if (u.companyId) perCompany.set(String(u.companyId), [...(perCompany.get(String(u.companyId)) || []), u]);
    const companyRows = companies
      .filter((c) => perCompany.has(String(c._id)))
      .map((c) => {
        const mine = perCompany.get(String(c._id))!;
        const perCard = aiCreditsFor(c.plan);
        const budget = perCard === null ? null : perCard * Math.max(cardsBy.get(String(c._id)) || 0, 1);
        const counts = new Map<string, number>();
        for (const u of mine) counts.set(u.feature, (counts.get(u.feature) || 0) + 1);
        const top = [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] as AiFeature | undefined;
        return {
          company: c.name,
          plan: `${PLANS[c.plan as PlanId]?.name || c.plan}${c.status === 'trial' ? ' trial' : ''}`,
          used: mine.length,
          pct: budget === null ? null : Math.min(share(mine.length, budget), 999),
          top: top ? AI_FEATURES[top] : '—',
        };
      })
      .sort((a, b) => (b.pct ?? -1) - (a.pct ?? -1) || b.used - a.used);

    const priced = config.ai.costInPerMTok > 0 || config.ai.costOutPerMTok > 0;
    const helpful = helpfulPct(usage);
    return {
      provider: config.ai.provider,
      priced,
      kpis: [
        { label: 'AI requests', value: usage.length.toLocaleString(), note: 'This month' },
        { label: 'Cost this month', value: priced ? money(totalCost) : '—', note: priced ? `${config.ai.provider} · estimated` : 'Add AI prices to .env to see cost' },
        { label: 'Rated helpful', value: helpful === null ? '—' : `${helpful}%`, note: helpful === null ? 'No ratings yet' : 'From thumbs up and down', tone: 'ok' },
        { label: 'Near their limit', value: String(companyRows.filter((c) => (c.pct ?? 0) >= 80).length), note: 'Companies above 80%', tone: 'warn' },
      ],
      features: (Object.keys(AI_FEATURES) as AiFeature[]).map((key) => {
        const mine = usage.filter((u) => u.feature === key);
        const cost = mine.reduce((a, u) => a + (u.costUsd || 0), 0);
        return {
          key,
          name: AI_FEATURES[key],
          uses: mine.length,
          share: priced ? share(cost, totalCost) : share(mine.length, usage.length),
          helpful: helpfulPct(mine),
          on: !disabled.includes(key),
        };
      }),
      companies: companyRows.slice(0, 8),
    };
  }

  @Patch('ai/features/:key')
  async toggleFeature(@Param('key') key: string, @Body() body: unknown, @CurrentUser() u: SessionUser) {
    const { on } = parse(z.object({ on: z.boolean() }), body);
    if (!(key in AI_FEATURES)) return { ok: false };
    const disabled = new Set(await getSetting<string[]>('ai.disabled', []));
    if (on) disabled.delete(key);
    else disabled.add(key);
    await setSetting('ai.disabled', [...disabled]);
    await logActivity({ actor: u.name, action: 'ai.feature', text: `Turned ${on ? 'on' : 'off'} ${AI_FEATURES[key as AiFeature]}`, platform: true });
    return { ok: true };
  }
}
