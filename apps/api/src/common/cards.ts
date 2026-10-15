import { config } from '../config';
import { db } from '../db/db';
import { MATERIALS, materialName } from './catalog';
import { sendMail } from './mail';
import { logActivity, shortId, uniqueSlug } from './util';

export function cardUrl(company: any, slug: string) {
  if (company?.domain?.verified && company.domain.host) return `https://${company.domain.host}/${slug}`;
  return `${config.webUrl}/c/${company?.slug}/${slug}`;
}
export const displayUrl = (url: string) => url.replace(/^https?:\/\//, '');

export function brandOf(company: any) {
  const b = company?.brand || {};
  return {
    companyName: company?.name,
    logos: b.logos || {},
    colors: b.colors || [],
    fonts: b.fonts || {
      display: 'Cormorant Garamond',
      body: 'Instrument Sans',
    },
    buttonStyle: b.buttonStyle || 'soft',
    permissions: b.permissions || {},
  };
}

/** The shape every screen receives for a card. */
export function serializeCard(card: any, company: any, employee?: any) {
  const url = cardUrl(company, card.slug);
  return {
    id: String(card._id),
    slug: card.slug,
    status: card.status,
    layout: card.layout,
    theme: card.theme,
    cover: card.cover,
    fields: card.fields || {},
    translations: card.translations || {},
    links: card.links || [],
    syncedFields: card.syncedFields || [],
    delivery: card.delivery || [],
    publishAt: card.publishAt,
    publishedAt: card.publishedAt,
    deactivatedAt: card.deactivatedAt,
    approval: card.approval,
    createdAt: card.createdAt,
    updatedAt: card.updatedAt,
    url,
    displayUrl: displayUrl(url),
    employeeId: card.employeeId ? String(card.employeeId) : null,
    employee: employee
      ? {
          id: String(employee._id),
          name: employee.name,
          email: employee.email,
          source: employee.source,
          office: employee.office,
          department: employee.department,
          startDate: employee.startDate,
        }
      : undefined,
    brand: brandOf(company),
  };
}

/** Pick the template for a person: department template → company default → company settings. */
export async function templateFor(company: any, employee: any) {
  const templates = await db.Template.find({ companyId: company._id }).lean<any[]>();
  const byDept = templates.find((t) => employee?.department && t.departments?.includes(employee.department));
  const t = byDept || templates.find((x) => x.isDefault);
  // Sub-brand rules (e.g. Country = Saudi Arabia → Arabic layout)
  const sub = (company.brand?.subBrands || []).find((s: any) => s.field && employee?.[s.field] && String(employee[s.field]).toLowerCase() === String(s.value).toLowerCase());
  return {
    templateId: t?._id,
    layout: sub?.layout || t?.layout || company.settings?.defaultLayout || 'classic',
    theme: sub?.theme || t?.theme || company.settings?.defaultTheme || 'obsidian_gold',
    cover: t?.cover || 'brand',
  };
}

export function fieldsFromEmployee(e: any) {
  return {
    name: e.name,
    title: e.title,
    department: e.department,
    office: e.office,
    email: e.email,
    phone: e.phone,
    mobile: e.mobile,
    photoUrl: e.photoUrl,
  };
}

export async function createCardForEmployee(company: any, employee: any, opts: { actor: string; overrides?: any } = { actor: 'System' }) {
  if (employee.cardId) {
    const existing = await db.Card.findById(employee.cardId);
    if (existing && existing.status !== 'deactivated') return existing;
  }
  const design = await templateFor(company, employee);
  const card = await db.Card.create({
    companyId: company._id,
    employeeId: employee._id,
    slug: await uniqueSlug(company._id, employee.name),
    ...design,
    ...(opts.overrides || {}),
    fields: {
      ...fieldsFromEmployee(employee),
      ...(opts.overrides?.fields || {}),
    },
    syncedFields: employee.source && employee.source !== 'manual' ? ['name', 'title', 'department', 'office', 'email'] : [],
  });
  await db.Employee.updateOne({ _id: employee._id }, { cardId: card._id });
  await logActivity({
    companyId: company._id,
    cardId: card._id,
    actor: opts.actor,
    action: 'card.created',
    text: `Card created for ${employee.name}`,
  });
  return card;
}

/** Make sure the card holder can sign in to the employee app (card published, password link). */
export async function ensureMemberUser(company: any, employee: any) {
  if (!employee?.email) return;
  const existing = await db.User.findOne({
    email: employee.email.toLowerCase(),
  });
  if (existing) {
    if (!existing.employeeId) await db.User.updateOne({ _id: existing._id }, { employeeId: employee._id });
    return;
  }
  await db.User.create({
    email: employee.email,
    name: employee.name,
    companyId: company._id,
    role: 'member',
    employeeId: employee._id,
    status: 'invited',
  });
}

export async function orderNfcFor(company: any, items: { employee: any; card: any }[], material: string, actor: string, automatic = false) {
  if (!items.length) return null;
  const count = await db.NfcOrder.countDocuments();
  const order = await db.NfcOrder.create({
    companyId: company._id,
    number: `VL-${1040 + count + 1}`,
    material: MATERIALS.some((m) => m.id === material) ? material : 'pvc_black',
    qty: items.length,
    items: items.map(({ employee, card }) => ({
      employeeId: employee._id,
      cardId: card._id,
      name: employee.name,
      title: employee.title,
      office: employee.office,
    })),
    shipTo: items.length === 1 ? `${items[0]!.employee.office || 'Head office'}` : "Each person's office",
    dueAt: new Date(Date.now() + 10 * 86400_000),
    automatic,
    history: [{ stage: 'received', at: new Date(), by: actor }],
  });
  for (const { employee, card } of items) {
    await db.NfcDevice.create({
      companyId: company._id,
      cardId: card._id,
      employeeId: employee._id,
      holderName: employee.name,
      office: employee.office,
      uid: shortId(12),
      material: order.material,
      status: 'disabled', // switched on when the order is delivered
      orderId: order._id,
    });
  }
  await logActivity({
    companyId: company._id,
    actor,
    action: 'nfc.ordered',
    text: `${items.length} × ${materialName(order.material)} NFC ${items.length === 1 ? 'card' : 'cards'} ordered (${order.number})`,
  });
  return order;
}

/**
 * Publish a card. Depending on company policy and the date it goes to
 * pending_approval, scheduled or live. Returns what happened, for the "Published" screen.
 */
export async function publishCard(
  cardId: unknown,
  actor: { name: string; role?: string },
  opts: {
    publishAt?: Date | null;
    nfcMaterial?: string | null;
    skipApproval?: boolean;
  } = {},
) {
  const card = await db.Card.findById(cardId);
  if (!card) throw new Error('Card not found');
  const company = await db.Company.findById(card.companyId).lean<any>();
  const employee = card.employeeId ? await db.Employee.findById(card.employeeId).lean<any>() : null;
  const steps: { text: string; state: string }[] = [];

  const isManager = ['owner', 'admin', 'brand_manager'].includes(actor.role || '');
  if (company.settings?.approvalRequired && !isManager && !opts.skipApproval) {
    card.status = 'pending_approval';
    card.approval = {
      requestedBy: actor.name,
      requestedAt: new Date(),
      reason: 'New card',
    } as any;
    await card.save();
    await logActivity({
      companyId: company._id,
      cardId: card._id,
      actor: actor.name,
      action: 'card.approval_requested',
      text: `Approval requested for ${card.fields?.name}'s card`,
    });
    return {
      status: card.status,
      steps: [{ text: 'Sent to your Brand Manager for approval', state: 'Waiting' }],
    };
  }

  if (opts.publishAt && opts.publishAt.getTime() > Date.now() + 60_000) {
    card.status = 'scheduled';
    card.publishAt = opts.publishAt;
    await card.save();
    steps.push({
      text: `Card scheduled to go live on ${opts.publishAt.toDateString()}`,
      state: 'Scheduled',
    });
  } else {
    card.status = 'live';
    card.publishedAt = new Date();
    card.publishAt = undefined;
    await card.save();
    const url = cardUrl(company, card.slug);
    steps.push({
      text: `Card published at ${displayUrl(url)}`,
      state: 'Just now',
    });
    await logActivity({
      companyId: company._id,
      cardId: card._id,
      actor: actor.name,
      action: 'card.published',
      text: `Card published at ${displayUrl(url)}`,
    });

    if (employee?.email && card.delivery?.includes('email')) {
      await ensureMemberUser(company, employee);
      await sendMail({
        template: 'card_ready',
        to: employee.email,
        subject: `Your ${company.name} card is ready`,
        heading: `Welcome, ${employee.name.split(' ')[0]}`,
        lines: [
          `Your ${company.name} digital business card is live.`,
          'Add it to Apple or Google Wallet and share it with a tap, a scan or a link. Sign in to the Vellaire app with this email to see who saved your details.',
        ],
        button: { label: 'Open my card', url },
      });
      steps.push({
        text: `Welcome email with wallet buttons sent to ${employee.name.split(' ')[0]}`,
        state: 'Just now',
      });
    }
    if (card.delivery?.includes('signature')) {
      steps.push({
        text: 'Email signature ready in Email signatures',
        state: 'Just now',
      });
    }
  }

  if (opts.nfcMaterial && employee) {
    const order = await orderNfcFor(company, [{ employee, card }], opts.nfcMaterial, actor.name);
    if (order)
      steps.push({
        text: `${materialName(order.material)} NFC card ordered · track it in NFC cards`,
        state: 'In production',
      });
  }
  return { status: card.status, steps };
}

export async function deactivateCard(cardId: unknown, actor: string, reason = 'Deactivated') {
  const card = await db.Card.findByIdAndUpdate(cardId, { status: 'deactivated', deactivatedAt: new Date() }, { new: true });
  if (!card) return;
  await db.NfcDevice.updateMany({ cardId: card._id, status: 'active' }, { status: 'disabled' });
  await logActivity({
    companyId: card.companyId,
    cardId: card._id,
    actor,
    action: 'card.deactivated',
    text: `${reason}: card switched off, NFC chip disabled`,
  });
}

/** Called every minute: scheduled cards whose date has come go live. */
export async function publishDueCards() {
  const due = await db.Card.find({
    status: 'scheduled',
    publishAt: { $lte: new Date() },
  })
    .select('_id')
    .lean<any[]>();
  for (const c of due) await publishCard(c._id, { name: 'Scheduler', role: 'admin' }, { skipApproval: true });
  return due.length;
}
