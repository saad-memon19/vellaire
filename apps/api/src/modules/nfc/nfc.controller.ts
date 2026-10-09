import { BadRequestException, Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { z } from 'zod';
import { ADMINS, CurrentUser, MANAGERS, Roles, SessionUser } from '../../common/auth';
import { MATERIALS, materialName, NFC_STAGES } from '../../common/catalog';
import { createCardForEmployee, orderNfcFor } from '../../common/cards';
import { daysAgo, escapeRegex, found, logActivity, paging, parse, relTime, requireId } from '../../common/util';
import { db } from '../../db/db';
import { oid } from '../../db/schemas';

const STAGE_LABEL: Record<string, string> = {
  received: 'Received', proof: 'Artwork', production: 'In production', encoded: 'Encoded', shipped: 'Shipped', delivered: 'Delivered', cancelled: 'Cancelled',
};

export function serializeOrder(o: any) {
  return {
    id: String(o._id),
    number: o.number,
    title: `${o.qty} ${materialName(o.material)} ${o.qty === 1 ? 'card' : 'cards'}`,
    sub: o.items?.length === 1 ? `${o.items[0].name} · ${o.shipTo || ''}` : `${o.items?.length || o.qty} people · ${o.shipTo || ''}`,
    material: o.material,
    qty: o.qty,
    stage: o.stage,
    status: STAGE_LABEL[o.stage],
    // 'received' is the starting point, so the progress bar shows the five working steps
    steps: NFC_STAGES.slice(1).map((s) => ({ name: s === 'production' ? 'Production' : STAGE_LABEL[s], done: NFC_STAGES.indexOf(s) <= NFC_STAGES.indexOf(o.stage) })),
    due: o.dueAt,
    late: o.dueAt && new Date(o.dueAt) < new Date() && !['delivered', 'cancelled'].includes(o.stage),
    tracking: o.tracking,
    supplier: o.supplier,
    automatic: o.automatic,
    createdAt: o.createdAt,
  };
}

@Controller('nfc')
export class NfcController {
  @Get()
  async overview(@Query() q: any, @CurrentUser() u: SessionUser) {
    const companyId = oid(u.companyId!);
    const { limit, page, skip } = paging(q);
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const devFilter: any = { companyId };
    if (q.q) devFilter.holderName = new RegExp(escapeRegex(q.q), 'i');
    if (q.status) devFilter.status = q.status;

    const [active, taps, openOrders, lost, orders, devices, devTotal, company, joiners] = await Promise.all([
      db.NfcDevice.countDocuments({ companyId, status: 'active' }),
      db.Event.countDocuments({ companyId, channel: 'nfc', type: 'view', ts: { $gte: daysAgo(30) } }),
      db.NfcOrder.countDocuments({ companyId, stage: { $nin: ['delivered', 'cancelled'] } }),
      db.NfcDevice.countDocuments({ companyId, status: { $in: ['lost', 'disabled'] } }),
      db.NfcOrder.find({ companyId }).sort({ createdAt: -1 }).limit(6).lean<any[]>(),
      db.NfcDevice.find(devFilter).sort({ lastTapAt: -1 }).skip(skip).limit(limit).lean<any[]>(),
      db.NfcDevice.countDocuments(devFilter),
      db.Company.findById(companyId).lean<any>(),
      db.Employee.find({ companyId, status: 'active', startDate: { $gte: monthStart } }).select('_id cardId').lean<any[]>(),
    ]);
    // Cards (not orders) in each part of the pipeline, for the KPI tiles
    const pipeline = await db.NfcOrder.aggregate([
      { $match: { companyId, stage: { $in: ['received', 'proof', 'production', 'encoded', 'shipped'] } } },
      { $group: { _id: { $cond: [{ $eq: ['$stage', 'shipped'] }, 'shipping', 'making'] }, cards: { $sum: '$qty' }, orders: { $sum: 1 } } },
    ]);
    const bucket = (id: string) => pipeline.find((p) => p._id === id) || { cards: 0, orders: 0 };
    const making = bucket('making');
    const shipping = bucket('shipping');
    const withDevice = new Set((await db.NfcDevice.distinct('employeeId', { companyId })).map(String));
    const joinersWithout = joiners.filter((j) => !withDevice.has(String(j._id)));

    return {
      kpis: [
        { label: 'Cards in use', value: active.toLocaleString(), note: `${taps.toLocaleString()} taps in 30 days` },
        { label: 'In production', value: making.cards.toLocaleString(), note: `${making.orders} ${making.orders === 1 ? 'order' : 'orders'}` },
        { label: 'On the way', value: shipping.cards.toLocaleString(), note: shipping.orders ? `${shipping.orders} ${shipping.orders === 1 ? 'shipment' : 'shipments'}` : 'Nothing shipped yet' },
        { label: 'Lost or switched off', value: lost.toLocaleString(), note: 'All disabled safely' },
      ],
      openOrders,
      orders: orders.map(serializeOrder),
      devices: devices.map((d) => ({
        id: String(d._id),
        name: d.holderName,
        office: d.office,
        material: materialName(d.material),
        materialId: d.material,
        tap: d.lastTapAt ? relTime(d.lastTapAt) : 'Never',
        status: d.status,
        uid: d.uid,
      })),
      devTotal,
      page,
      limit,
      materials: MATERIALS,
      joinersWithout: joinersWithout.map((j) => String(j._id)),
      autoOrder: { enabled: !!company?.settings?.autoOrderNfc, material: company?.settings?.autoOrderMaterial || 'pvc_black' },
    };
  }

  @Roles(...MANAGERS)
  @Post('orders')
  async order(@Body() body: unknown, @CurrentUser() u: SessionUser) {
    const data = parse(z.object({ employeeIds: z.array(z.string()).min(1).max(2000), material: z.string() }), body);
    if (!MATERIALS.some((m) => m.id === data.material)) throw new BadRequestException('Unknown material');
    const companyId = oid(u.companyId!);
    const company = await db.Company.findById(companyId).lean<any>();
    const emps = await db.Employee.find({ companyId, _id: { $in: data.employeeIds.map(requireId) }, status: 'active' }).lean<any[]>();
    const items: { employee: any; card: any }[] = [];
    for (const e of emps) {
      const card = e.cardId ? await db.Card.findById(e.cardId).lean<any>() : await createCardForEmployee(company, e, { actor: u.name });
      items.push({ employee: e, card });
    }
    const order = await orderNfcFor(company, items, data.material, u.name);
    return order ? serializeOrder(order.toObject()) : null;
  }

  @Roles(...MANAGERS)
  @Patch('devices/:id')
  async device(@Param('id') id: string, @Body() body: unknown, @CurrentUser() u: SessionUser) {
    const { status } = parse(z.object({ status: z.enum(['active', 'disabled', 'lost']) }), body);
    const d = found(await db.NfcDevice.findOneAndUpdate({ _id: requireId(id), companyId: oid(u.companyId!) }, { status }, { new: true }), 'NFC card');
    await logActivity({
      companyId: d.companyId,
      cardId: d.cardId,
      actor: u.name,
      action: 'nfc.status',
      text: status === 'active' ? `${d.holderName}'s NFC card switched on` : status === 'lost' ? `${d.holderName}'s NFC card reported lost and switched off` : `${d.holderName}'s NFC card switched off`,
    });
    return { ok: true };
  }

  @Roles(...ADMINS)
  @Patch('settings')
  async settings(@Body() body: unknown, @CurrentUser() u: SessionUser) {
    const data = parse(z.object({ enabled: z.boolean(), material: z.string() }), body);
    await db.Company.updateOne({ _id: oid(u.companyId!) }, { 'settings.autoOrderNfc': data.enabled, 'settings.autoOrderMaterial': data.material });
    return { ok: true };
  }
}
