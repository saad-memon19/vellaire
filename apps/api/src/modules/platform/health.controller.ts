import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { z } from 'zod';
import { CurrentUser, Platform, SessionUser } from '../../common/auth';
import { responseTime } from '../../common/context';
import { daysAgo, found, logActivity, parse, relTime, requireId } from '../../common/util';
import { db } from '../../db/db';
import { checkServices, sampleHealth } from './health-checks';
import { share } from './shared';

const DAYS = 30;

@Platform()
@Controller('console')
export class ConsoleHealthController {
  @Get('health')
  async health() {
    const days = Array.from({ length: DAYS }, (_, i) => new Date(Date.now() - (DAYS - 1 - i) * 86400_000).toISOString().slice(0, 10));
    const [services, samples, incidents, scheduled, openOrders, mailToday] = await Promise.all([
      checkServices(),
      db.HealthSample.find({ day: { $gte: days[0] } }).lean<any[]>(),
      db.Incident.find().sort({ createdAt: -1 }).limit(10).lean<any[]>(),
      db.Card.countDocuments({ status: 'scheduled' }),
      db.NfcOrder.countDocuments({ stage: { $in: ['received', 'proof', 'production', 'encoded'] } }),
      db.EmailLog.countDocuments({ ts: { $gte: daysAgo(1) } }),
    ]);
    const byKey = new Map(samples.map((s) => [`${s.service}:${s.day}`, s.status as string]));
    const today = days[DAYS - 1]!;

    const rows = services.map((s) => ({
      ...s,
      // Today's bar shows the live check; earlier days come from the saved samples
      days: days.map((d) => (s.status === 'off' ? 'none' : d === today ? s.status : byKey.get(`${s.id}:${d}`) || 'none')),
    }));

    // Uptime this month: share of sampled days the public card pages were fully healthy
    const month = today.slice(0, 7);
    const cardDays = rows.find((r) => r.id === 'cards')!.days.filter((status, i) => status !== 'none' && days[i]!.startsWith(month));
    const uptime = cardDays.length ? share(cardDays.filter((s) => s === 'healthy').length, cardDays.length) : null;
    const open = incidents.filter((i) => i.status === 'open');
    const cardsUp = rows.find((r) => r.id === 'cards')!.status !== 'down';
    const degraded = rows.filter((r) => r.status === 'degraded' || r.status === 'down');

    const p95 = responseTime(95);
    const cardMedian = responseTime(50, '/public');
    return {
      banner: {
        tone: open.length || !cardsUp ? 'err' : degraded.length ? 'warn' : 'ok',
        title: open.length ? open[0]!.title : cardsUp ? 'All public cards are online' : 'Public cards are not loading',
        text: open.length
          ? `Incident declared ${relTime(open[0]!.createdAt)} by ${open[0]!.declaredBy}.`
          : degraded.length
            ? `${degraded.map((d) => d.name).join(', ')} ${degraded.length === 1 ? 'needs' : 'need'} attention. Customers can still view and share cards.`
            : 'Every service is answering normally.',
        uptime: uptime === null ? 'Collecting uptime data' : `Uptime this month: ${uptime}%`,
      },
      kpis: [
        { label: 'Card page response', value: cardMedian === null ? '—' : `${cardMedian} ms`, note: 'Median, last hour', tone: 'ok' },
        { label: 'API response', value: p95 === null ? '—' : `${p95} ms`, note: '95th percentile, last hour', tone: 'ok' },
        { label: 'Emails today', value: mailToday.toLocaleString(), note: 'Sent in the last 24 hours' },
        { label: 'Jobs waiting', value: (scheduled + openOrders).toLocaleString(), note: `${scheduled} scheduled cards · ${openOrders} NFC orders` },
      ],
      services: rows,
      incidents: incidents.map((i) => ({
        id: String(i._id),
        title: i.title,
        service: i.service,
        impact: i.impact,
        status: i.status,
        when: relTime(i.createdAt),
        resolved: i.resolvedAt ? relTime(i.resolvedAt) : null,
      })),
    };
  }

  /** Runs the checks now and saves them, instead of waiting for the 5-minute job. */
  @Post('health/check')
  async checkNow() {
    await sampleHealth();
    return { ok: true };
  }

  @Post('incidents')
  async declare(@Body() body: unknown, @CurrentUser() u: SessionUser) {
    const d = parse(z.object({ title: z.string().min(4).max(140), service: z.string().max(40), impact: z.enum(['degraded', 'outage']) }), body);
    await db.Incident.create({ ...d, declaredBy: u.name });
    await logActivity({ actor: u.name, action: 'incident.declared', text: `Declared incident: ${d.title}`, platform: true });
    return { ok: true };
  }

  @Post('incidents/:id/resolve')
  async resolve(@Param('id') id: string, @CurrentUser() u: SessionUser) {
    const i = found(await db.Incident.findByIdAndUpdate(requireId(id), { status: 'resolved', resolvedAt: new Date() }, { new: true }), 'Incident');
    await logActivity({ actor: u.name, action: 'incident.resolved', text: `Resolved incident: ${i.title}`, platform: true });
    return { ok: true };
  }
}
