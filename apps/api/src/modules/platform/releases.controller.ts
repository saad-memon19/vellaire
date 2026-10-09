import { BadRequestException, Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { z } from 'zod';
import { PLANS, PlanId } from '../../config';
import { CurrentUser, Platform, SessionUser } from '../../common/auth';
import { flagOn } from '../../common/platform';
import { found, logActivity, parse, requireId } from '../../common/util';
import { db } from '../../db/db';
import { dayLabel } from './shared';

const REGION_NAME: Record<string, string> = { me: 'Middle East', eu: 'Europe', us: 'Americas' };

const audience = {
  rolloutPct: z.number().int().min(0).max(100),
  plans: z.array(z.enum(['starter', 'professional', 'enterprise'])).max(3),
  regions: z.array(z.enum(['me', 'eu', 'us'])).max(3),
};

/** "Middle East · Professional plan" style summary of who a flag targets. */
function whoLabel(f: any) {
  if (!f.on) return 'Paused';
  const parts: string[] = [];
  if (f.regions?.length) parts.push(f.regions.map((r: string) => REGION_NAME[r]).join(', '));
  if (f.plans?.length) parts.push(`${f.plans.map((p: string) => PLANS[p as PlanId]?.name).join(', ')} plan`);
  if (f.companyIds?.length) parts.push(`${f.companyIds.length} pilot ${f.companyIds.length === 1 ? 'company' : 'companies'}`);
  return parts.length ? parts.join(' · ') : 'All companies';
}

@Platform()
@Controller('console')
export class ConsoleReleasesController {
  @Get('flags')
  async flags() {
    const [flags, companies, releases] = await Promise.all([
      db.FeatureFlag.find().sort({ on: -1, name: 1 }).lean<any[]>(),
      db.Company.find({ status: { $ne: 'churned' } })
        .select('name plan dataRegion')
        .sort({ name: 1 })
        .lean<any[]>(),
      db.Release.find().sort({ releasedAt: -1 }).limit(10).lean<any[]>(),
    ]);
    return {
      flags: flags.map((f) => ({
        id: String(f._id),
        key: f.key,
        name: f.name,
        owner: f.owner || '—',
        on: f.on,
        rolloutPct: f.rolloutPct,
        plans: f.plans,
        regions: f.regions,
        companyIds: (f.companyIds || []).map(String),
        who: whoLabel(f),
        live: companies.filter((c) => flagOn(f, c)).length,
      })),
      companies: companies.map((c) => ({ id: String(c._id), name: c.name })),
      totalCompanies: companies.length,
      releases: releases.map((r) => ({ id: String(r._id), version: r.version, date: dayLabel(r.releasedAt), notes: r.notes })),
    };
  }

  @Post('flags')
  async createFlag(@Body() body: unknown, @CurrentUser() u: SessionUser) {
    const d = parse(
      z.object({
        key: z
          .string()
          .min(3)
          .max(60)
          .regex(/^[a-z0-9_.]+$/, 'Lower-case letters, numbers, dots and underscores'),
        name: z.string().min(2).max(80),
        owner: z.string().max(40).optional(),
        ...audience,
      }),
      body,
    );
    if (await db.FeatureFlag.exists({ key: d.key })) throw new BadRequestException('A flag with this key already exists');
    await db.FeatureFlag.create({ ...d, on: d.rolloutPct > 0 });
    await logActivity({ actor: u.name, action: 'flag.created', text: `Created feature flag ${d.key}`, platform: true });
    return { ok: true };
  }

  @Patch('flags/:id')
  async updateFlag(@Param('id') id: string, @Body() body: unknown, @CurrentUser() u: SessionUser) {
    const d = parse(
      z
        .object({
          on: z.boolean(),
          name: z.string().min(2).max(80),
          owner: z.string().max(40),
          companyIds: z.array(z.string()).max(200),
          ...audience,
        })
        .partial(),
      body,
    );
    const update = { ...d, ...(d.companyIds ? { companyIds: d.companyIds.map(requireId) } : {}) };
    const f = found(await db.FeatureFlag.findByIdAndUpdate(requireId(id), update, { new: true }), 'Flag');
    const text =
      d.on === false
        ? `Turned off ${f.key}`
        : d.on === true
          ? `Turned on ${f.key}`
          : d.rolloutPct !== undefined
            ? `Set ${f.key} to ${f.rolloutPct}% of companies`
            : `Changed who gets ${f.key}`;
    await logActivity({ actor: u.name, action: 'flag.updated', text, platform: true });
    return { ok: true };
  }

  @Post('releases')
  async release(@Body() body: unknown, @CurrentUser() u: SessionUser) {
    const d = parse(z.object({ version: z.string().min(1).max(20), notes: z.string().min(4).max(600) }), body);
    await db.Release.create(d);
    await logActivity({ actor: u.name, action: 'release.published', text: `Published release notes for ${d.version}`, platform: true });
    return { ok: true };
  }
}
