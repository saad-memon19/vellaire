/**
 * Demo data: `npm run seed` (wipes the database first).
 * Creates Meridian Capital (the company in the designs), a dozen other customers for the
 * product owner console, and 90 days of card activity.
 */
import { mkdirSync, writeFileSync } from 'fs';
import mongoose from 'mongoose';
import { join } from 'path';
import { config } from '../config';
import { connectDb, db } from '../db/db';
import { slugify } from '../common/util';
import { seedPlatform } from './platform';

/* ---------- deterministic randomness ---------- */
let s = 42;
const rnd = () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296);
const pick = <T>(a: readonly T[]) => a[Math.floor(rnd() * a.length)]!;
const int = (a: number, b: number) => Math.floor(a + rnd() * (b - a + 1));
const weighted = <T>(pairs: [T, number][]) => {
  const total = pairs.reduce((x, [, w]) => x + w, 0);
  let r = rnd() * total;
  for (const [v, w] of pairs) if ((r -= w) <= 0) return v;
  return pairs[0]![0];
};
const day = (n: number) => new Date(Date.now() - n * 86400_000);
const at = (daysBack: number) => {
  const d = day(daysBack);
  d.setHours(int(8, 21), int(0, 59), int(0, 59));
  return d;
};

const FIRST = ['Omar', 'Sara', 'Ahmed', 'Fatima', 'Yusuf', 'Layla', 'Hassan', 'Mariam', 'Khalid', 'Noor', 'Ali', 'Aisha', 'Rashid', 'Hana', 'Tariq', 'Zainab', 'Faisal', 'Salma', 'Imran', 'Rania', 'James', 'Emma', 'Daniel', 'Olivia', 'Arjun', 'Priya', 'Rohan', 'Ananya', 'Bilal', 'Hira', 'Saad', 'Amna', 'Karim', 'Dina', 'Nadia', 'Samir', 'Leila', 'Adam', 'Sophie', 'Lucas', 'Chloe', 'Ibrahim', 'Yasmin', 'Hamza', 'Maya', 'Zayed', 'Huda', 'Victor', 'Clara', 'Ravi'];
const LAST = ['Haddad', 'Khan', 'Al-Rashid', 'Mansour', 'Farouk', 'Nasser', 'Qureshi', 'Siddiqui', 'Hassan', 'Aziz', 'Malik', 'Rahman', 'Al-Amin', 'Sharif', 'Bennett', 'Clarke', 'Hughes', 'Walker', 'Mehta', 'Kapoor', 'Iyer', 'Chaudhry', 'Butt', 'Saleh', 'Khoury', 'Haddad', 'Darwish', 'Fischer', 'Laurent', 'Rossi', 'Nair', 'Sheikh', 'Al-Mazrouei', 'Al-Suwaidi', 'Hamdan'];
const DEPTS: [string, number][] = [['Private Clients', 18], ['Wealth Management', 24], ['Investment Banking', 16], ['Operations', 20], ['Risk and Compliance', 10], ['Technology', 12]];
const OFFICES: [string, string, string, number][] = [
  ['Dubai · DIFC', 'Dubai', 'United Arab Emirates', 46],
  ['Abu Dhabi', 'Abu Dhabi', 'United Arab Emirates', 20],
  ['Riyadh', 'Riyadh', 'Saudi Arabia', 18],
  ['London', 'London', 'United Kingdom', 16],
];
const TITLES: Record<string, string[]> = {
  'Private Clients': ['Associate', 'Relationship Manager', 'Senior Relationship Manager', 'Director, Private Clients', 'Client Advisor'],
  'Wealth Management': ['Portfolio Manager', 'Investment Analyst', 'Wealth Planner', 'Associate Director', 'Senior Analyst'],
  'Investment Banking': ['Analyst', 'Associate', 'Vice President', 'Director', 'Managing Director'],
  Operations: ['Operations Analyst', 'Operations Manager', 'Client Service Officer', 'Team Lead'],
  'Risk and Compliance': ['Compliance Officer', 'Risk Analyst', 'Head of Compliance', 'AML Specialist'],
  Technology: ['Software Engineer', 'Product Manager', 'Data Engineer', 'IT Support Specialist', 'Head of Technology'],
};
const CITIES: [string, number][] = [['Dubai', 40], ['Abu Dhabi', 16], ['Riyadh', 14], ['London', 12], ['Doha', 8], ['Geneva', 5], ['Singapore', 5]];
const CHANNELS: [string, number][] = [['nfc', 38], ['qr', 27], ['link', 18], ['wallet', 11], ['email', 6]];
const MATERIALS = ['metal_obsidian', 'metal_steel', 'pvc_black', 'wood_walnut', 'metal_gold'];
const LEAD_COMPANIES = ['Family office, Abu Dhabi', 'Al Noor Holdings', 'Gulf Ventures', 'Emaar Partners', 'Desert Rose Capital', 'Harbour Trust', 'Najd Investments', 'Crescent Group', 'Atlas Family Office', 'Sterling Advisory', 'Doha Wealth', 'Marina Estates'];
const LEAD_NOTES = ['Interested in succession planning for a family business.', 'Wants to review a discretionary mandate.', 'Asked about Sharia-compliant funds.', 'Looking for a second opinion on a property portfolio.', 'Exploring a pre-IPO round.', 'Would like a call next week.', '', '', ''];

async function wipe() {
  for (const name of Object.keys(mongoose.models)) await mongoose.models[name]!.deleteMany({});
}

const workdayRecord = (e: any) => ({
  Employee_ID: e.hrId,
  Legal_First_Name: e.firstName,
  Legal_Last_Name: e.lastName,
  Primary_Work_Email: e.email,
  Business_Title: e.title,
  Supervisory_Organization: e.department,
  Location: e.office,
  Location_Country: e.country,
  Work_Phone: e.phone,
  Hire_Date: e.startDate?.toISOString().slice(0, 10),
  Worker_Type: e.workerType || 'Employee',
  Cost_Center: `CC-${int(100, 999)}`,
  Manager_ID: `W${int(10000, 19999)}`,
});

async function seedMeridian() {
  const company = await db.Company.create({
    name: 'Meridian Capital',
    slug: 'meridian-capital',
    plan: 'enterprise',
    seats: 1320,
    status: 'active',
    country: 'UAE',
    city: 'Dubai',
    dataRegion: 'me',
    accountManager: 'Ayesha R.',
    domain: { host: 'cards.meridian.com', verified: false, verifyToken: 'vellaire-verify=demo' },
    brand: {
      website: 'https://meridian.com',
      colors: [
        { name: 'Obsidian', use: 'Card background', hex: '#141417' },
        { name: 'Meridian Gold', use: 'Accents and linework', hex: '#C9A96E' },
        { name: 'Pearl', use: 'Text on dark', hex: '#F6F1E7' },
      ],
      fonts: { display: 'Cormorant Garamond', body: 'Instrument Sans' },
      buttonStyle: 'soft',
      permissions: { photo: true, bio: true, links: true, theme: false, languages: true },
      subBrands: [{ name: 'Saudi Arabia', field: 'country', value: 'Saudi Arabia', layout: 'arabic', theme: 'obsidian_gold' }],
      publishedAt: day(12),
    },
    settings: {
      approvalRequired: false,
      photoApproval: true,
      languages: ['en', 'ar'],
      sso: { provider: 'Microsoft Entra ID' },
      crm: { provider: 'salesforce', webhookUrl: 'https://example.com/hooks/salesforce' },
    },
    billing: { cycle: 'annual', renewsAt: new Date('2027-01-14'), customerSince: new Date('2026-01-14'), paymentStatus: 'ok' },
  });

  const [classic, arabic, exec] = await db.Template.insertMany([
    { companyId: company._id, name: 'Meridian Classic', layout: 'classic', theme: 'obsidian_gold', isDefault: true, departments: ['Private Clients', 'Wealth Management'] },
    { companyId: company._id, name: 'Classic — Arabic', layout: 'arabic', theme: 'obsidian_gold', departments: [] },
    { companyId: company._id, name: 'Executive', layout: 'executive', theme: 'obsidian_gold', departments: ['Investment Banking'] },
  ]);
  await db.Template.create({ companyId: company._id, name: 'Operations', layout: 'modern', theme: 'ivory_ink', departments: ['Operations', 'Technology', 'Risk and Compliance'] });
  await db.Department.insertMany(DEPTS.map(([name]) => ({ companyId: company._id, name, templateId: name === 'Investment Banking' ? exec!._id : classic!._id })));

  /* People */
  const monthStart = new Date();
  monthStart.setDate(1);
  const people: any[] = [];
  const used = new Set<string>();
  const add = (p: any) => {
    people.push(p);
    used.add(p.email);
  };
  // The people named in the designs
  add({ firstName: 'Sara', lastName: 'Khan', title: 'Head of Private Clients', department: 'Private Clients', office: 'Dubai · DIFC', city: 'Dubai', country: 'United Arab Emirates', startDate: new Date('2019-03-10'), phone: '+971 4 000 1001' });
  add({ firstName: 'Omar', lastName: 'Haddad', title: 'Associate', department: 'Private Clients', office: 'Dubai · DIFC', city: 'Dubai', country: 'United Arab Emirates', startDate: new Date(monthStart.getTime() + 2 * 86400_000), phone: '+971 4 000 1002', noCard: true });
  add({ firstName: 'Layla', lastName: 'Mansour', title: 'Brand Manager', department: 'Operations', office: 'Dubai · DIFC', city: 'Dubai', country: 'United Arab Emirates', startDate: new Date('2021-06-01'), phone: '+971 4 000 1003' });
  for (const p of people) p.email = `${p.firstName}.${p.lastName}`.toLowerCase().replace(/[^a-z.]/g, '') + '@meridian.com';

  while (people.length < 1320) {
    const first = pick(FIRST);
    const last = pick(LAST);
    let email = `${first}.${last}`.toLowerCase().replace(/[^a-z.]/g, '') + '@meridian.com';
    let k = 2;
    while (used.has(email)) email = `${first}.${last}${k++}`.toLowerCase().replace(/[^a-z0-9.]/g, '') + '@meridian.com';
    const dept = weighted(DEPTS);
    const [office, city, country] = weighted(OFFICES.map(([o, c, co, w]) => [[o, c, co] as const, w]));
    const joinedThisMonth = people.length < 3 + 8;
    add({
      firstName: first,
      lastName: last,
      email,
      title: pick(TITLES[dept]!),
      department: dept,
      office,
      city,
      country,
      phone: `+971 4 ${int(100, 999)} ${int(1000, 9999)}`,
      startDate: joinedThisMonth ? new Date(monthStart.getTime() + int(0, 20) * 86400_000) : day(int(60, 3000)),
      noCard: joinedThisMonth || people.length > 1320 - 66,
      noEmailInHr: people.length % 330 === 7,
    });
  }

  const empDocs = await db.Employee.insertMany(
    people.map((p, i) => ({
      companyId: company._id,
      hrId: `W${10000 + i}`,
      source: 'workday',
      firstName: p.firstName,
      lastName: p.lastName,
      name: `${p.firstName} ${p.lastName}`,
      email: p.email,
      title: p.title,
      department: p.department,
      office: p.office,
      city: p.city,
      country: p.country,
      phone: p.phone,
      startDate: p.startDate,
      createdAt: p.startDate < new Date() ? p.startDate : day(3),
    })),
  );

  /* Cards */
  const slugs = new Set<string>();
  const cardDocs: any[] = [];
  empDocs.forEach((e: any, i) => {
    if (people[i].noCard) return;
    let slug = slugify(e.name);
    let k = 2;
    while (slugs.has(slug)) slug = `${slugify(e.name)}-${k++}`;
    slugs.add(slug);
    const isArabic = e.country === 'Saudi Arabia';
    const leader = /Head|Director|Managing/.test(e.title);
    const status = i < 3 ? 'live' : weighted([['live', 96], ['draft', 2], ['pending_approval', 1], ['deactivated', 1]]);
    cardDocs.push({
      companyId: company._id,
      employeeId: e._id,
      slug,
      status,
      layout: isArabic ? 'arabic' : leader ? 'executive' : e.department === 'Operations' || e.department === 'Technology' ? 'modern' : 'classic',
      theme: e.department === 'Operations' ? 'ivory_ink' : 'obsidian_gold',
      templateId: isArabic ? arabic!._id : leader ? exec!._id : classic!._id,
      fields: {
        name: e.name,
        title: e.title,
        department: e.department,
        office: e.office,
        email: e.email,
        phone: e.phone,
        website: 'https://meridian.com',
        address: `[Office address], ${e.office}`,
        bio:
          e.name === 'Sara Khan'
            ? 'Sara leads Private Clients across the Gulf, advising families and founders on long-term wealth.'
            : `${e.firstName} works in ${e.department} at Meridian Capital in ${e.city}.`,
      },
      translations: isArabic || e.name === 'Sara Khan' ? { ar: { name: e.name === 'Sara Khan' ? 'سارة خان' : e.name, title: e.name === 'Sara Khan' ? 'رئيسة العملاء الخاصين' : e.title } } : {},
      links:
        e.name === 'Sara Khan'
          ? [
              { type: 'booking', label: 'Book a meeting', url: 'https://cal.com/meridian/sara', sub: '30-minute introduction' },
              { type: 'linkedin', label: 'LinkedIn', url: 'https://linkedin.com/in/sarakhan', sub: 'linkedin.com/in/sarakhan' },
              { type: 'file', label: 'Private Clients brochure', url: 'https://meridian.com/brochure.pdf', sub: 'PDF · 2.4 MB' },
            ]
          : [{ type: 'linkedin', label: 'LinkedIn', url: `https://linkedin.com/in/${slug}`, sub: `linkedin.com/in/${slug}` }],
      syncedFields: ['name', 'title', 'department', 'office', 'email'],
      delivery: ['email', 'wallet', 'signature'],
      publishedAt: status === 'live' || status === 'deactivated' ? new Date(Math.max(e.startDate.getTime(), day(int(5, 240)).getTime())) : undefined,
      deactivatedAt: status === 'deactivated' ? day(int(1, 40)) : undefined,
      approval: status === 'pending_approval' ? { requestedBy: 'Workday sync', requestedAt: day(1), reason: 'New joiner from HR' } : undefined,
      createdAt: day(int(5, 240)),
    });
  });
  // One photo change waiting for approval (Sara Khan matching EditMyCard design)
  cardDocs[0].approval = { pendingPhoto: '/files/demo-photo.svg', requestedBy: cardDocs[0].fields.name, requestedAt: day(0), reason: 'New profile photo' };
  cardDocs[5].approval = { pendingPhoto: '/files/demo-photo.svg', requestedBy: cardDocs[5].fields.name, requestedAt: day(0), reason: 'New profile photo' };
  // Title & department change waiting for approval
  cardDocs[2].approval = {
    requestedBy: 'Workday sync',
    requestedAt: new Date(Date.now() - 3600_000),
    reason: 'Title and department changed',
    before: { title: 'Director', department: 'Corporate Finance', office: 'Riyadh' },
    after: { title: 'Managing Director', department: 'Investment Banking', office: 'Riyadh' },
    changes: [
      { field: 'Job title', before: 'Director', after: 'Managing Director' },
      { field: 'Department', before: 'Corporate Finance', after: 'Investment Banking' },
      { field: 'Office', before: 'Riyadh', after: 'No change' },
    ],
  };
  const cards = await db.Card.insertMany(cardDocs);
  await db.Employee.bulkWrite(cards.map((c: any) => ({ updateOne: { filter: { _id: c.employeeId }, update: { cardId: c._id } } })));
  const live = cards.filter((c: any) => c.status === 'live');
  const sara = cards[0]!;

  /* Users */
  await db.User.insertMany([
    { email: 'sara.khan@meridian.com', name: 'Sara Khan', companyId: company._id, role: 'owner', scope: 'Whole company', employeeId: empDocs[0]!._id, lastLoginAt: day(0) },
    { email: 'david.asante@meridian.com', name: 'David Asante', companyId: company._id, role: 'admin', scope: 'Whole company', lastLoginAt: day(0) },
    { email: 'nour.hamdan@meridian.com', name: 'Nour Hamdan', companyId: company._id, role: 'brand_manager', scope: 'Whole company', employeeId: empDocs[2]!._id, lastLoginAt: day(1) },
    { email: 'priya.shah@meridian.com', name: 'Priya Shah', companyId: company._id, role: 'hr_manager', scope: 'Whole company', lastLoginAt: day(2) },
    { email: 'tom.allerton@meridian.com', name: 'Tom Allerton', companyId: company._id, role: 'dept_manager', scope: 'Corporate Finance', lastLoginAt: day(3) },
    { email: 'hana.qureshi@meridian.com', name: 'Hana Qureshi', companyId: company._id, role: 'dept_manager', scope: 'Karachi office', lastLoginAt: day(7) },
    { email: 'omar.haddad@meridian.com', name: 'Omar Haddad', companyId: company._id, role: 'member', employeeId: empDocs[1]!._id, status: 'invited' },
    ...empDocs.slice(3, 40).map((e: any) => ({ email: e.email, name: e.name, companyId: company._id, role: 'member', employeeId: e._id })),
  ]);

  /* Events: 90 days, growing, Sara's card busier */
  const events: any[] = [];
  const leadEvents: any[] = [];
  for (let d = 89; d >= 0; d--) {
    const growth = 1 + (89 - d) / 120;
    const weekday = [0.75, 1, 1.1, 1.1, 1.05, 0.95, 0.7][day(d).getDay()]!;
    const views = Math.round(int(70, 95) * growth * weekday);
    for (let i = 0; i < views; i++) {
      const card = rnd() < 0.05 ? sara : pick(live);
      const channel = weighted(CHANNELS);
      const ts = at(d);
      const base = { companyId: company._id, cardId: card._id, channel, city: weighted(CITIES), device: weighted([['iOS', 55], ['Android', 35], ['Desktop', 10]]), ts };
      events.push({ ...base, type: 'view' });
      if (rnd() < 0.24) events.push({ ...base, type: 'save' });
      if (rnd() < (channel === 'nfc' ? 0.12 : 0.04)) {
        events.push({ ...base, type: 'lead' });
        leadEvents.push(base);
      }
      if (channel === 'wallet' && rnd() < 0.1) events.push({ ...base, type: 'wallet_add', wallet: events.length % 5 < 3 ? 'apple' : 'google' });
    }
  }
  for (let i = 0; i < events.length; i += 5000) await db.Event.insertMany(events.slice(i, i + 5000), { ordered: false });
  const lastViewed = new Map<string, Date>();
  for (const e of events) if (e.type === 'view') lastViewed.set(String(e.cardId), e.ts);
  await db.Card.bulkWrite([...lastViewed.entries()].map(([id, ts]) => ({ updateOne: { filter: { _id: id }, update: { lastViewedAt: ts } } })));

  /* Leads (one per lead event) */
  const cardById = new Map(cards.map((c: any) => [String(c._id), c]));
  const leads = leadEvents.map((ev) => {
    const card = cardById.get(String(ev.cardId));
    const first = pick(FIRST);
    const last = pick(LAST);
    const old = Date.now() - ev.ts.getTime() > 5 * 86400_000;
    return {
      companyId: company._id,
      cardId: card._id,
      employeeId: card.employeeId,
      ownerName: card.fields.name,
      name: `${first} ${last}`,
      company: pick(LEAD_COMPANIES),
      jobTitle: pick(['Principal', 'Founder', 'CFO', 'Director', 'Partner', 'Head of Investments']),
      email: `${first}.${last}`.toLowerCase().replace(/[^a-z.]/g, '') + '@example.com',
      phone: `+971 5${int(0, 9)} ${int(100, 999)} ${int(1000, 9999)}`,
      note: pick(LEAD_NOTES),
      consent: true,
      via: ev.channel,
      status: old ? weighted([['in_crm', 85], ['followed_up', 12], ['new', 3]]) : weighted([['new', 60], ['followed_up', 25], ['in_crm', 15]]),
      crm: undefined as any,
      createdAt: ev.ts,
    };
  });
  for (const l of leads) if (l.status === 'in_crm') l.crm = { provider: 'Salesforce', pushedAt: l.createdAt };
  leads.push({
    companyId: company._id,
    cardId: sara._id,
    employeeId: sara.employeeId,
    ownerName: 'Sara Khan',
    name: 'Faisal Al-Rashid',
    company: 'Family office, Abu Dhabi',
    jobTitle: 'Principal',
    email: 'faisal@example.com',
    phone: '+971 50 000 0000',
    note: 'Interested in succession planning for a family business. Prefers a call next week.',
    consent: true,
    via: 'nfc',
    status: 'new',
    crm: undefined,
    createdAt: new Date(),
    draft:
      'Dear Faisal,\n\nIt was a pleasure meeting you this evening. You mentioned succession planning for the family business — I would be glad to share how we have supported similar families across the Gulf.\n\nWould a call on Tuesday or Wednesday suit you?\n\nWarm regards,\nSara',
  } as any);
  await db.Lead.insertMany(leads);

  /* NFC */
  const devices = live.slice(0, 640).map((c: any, i: number) => ({
    companyId: company._id,
    cardId: c._id,
    employeeId: c.employeeId,
    holderName: c.fields.name,
    office: c.fields.office,
    uid: `mer${(100000 + i).toString(36)}`,
    material: i === 0 ? 'metal_obsidian' : /Head|Director/.test(c.fields.title) ? pick(['metal_obsidian', 'metal_gold']) : pick(MATERIALS.slice(0, 4)),
    status: i === 0 ? 'active' : weighted([['active', 96], ['lost', 2], ['disabled', 2]]),
    lastTapAt: rnd() < 0.85 ? at(int(0, 30)) : undefined,
  }));
  await db.NfcDevice.insertMany(devices);
  const joiners = empDocs.filter((_: any, i: number) => people[i].noCard && people[i].startDate >= monthStart).slice(0, 9);
  await db.NfcOrder.insertMany([
    { companyId: company._id, number: 'VL-1038', material: 'metal_obsidian', qty: 1, items: [{ employeeId: empDocs[1]!._id, name: 'Omar Haddad', title: 'Associate', office: 'Dubai · DIFC' }], stage: 'production', supplier: 'Dubai Engrave Co.', shipTo: 'Dubai office', dueAt: day(-4), history: [{ stage: 'received', at: day(3), by: 'Sara Khan' }, { stage: 'production', at: day(1), by: 'Vellaire' }] },
    { companyId: company._id, number: 'VL-1036', material: 'pvc_black', qty: 24, items: [], stage: 'shipped', supplier: 'CardWorks UK', shipTo: "Each person's office", tracking: 'DHL 4829 1102', dueAt: day(-2), history: [] },
    { companyId: company._id, number: 'VL-1033', material: 'metal_steel', qty: 12, items: [], stage: 'proof', supplier: 'Dubai Engrave Co.', shipTo: 'Riyadh office', dueAt: day(2), history: [] },
    { companyId: company._id, number: 'VL-1029', material: 'metal_gold', qty: 6, items: [], stage: 'delivered', supplier: 'Dubai Engrave Co.', shipTo: 'Dubai office', dueAt: day(20), history: [] },
    { companyId: company._id, number: 'VL-1021', material: 'pvc_black', qty: 180, items: [], stage: 'delivered', supplier: 'CardWorks UK', shipTo: "Each person's office", dueAt: day(60), history: [] },
  ]);

  /* Workday integration with a live-looking feed: current people + 3 new joiners, 4 without email */
  const feed = empDocs.map((e: any, i: number) => {
    const r = workdayRecord(e);
    if (people[i].noEmailInHr) r.Primary_Work_Email = '';
    return r;
  });
  for (const [first, last, title, dept] of [['Hamza', 'Siddiqui', 'Analyst', 'Investment Banking'], ['Clara', 'Laurent', 'Wealth Planner', 'Wealth Management'], ['Zayed', 'Al-Mazrouei', 'Relationship Manager', 'Private Clients']] as const) {
    feed.push(workdayRecord({ hrId: `W${20000 + feed.length}`, firstName: first, lastName: last, email: `${first}.${last}`.toLowerCase().replace(/[^a-z.]/g, '') + '@meridian.com', title, department: dept, office: 'Dubai · DIFC', country: 'United Arab Emirates', phone: '+971 4 000 2000', startDate: day(-7) }));
  }
  feed.push({ ...workdayRecord({ hrId: 'W29999', firstName: 'Contract', lastName: 'Worker', email: 'contractor@meridian.com', title: 'Consultant', department: 'Technology', office: 'London', country: 'United Kingdom', startDate: day(10) }), Worker_Type: 'Contractor' });
  const mapping = [
    ['Employee_ID', 'hrId', 'auto'], ['Legal_First_Name', 'firstName', 'auto'], ['Legal_Last_Name', 'lastName', 'auto'], ['Primary_Work_Email', 'email', 'auto'],
    ['Business_Title', 'title', 'auto'], ['Supervisory_Organization', 'department', 'ai'], ['Location', 'office', 'ai'], ['Location_Country', 'country', 'ai'],
    ['Work_Phone', 'phone', 'ai'], ['Hire_Date', 'startDate', 'ai'], ['Worker_Type', 'workerType', 'ai'], ['Cost_Center', '', 'manual'], ['Manager_ID', '', 'manual'],
  ].map(([src, dst, match]) => ({ src, sample: String((feed[0] as any)[src!] ?? ''), dst, sourceOfTruth: 'hr', match, accepted: match !== 'ai' }));
  await db.Integration.create({
    companyId: company._id,
    provider: 'workday',
    status: 'connected',
    step: 2,
    accountName: 'meridian_wd',
    mapping,
    rules: { templateByCountry: [{ countries: ['United Arab Emirates', 'Saudi Arabia'], layout: 'arabic' }], skipWorkerTypes: ['Contractor'], joinersToApproval: true },
    guardPct: 10,
    lastSyncAt: new Date(Date.now() - 4 * 60_000),
    issues: [
      { id: '1', who: 'Zara Ahmed · Karachi', why: 'No work email in Workday, so no card can be created.', fix: 'Add email' },
      { id: '2', who: 'Marco Lenz · Dubai', why: 'Department code ORG-CMP-DXB is not mapped to a department.', fix: 'Map department' },
    ],
    pendingRecords: feed,
  });
  // Arabic rule shown in the design applies to Saudi Arabia only in practice
  await db.Integration.updateOne({ companyId: company._id, provider: 'workday' }, { 'rules.templateByCountry': [{ countries: ['Saudi Arabia'], layout: 'arabic' }] });
  const seedNow = Date.now();
  const seedDayMs = 86400_000;
  await db.SyncRun.insertMany([
    {
      companyId: company._id,
      provider: 'workday',
      status: 'done',
      created: 1,
      updated: 4,
      deactivated: 0,
      skipped: 0,
      trigger: 'Hourly sync',
      createdAt: new Date(seedNow - 25 * 60_000),
      finishedAt: new Date(seedNow - 24 * 60_000),
    },
    {
      companyId: company._id,
      provider: 'workday',
      status: 'done',
      created: 0,
      updated: 2,
      deactivated: 0,
      skipped: 0,
      trigger: 'Hourly sync',
      createdAt: new Date(seedNow - 40 * 60_000),
      finishedAt: new Date(seedNow - 39 * 60_000),
    },
    {
      companyId: company._id,
      provider: 'workday',
      status: 'paused',
      created: 9,
      updated: 12,
      deactivated: 1,
      skipped: 2,
      trigger: 'Hourly sync',
      createdAt: new Date(seedNow - 160 * 60_000),
      finishedAt: new Date(seedNow - 159 * 60_000),
    },
    {
      companyId: company._id,
      provider: 'workday',
      status: 'done',
      created: 0,
      updated: 3,
      deactivated: 0,
      skipped: 0,
      trigger: 'Hourly sync',
      createdAt: new Date(seedNow - seedDayMs - 30 * 60_000),
      finishedAt: new Date(seedNow - seedDayMs - 29 * 60_000),
    },
    {
      companyId: company._id,
      provider: 'workday',
      status: 'done',
      created: 0,
      updated: 31,
      deactivated: 0,
      skipped: 0,
      trigger: 'Manual · Sara Khan',
      createdAt: new Date(seedNow - seedDayMs - 8 * 3600_000),
      finishedAt: new Date(seedNow - seedDayMs - 8 * 3600_000 + 45_000),
    },
    {
      companyId: company._id,
      provider: 'workday',
      status: 'done',
      created: 2,
      updated: 5,
      deactivated: 0,
      skipped: 0,
      trigger: 'Hourly sync',
      createdAt: new Date(seedNow - 7 * seedDayMs),
      finishedAt: new Date(seedNow - 7 * seedDayMs + 60_000),
    },
    {
      companyId: company._id,
      provider: 'workday',
      status: 'failed',
      created: 0,
      updated: 0,
      deactivated: 0,
      skipped: 0,
      issues: ['Authentication token expired'],
      trigger: 'Hourly sync',
      createdAt: new Date(seedNow - 8 * seedDayMs),
      finishedAt: new Date(seedNow - 8 * seedDayMs + 30_000),
    },
  ]);

  /* Activity */
  await db.Activity.insertMany([
    { companyId: company._id, cardId: sara._id, actor: 'Workday sync', action: 'card.synced', text: 'Updated from HR: title', createdAt: day(2) },
    { companyId: company._id, cardId: sara._id, actor: 'Sara Khan', action: 'card.self_edit', text: 'Sara Khan updated their card', createdAt: day(9) },
    { companyId: company._id, cardId: sara._id, actor: 'Layla Mansour', action: 'card.published', text: 'Card published at cards.meridian.com/sara-khan', createdAt: day(120) },
    { companyId: company._id, actor: 'Layla Mansour', action: 'brand.published', text: 'Brand kit published to 1,248 cards', createdAt: day(12), platform: false },
    { companyId: company._id, actor: 'Workday sync', action: 'sync.done', text: 'Workday sync: 9 created, 14 updated, 2 switched off', createdAt: day(1) },
    { companyId: company._id, actor: 'Sara Khan', action: 'nfc.ordered', text: '1 × Obsidian Metal NFC card ordered (VL-1038)', createdAt: day(3) },
  ]);

  /* Billing */
  await db.Invoice.insertMany(
    Array.from({ length: 10 }, (_, i) => {
      const start = new Date('2026-01-14');
      start.setMonth(start.getMonth() + i);
      return { companyId: company._id, number: `INV-2026-${String(100 + i)}`, amount: Math.min(900 + i * 45, 1320) * 12, status: start < new Date() ? 'paid' : 'open', periodStart: start, periodEnd: new Date(start.getTime() + 30 * 86400_000), seats: Math.min(900 + i * 45, 1320), plan: 'enterprise' };
    }).filter((x) => x.periodStart < new Date()),
  );
  await db.Note.insertMany([
    { companyId: company._id, author: 'Ayesha', body: 'Wants Arabic-first cards for the Riyadh office by December.', createdAt: day(9) },
    { companyId: company._id, author: 'Ayesha', body: 'Renewal call booked for early December. Sara is the champion; CFO signs.', createdAt: day(30) },
  ]);
  await db.Ticket.create({
    companyId: company._id,
    number: 1012,
    subject: 'Add Arabic name to Riyadh cards',
    status: 'pending',
    priority: 'normal',
    assignee: 'Ayesha R.',
    openedBy: { name: 'Layla Mansour', role: 'brand_manager', email: 'layla.mansour@meridian.com' },
    slaDueAt: day(-1),
    messages: [
      { author: 'Layla Mansour', kind: 'customer', body: 'Can the Riyadh team show their Arabic name first on the card?', at: day(2) },
      { author: 'Ayesha R.', kind: 'staff', body: 'Yes — the Classic Arabic layout does this. I have applied it to the Riyadh template; please check one card and confirm.', at: day(1) },
    ],
  });

  console.log(`  Meridian Capital: ${empDocs.length} people, ${cards.length} cards, ${events.length} events, ${leads.length} leads, ${joiners.length} joiners`);
  return company;
}

const OTHERS: { name: string; country: string; city: string; plan: string; seats: number; status: string; hr?: string; hrStatus?: string; size: number; am: string; pay?: string; months: number }[] = [
  { name: 'Harbour Legal', country: 'UAE', city: 'Dubai', plan: 'professional', seats: 120, status: 'past_due', hr: 'bamboohr', hrStatus: 'error', size: 96, am: 'Imran S.', pay: 'failed', months: 8 },
  { name: 'Atlas Properties', country: 'Saudi Arabia', city: 'Riyadh', plan: 'enterprise', seats: 600, status: 'active', hr: 'sap', hrStatus: 'connected', size: 140, am: 'Ayesha R.', months: 6 },
  { name: 'Noor Hospitality', country: 'Qatar', city: 'Doha', plan: 'professional', seats: 80, status: 'trial', size: 22, am: 'Imran S.', months: 0 },
  { name: 'Gulfstone Engineering', country: 'UAE', city: 'Abu Dhabi', plan: 'professional', seats: 250, status: 'active', hr: 'workday', hrStatus: 'connected', size: 120, am: 'Ayesha R.', months: 5 },
  { name: 'Cedar and Vine Law', country: 'United Kingdom', city: 'London', plan: 'starter', seats: 40, status: 'active', size: 34, am: 'Daniel P.', months: 9 },
  { name: 'Falcon Logistics', country: 'UAE', city: 'Dubai', plan: 'professional', seats: 300, status: 'active', hr: 'entra', hrStatus: 'connected', size: 110, am: 'Imran S.', months: 4 },
  { name: 'Oasis Health', country: 'Oman', city: 'Muscat', plan: 'professional', seats: 150, status: 'active', size: 60, am: 'Daniel P.', months: 3 },
  { name: 'Summit Advisory', country: 'Bahrain', city: 'Manama', plan: 'starter', seats: 25, status: 'churned', size: 8, am: 'Daniel P.', months: 7 },
  { name: 'Marina Ventures', country: 'UAE', city: 'Dubai', plan: 'professional', seats: 60, status: 'trial', size: 12, am: 'Ayesha R.', months: 0 },
  { name: 'Pearl Insurance', country: 'Kuwait', city: 'Kuwait City', plan: 'enterprise', seats: 450, status: 'active', hr: 'workday', hrStatus: 'connected', size: 150, am: 'Ayesha R.', months: 2 },
  { name: 'Azure Architects', country: 'Singapore', city: 'Singapore', plan: 'starter', seats: 30, status: 'active', size: 26, am: 'Daniel P.', months: 1 },
  { name: 'Northgate Bank', country: 'United Kingdom', city: 'London', plan: 'enterprise', seats: 900, status: 'active', hr: 'workday', hrStatus: 'paused', size: 160, am: 'Imran S.', months: 10 },
];

async function seedOthers() {
  const PRICE: Record<string, number> = { starter: 6, professional: 9, enterprise: 12 };
  for (const o of OTHERS) {
    const slug = slugify(o.name);
    const since = new Date();
    since.setMonth(since.getMonth() - o.months);
    const company = await db.Company.create({
      name: o.name,
      slug,
      plan: o.plan,
      seats: o.seats,
      status: o.status,
      country: o.country,
      city: o.city,
      accountManager: o.am,
      trialEndsAt: o.status === 'trial' ? day(-int(2, 12)) : undefined,
      billing: { cycle: o.plan === 'enterprise' ? 'annual' : 'monthly', customerSince: since, paymentStatus: o.pay || 'ok', renewsAt: new Date(since.getTime() + 365 * 86400_000) },
    });
    await db.Template.create({ companyId: company._id, name: 'Company default', layout: pick(['classic', 'modern', 'minimal']), theme: pick(['obsidian_gold', 'navy_silver', 'ivory_ink', 'forest_brass']), isDefault: true });
    const domain = `${slug.replace(/-/g, '')}.com`;
    const emps = await db.Employee.insertMany(
      Array.from({ length: o.size }, (_, i) => {
        const f = pick(FIRST);
        const l = pick(LAST);
        return { companyId: company._id, name: `${f} ${l}`, firstName: f, lastName: l, email: `${f}.${l}${i}`.toLowerCase().replace(/[^a-z0-9.]/g, '') + `@${domain}`, title: pick(['Associate', 'Manager', 'Director', 'Partner', 'Analyst']), department: pick(['Sales', 'Operations', 'Advisory', 'Finance']), office: o.city, country: o.country, source: o.hr || 'csv', startDate: day(int(30, 900)) };
      }),
    );
    const cards = await db.Card.insertMany(
      emps.map((e: any, i: number) => ({
        companyId: company._id,
        employeeId: e._id,
        slug: `${slugify(e.name)}-${i}`,
        status: o.status === 'churned' ? 'deactivated' : 'live',
        layout: 'classic',
        theme: 'obsidian_gold',
        fields: { name: e.name, title: e.title, department: e.department, office: e.office, email: e.email },
        publishedAt: day(int(5, 200)),
      })),
    );
    await db.Employee.bulkWrite(cards.map((c: any) => ({ updateOne: { filter: { _id: c.employeeId }, update: { cardId: c._id } } })));
    const owner = emps[0] as any;
    await db.User.create({ email: owner.email, name: owner.name, companyId: company._id, role: 'owner', employeeId: owner._id, lastLoginAt: day(int(0, 20)) });
    if (o.status !== 'churned') {
      const evs: any[] = [];
      const per = o.name === 'Harbour Legal' ? 4 : o.status === 'trial' ? 6 : 20;
      for (let d = 0; d < 30; d++) for (let k = 0; k < per; k++) evs.push({ companyId: company._id, cardId: pick(cards)._id, type: rnd() < 0.85 ? 'view' : 'save', channel: weighted(CHANNELS), city: o.city, ts: at(d) });
      await db.Event.insertMany(evs);
    }
    if (o.hr) {
      await db.Integration.create({
        companyId: company._id,
        provider: o.hr,
        status: o.hrStatus,
        step: 4,
        lastSyncAt: o.hrStatus === 'connected' ? new Date(Date.now() - int(5, 55) * 60_000) : day(1),
        lastError: o.hrStatus === 'error' ? 'Authorisation expired' : o.hrStatus === 'paused' ? 'Sync guard: 140 of 160 cards would be switched off' : undefined,
      });
    }
    if (['active', 'past_due'].includes(o.status)) {
      const inv = [];
      for (let m = 0; m <= o.months; m++) {
        const start = new Date(since);
        start.setMonth(since.getMonth() + m);
        if (start > new Date()) break;
        const failed = o.pay === 'failed' && m >= o.months - 1;
        inv.push({ companyId: company._id, number: `INV-${slug.slice(0, 4).toUpperCase()}-${100 + m}`, amount: o.seats * PRICE[o.plan]!, status: failed ? 'failed' : 'paid', periodStart: start, periodEnd: new Date(start.getTime() + 30 * 86400_000), seats: o.seats, plan: o.plan });
      }
      await db.Invoice.insertMany(inv);
    }
    if (o.name === 'Harbour Legal') {
      await db.Ticket.create({
        companyId: company._id,
        number: 1014,
        subject: 'BambooHR sync stopped overnight',
        status: 'open',
        priority: 'high',
        openedBy: { name: 'Priya Shah', role: 'HR Manager', email: 'priya.shah@harbourlegal.com' },
        slaDueAt: new Date(Date.now() - 30 * 60_000),
        messages: [
          { author: 'Priya Shah', kind: 'customer', body: 'Our new associates from Monday still have no cards. The sync page says "Authorisation expired". Can you help before our client event on Thursday?', at: new Date(Date.now() - 2 * 3600_000) },
          { author: 'System', kind: 'system', body: 'BambooHR token expired 02:14 · 6 records waiting', at: new Date(Date.now() - 2 * 3600_000) },
        ],
      });
      await db.Ticket.create({
        companyId: company._id,
        number: 1015,
        subject: 'Invoice question',
        status: 'open',
        priority: 'normal',
        openedBy: { name: 'Priya Shah', role: 'HR Manager', email: 'priya.shah@harbourlegal.com' },
        slaDueAt: new Date(Date.now() + 20 * 3600_000),
        messages: [{ author: 'Priya Shah', kind: 'customer', body: 'Our card payment failed — can we switch to bank transfer?', at: day(1) }],
      });
      await db.Note.create({ companyId: company._id, author: 'Imran', body: 'Payment failed twice. Handle the sync first, then mention billing gently.' });
    }
    if (o.name === 'Northgate Bank') {
      await db.Ticket.create({
        companyId: company._id, number: 1016, subject: 'Sync paused — is this expected?', status: 'open', priority: 'urgent',
        openedBy: { name: 'Tom Hughes', role: 'admin', email: 'tom@northgatebank.com' }, slaDueAt: new Date(Date.now() - 3600_000),
        messages: [{ author: 'Tom Hughes', kind: 'customer', body: 'We restructured our Workday org overnight and the sync says it is paused.', at: new Date(Date.now() - 5 * 3600_000) }],
      });
    }
    if (o.name === 'Atlas Properties') {
      await db.NfcOrder.insertMany([
        { companyId: company._id, number: 'VL-1039', material: 'metal_steel', qty: 40, items: [], stage: 'received', supplier: 'Riyadh Metalworks', shipTo: 'Riyadh office', dueAt: day(-8), history: [] },
        { companyId: company._id, number: 'VL-1035', material: 'wood_walnut', qty: 15, items: [], stage: 'production', supplier: 'Dubai Engrave Co.', shipTo: 'Riyadh office', dueAt: day(-1), history: [] },
      ]);
    }
    if (o.name === 'Falcon Logistics') {
      await db.NfcOrder.create({ companyId: company._id, number: 'VL-1040', material: 'pvc_black', qty: 110, items: [], stage: 'proof', supplier: 'CardWorks UK', shipTo: "Each person's office", dueAt: day(-6), history: [] });
    }
    await db.Activity.create({ companyId: company._id, actor: 'System', action: 'company.created', text: `${o.name} joined Vellaire`, createdAt: since, platform: true });
  }
  console.log(`  ${OTHERS.length} more companies for the console`);
}

async function main() {
  if (process.env.NODE_ENV === 'production' && !process.argv.includes('--force')) {
    console.error('Refusing to wipe a production database. Run with --force if you really mean it.');
    process.exit(1);
  }
  // A demo photo for the pending photo-approval example
  const dir = join(process.cwd(), config.uploadDir);
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, 'demo-photo.svg'),
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect width="120" height="120" fill="#EFE9DD"/><circle cx="60" cy="46" r="22" fill="#B08D4F"/><path d="M20 120c4-26 20-38 40-38s36 12 40 38" fill="#876A33"/></svg>',
  );
  console.log('Connecting…');
  await connectDb(config.mongoUri);
  console.log('Wiping database…');
  await wipe();
  await Promise.all(Object.values(db).map((m) => m.syncIndexes()));
  console.log('Seeding…');
  await seedMeridian();
  await seedOthers();
  await seedPlatform();
  const admins = config.platformAdmins.length ? config.platformAdmins : ['owner@vellaire.app'];
  for (const email of admins) await db.User.create({ email, name: 'Vellaire Owner', platformRole: 'staff' });
  console.log('\nDone. Sign in with:');
  console.log('  Company admin  → sara.khan@meridian.com');
  console.log('  Brand manager  → layla.mansour@meridian.com');
  console.log('  Employee app   → omar.haddad@meridian.com (card not created yet) or ahmed… any member');
  console.log(`  Owner console  → ${admins.join(', ')}`);
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
