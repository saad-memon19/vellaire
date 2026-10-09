import { PLANS, PlanId } from '../../config';
import { daysAgo } from '../../common/util';
import { db } from '../../db/db';

export const mrrOf = (c: any) =>
  ['active', 'past_due'].includes(c.status) ? (c.seats || 0) * (PLANS[c.plan as PlanId]?.pricePerSeat || 0) : 0;

/** 0–100 score from adoption, HR link, payment, usage and support load. */
export async function healthOf(c: any) {
  const [live, views, integration, openTickets] = await Promise.all([
    db.Card.countDocuments({ companyId: c._id, status: 'live' }),
    db.Event.countDocuments({ companyId: c._id, type: 'view', ts: { $gte: daysAgo(30) } }),
    db.Integration.findOne({ companyId: c._id, status: { $ne: 'draft' } }).lean<any>(),
    db.Ticket.countDocuments({ companyId: c._id, status: { $ne: 'closed' } }),
  ]);
  const adoption = Math.min(live / Math.max(c.seats || 1, 1), 1);
  const usage = Math.min(views / Math.max(live * 4, 1), 1);
  const hr = !integration ? 0.6 : integration.status === 'connected' ? 1 : 0.2;
  const pay = c.billing?.paymentStatus === 'failed' || c.status === 'past_due' ? 0 : 1;
  const support = openTickets === 0 ? 1 : openTickets === 1 ? 0.7 : openTickets <= 3 ? 0.4 : 0.1;
  const parts = [
    { name: 'Card adoption', v: Math.round(adoption * 100), w: 30 },
    { name: 'HR link', v: Math.round(hr * 100), w: 20 },
    { name: 'Payments', v: pay * 100, w: 20 },
    { name: 'Usage', v: Math.round(usage * 100), w: 15 },
    { name: 'Support load', v: Math.round(support * 100), w: 15 },
  ];
  const score = Math.round(parts.reduce((a, p) => a + (p.v * p.w) / 100, 0));
  return {
    score,
    parts,
    live,
    views,
    hrStatus: integration ? `${integration.provider} · ${integration.status === 'connected' ? 'healthy' : integration.status === 'paused' ? 'paused' : 'error'}` : 'Not connected',
    hrOk: !integration || integration.status === 'connected',
    openTickets,
  };
}
