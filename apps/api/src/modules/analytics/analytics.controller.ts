import { Controller, Get, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { CurrentUser, SessionUser } from '../../common/auth';
import { daysAgo, pct, rangeDays, toCsv } from '../../common/util';
import { db } from '../../db/db';
import { oid } from '../../db/schemas';
import { channelName } from '../cards/cards.controller';

export const fmtDelta = (d: number) => `${d >= 0 ? '+' : ''}${d}%`;

/** Analytics shared by the dashboard (whole company) and the employee app (one card). */
export async function analyticsFor(match: Record<string, any>, days: number) {
  const from = daysAgo(days);
  const prevFrom = daysAgo(days * 2);
  const counts = async (a: Date, b?: Date) => {
    const rows = await db.Event.aggregate([
      { $match: { ...match, ts: b ? { $gte: a, $lt: b } : { $gte: a } } },
      { $group: { _id: '$type', n: { $sum: 1 } } },
    ]);
    return Object.fromEntries(rows.map((r) => [r._id, r.n])) as Record<string, number>;
  };
  const [cur, prev, daily, channels, cities, channelLeads] = await Promise.all([
    counts(from),
    counts(prevFrom, from),
    db.Event.aggregate([
      { $match: { ...match, type: { $in: ['view', 'lead'] }, ts: { $gte: from } } },
      { $group: { _id: { d: { $dateToString: { format: '%Y-%m-%d', date: '$ts' } }, t: '$type' }, n: { $sum: 1 } } },
      { $sort: { '_id.d': 1 } },
    ]),
    db.Event.aggregate([
      { $match: { ...match, type: 'view', ts: { $gte: from } } },
      { $group: { _id: '$channel', n: { $sum: 1 } } },
      { $sort: { n: -1 } },
    ]),
    db.Event.aggregate([
      { $match: { ...match, type: 'view', ts: { $gte: from }, city: { $ne: null } } },
      { $group: { _id: '$city', n: { $sum: 1 } } },
      { $sort: { n: -1 } },
      { $limit: 6 },
    ]),
    db.Event.aggregate([
      { $match: { ...match, type: 'lead', ts: { $gte: from } } },
      { $group: { _id: '$channel', n: { $sum: 1 } } },
    ]),
  ]);

  // Fill missing days with zeros so the chart has a continuous axis
  const byDay = new Map<string, { date: string; views: number; leads: number }>();
  for (let i = days - 1; i >= 0; i--) {
    const d = daysAgo(i).toISOString().slice(0, 10);
    byDay.set(d, { date: d, views: 0, leads: 0 });
  }
  for (const r of daily) {
    const row = byDay.get(r._id.d);
    if (row) row[r._id.t === 'view' ? 'views' : 'leads'] = r.n;
  }
  const totalViews = channels.reduce((a, c) => a + c.n, 0) || 1;
  const leadRate = (cur.lead || 0) / Math.max(cur.view || 0, 1);
  const prevLeadRate = (prev.lead || 0) / Math.max(prev.view || 0, 1);

  return {
    cur,
    prev,
    kpis: [
      { label: 'Card views', value: (cur.view || 0).toLocaleString(), delta: fmtDelta(pct(cur.view || 0, prev.view || 0)) },
      { label: 'Contacts saved', value: (cur.save || 0).toLocaleString(), delta: fmtDelta(pct(cur.save || 0, prev.save || 0)) },
      { label: 'Leads', value: (cur.lead || 0).toLocaleString(), delta: fmtDelta(pct(cur.lead || 0, prev.lead || 0)) },
      { label: 'Lead rate', value: `${(leadRate * 100).toFixed(1)}%`, delta: `${leadRate >= prevLeadRate ? '+' : ''}${((leadRate - prevLeadRate) * 100).toFixed(1)} pts` },
    ],
    daily: [...byDay.values()],
    channels: channels.map((c) => ({ id: c._id, name: channelName(c._id), n: c.n, pct: Math.round((c.n / totalViews) * 100) })),
    cities: cities.map((c) => ({ name: c._id, v: c.n })),
    channelLeads: Object.fromEntries(channelLeads.map((c) => [c._id, c.n])) as Record<string, number>,
  };
}

@Controller('analytics')
export class AnalyticsController {
  private async build(q: any, u: SessionUser) {
    const companyId = oid(u.companyId!);
    const days = rangeDays(q.range);
    const from = daysAgo(days);
    let match: any = { companyId };
    if (q.department) {
      const ids = await db.Card.find({ companyId, 'fields.department': q.department }).distinct('_id');
      match = { ...match, cardId: { $in: ids } };
    }
    const base = await analyticsFor(match, days);

    const [top, depts, cardCount, idle] = await Promise.all([
      db.Event.aggregate([
        { $match: { ...match, ts: { $gte: from }, type: { $in: ['view', 'lead'] } } },
        { $group: { _id: '$cardId', views: { $sum: { $cond: [{ $eq: ['$type', 'view'] }, 1, 0] } }, leads: { $sum: { $cond: [{ $eq: ['$type', 'lead'] }, 1, 0] } } } },
        { $sort: { views: -1 } },
        { $limit: 5 },
        { $lookup: { from: 'cards', localField: '_id', foreignField: '_id', as: 'card' } },
        { $unwind: '$card' },
      ]),
      db.Event.aggregate([
        { $match: { ...match, ts: { $gte: from } } },
        { $lookup: { from: 'cards', localField: 'cardId', foreignField: '_id', as: 'card' } },
        { $unwind: '$card' },
        {
          $group: {
            _id: '$card.fields.department',
            views: { $sum: { $cond: [{ $eq: ['$type', 'view'] }, 1, 0] } },
            saves: { $sum: { $cond: [{ $eq: ['$type', 'save'] }, 1, 0] } },
            leads: { $sum: { $cond: [{ $eq: ['$type', 'lead'] }, 1, 0] } },
          },
        },
        { $sort: { leads: -1 } },
      ]),
      db.Card.aggregate([{ $match: { companyId, status: 'live' } }, { $group: { _id: '$fields.department', n: { $sum: 1 } } }]),
      db.Card.countDocuments({ companyId, status: 'live', $or: [{ lastViewedAt: { $lt: from } }, { lastViewedAt: null }] }),
    ]);
    const cmap = new Map(cardCount.map((c) => [c._id, c.n]));

    // Plain-language summary computed from the numbers (no AI needed)
    const summary: string[] = [];
    const vD = pct(base.cur.view || 0, base.prev.view || 0);
    const lD = pct(base.cur.lead || 0, base.prev.lead || 0);
    if (base.cur.view) {
      summary.push(
        lD > vD
          ? `Leads grew faster than views (${fmtDelta(lD)} against ${fmtDelta(vD)}).`
          : `Views changed ${fmtDelta(vD)} and leads ${fmtDelta(lD)} compared with the previous ${days} days.`,
      );
    }
    const nfcViews = base.channels.find((c) => c.id === 'nfc')?.n || 0;
    const otherViews = (base.cur.view || 0) - nfcViews;
    const nfcLeads = base.channelLeads.nfc || 0;
    const otherLeads = (base.cur.lead || 0) - nfcLeads;
    if (nfcViews > 20 && otherViews > 20 && otherLeads > 0) {
      const ratio = nfcLeads / nfcViews / (otherLeads / otherViews);
      if (ratio > 1.2) summary.push(`People who tap an NFC card are ${ratio.toFixed(1)}× as likely to share their details.`);
    }
    const totalLeads = depts.reduce((a, d) => a + d.leads, 0);
    if (depts[0]?.leads && totalLeads) summary.push(`${depts[0]._id || 'Unassigned'} produced ${Math.round((depts[0].leads / totalLeads) * 100)}% of all leads.`);
    if (idle) summary.push(`${idle} cards had no views in ${days} days. Consider a reminder.`);

    return {
      days,
      ...base,
      summary,
      top: top.map((t, i) => ({ rank: i + 1, id: String(t._id), name: t.card.fields?.name, dept: t.card.fields?.department, views: t.views.toLocaleString(), leads: t.leads })),
      departments: depts.map((d) => ({
        name: d._id || 'Unassigned',
        cards: (cmap.get(d._id) || 0).toLocaleString(),
        views: d.views.toLocaleString(),
        saves: d.saves.toLocaleString(),
        leads: d.leads.toLocaleString(),
        rate: `${((d.leads / Math.max(d.views, 1)) * 100).toFixed(1)}%`,
      })),
      departmentNames: (await db.Card.distinct('fields.department', { companyId })).filter(Boolean).sort(),
    };
  }

  @Get()
  get(@Query() q: any, @CurrentUser() u: SessionUser) {
    return this.build(q, u);
  }

  @Get('export')
  async export(@Query() q: any, @CurrentUser() u: SessionUser, @Res() res: Response) {
    const data = await this.build(q, u);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="vellaire-analytics-${data.days}d.csv"`);
    res.send(toCsv(data.daily.map((d) => ({ date: d.date, views: d.views, leads: d.leads }))));
  }
}
