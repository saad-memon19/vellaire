import { Schema, Types } from 'mongoose';

const { ObjectId } = Schema.Types;
const opts = { timestamps: true, versionKey: false } as const;

/* ---------- Company (tenant) ---------- */
export const CompanySchema = new Schema(
  {
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    plan: { type: String, enum: ['starter', 'professional', 'enterprise'], default: 'starter' },
    seats: { type: Number, default: 10 },
    status: { type: String, enum: ['trial', 'active', 'past_due', 'suspended', 'churned'], default: 'trial' },
    trialEndsAt: Date,
    country: String,
    city: String,
    dataRegion: { type: String, enum: ['eu', 'us', 'me'], default: 'me' },
    accountManager: String,
    domain: {
      host: String,
      verified: { type: Boolean, default: false },
      verifyToken: String,
    },
    brand: {
      website: String,
      logos: { light: String, dark: String, icon: String },
      colors: {
        type: [{ name: String, use: String, hex: String, _id: false }],
        default: [
          { name: 'Ink', use: 'Card background', hex: '#17171B' },
          { name: 'Gold', use: 'Accents and linework', hex: '#C9A96E' },
          { name: 'Pearl', use: 'Text on dark', hex: '#F6F1E7' },
        ],
      },
      fonts: {
        display: { type: String, default: 'Cormorant Garamond' },
        body: { type: String, default: 'Instrument Sans' },
        customUrl: String,
      },
      buttonStyle: { type: String, enum: ['sharp', 'soft', 'pill'], default: 'soft' },
      // What employees may change themselves
      permissions: {
        photo: { type: Boolean, default: true },
        bio: { type: Boolean, default: true },
        links: { type: Boolean, default: true },
        theme: { type: Boolean, default: false },
        languages: { type: Boolean, default: true },
      },
      subBrands: [{ name: String, field: String, value: String, theme: String, layout: String }],
      publishedAt: Date,
    },
    settings: {
      approvalRequired: { type: Boolean, default: false },
      photoApproval: { type: Boolean, default: true },
      languages: { type: [String], default: ['en'] },
      defaultLayout: { type: String, default: 'classic' },
      defaultTheme: { type: String, default: 'obsidian_gold' },
      autoOrderNfc: { type: Boolean, default: false },
      teamPage: { type: Boolean, default: false }, // public directory of live cards, opt-in
      autoOrderMaterial: { type: String, default: 'pvc_black' },
      crm: { provider: String, token: String, webhookUrl: String },
      sso: { provider: String, connectionId: String },
      scimTokenHash: String,
    },
    billing: {
      cycle: { type: String, enum: ['monthly', 'annual'], default: 'annual' },
      renewsAt: Date,
      customerSince: Date,
      paymentStatus: { type: String, enum: ['ok', 'failed'], default: 'ok' },
    },
    // Who brought the customer in, and the code they used
    industry: String,
    size: String,
    // Self-serve sign-ups walk through five setup steps before the dashboard
    setup: { step: Number, done: Boolean, people: String },
    partnerId: { type: ObjectId, index: true },
    couponCode: { type: String, uppercase: true, trim: true },
    churnedAt: Date,
  },
  opts,
);

/* ---------- User (anyone who signs in) ---------- */
export const UserSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    name: String,
    companyId: { type: ObjectId, ref: 'Company', index: true },
    role: { type: String, enum: ['owner', 'admin', 'brand_manager', 'hr_manager', 'dept_manager', 'member'], default: 'member' },
    scope: { type: String, default: 'Whole company' },
    platformRole: { type: String, enum: ['staff', null], default: null },
    employeeId: { type: ObjectId, ref: 'Employee' },
    status: { type: String, enum: ['active', 'invited', 'disabled'], default: 'active' },
    lastLoginAt: Date,
  },
  opts,
);

export const MagicTokenSchema = new Schema(
  {
    email: { type: String, index: true },
    tokenHash: { type: String, unique: true },
    expiresAt: { type: Date, index: { expires: 0 } },
    used: { type: Boolean, default: false },
  },
  opts,
);

/* ---------- People ---------- */
export const DepartmentSchema = new Schema(
  {
    companyId: { type: ObjectId, required: true, index: true },
    name: { type: String, required: true },
    templateId: ObjectId,
    head: String,
  },
  opts,
);

export const EmployeeSchema = new Schema(
  {
    companyId: { type: ObjectId, required: true, index: true },
    hrId: String,
    source: { type: String, default: 'manual' }, // manual | csv | workday | sap | bamboohr | entra | scim
    firstName: String,
    lastName: String,
    name: { type: String, required: true },
    email: { type: String, lowercase: true, trim: true },
    phone: String,
    mobile: String,
    title: String,
    department: String,
    office: String,
    city: String,
    country: String,
    startDate: Date,
    workerType: { type: String, default: 'Employee' },
    status: { type: String, enum: ['active', 'leaver'], default: 'active' },
    photoUrl: String,
    cardId: { type: ObjectId, index: true },
  },
  opts,
);
EmployeeSchema.index({ companyId: 1, email: 1 });
EmployeeSchema.index({ companyId: 1, hrId: 1 });
EmployeeSchema.index({ name: 'text', title: 'text', email: 'text' });

/* ---------- Cards ---------- */
export const TemplateSchema = new Schema(
  {
    companyId: { type: ObjectId, required: true, index: true },
    name: { type: String, required: true },
    layout: { type: String, default: 'classic' },
    theme: { type: String, default: 'obsidian_gold' },
    cover: { type: String, default: 'brand' },
    isDefault: { type: Boolean, default: false },
    departments: [String],
  },
  opts,
);

const LinkSchema = new Schema({ type: String, label: String, url: String, sub: String }, { _id: false });

export const CardSchema = new Schema(
  {
    companyId: { type: ObjectId, required: true, index: true },
    employeeId: { type: ObjectId, index: true },
    slug: { type: String, required: true },
    status: {
      type: String,
      enum: ['draft', 'pending_approval', 'scheduled', 'live', 'deactivated'],
      default: 'draft',
    },
    publishAt: Date,
    publishedAt: Date,
    deactivatedAt: Date,
    layout: { type: String, default: 'classic' },
    theme: { type: String, default: 'obsidian_gold' },
    cover: { type: String, default: 'brand' },
    templateId: ObjectId,
    fields: {
      name: String,
      title: String,
      department: String,
      office: String,
      email: String,
      phone: String,
      mobile: String,
      whatsapp: String,
      website: String,
      address: String,
      photoUrl: String,
      bio: String,
      pronouns: String,
    },
    translations: { type: Schema.Types.Mixed, default: {} }, // { ar: { name, title, bio } }
    links: [LinkSchema],
    syncedFields: { type: [String], default: [] },
    delivery: { type: [String], default: ['email', 'wallet'] }, // email | wallet | signature | nfc
    approval: {
      requestedBy: String,
      requestedAt: Date,
      reason: String,
      reviewedBy: String,
      reviewedAt: Date,
      note: String,
      pendingPhoto: String, // employee photo change waiting for approval (card stays live)
      before: Schema.Types.Mixed,
      after: Schema.Types.Mixed,
      changes: Schema.Types.Mixed,
    },
    lastViewedAt: Date,
  },
  opts,
);
CardSchema.index({ companyId: 1, slug: 1 }, { unique: true });

/* ---------- Leads ---------- */
export const LeadSchema = new Schema(
  {
    companyId: { type: ObjectId, required: true, index: true },
    cardId: { type: ObjectId, index: true },
    employeeId: ObjectId,
    ownerName: String,
    name: { type: String, required: true },
    company: String,
    jobTitle: String,
    email: String,
    phone: String,
    note: String,
    consent: { type: Boolean, default: false },
    via: { type: String, default: 'link' }, // nfc | qr | link | wallet | email | paper
    status: { type: String, enum: ['new', 'followed_up', 'in_crm'], default: 'new' },
    crm: { provider: String, id: String, pushedAt: Date },
    draft: String,
  },
  opts,
);
LeadSchema.index({ companyId: 1, createdAt: -1 });

/* ---------- Analytics events ---------- */
export const EventSchema = new Schema(
  {
    companyId: { type: ObjectId, required: true },
    cardId: { type: ObjectId, required: true },
    type: { type: String, enum: ['view', 'save', 'lead', 'click', 'wallet_add'], required: true },
    channel: { type: String, default: 'link' }, // nfc | qr | link | wallet | email | signature
    city: String,
    country: String,
    device: String,
    ts: { type: Date, default: Date.now },
  },
  { versionKey: false },
);
EventSchema.index({ companyId: 1, ts: -1 });
EventSchema.index({ cardId: 1, ts: -1 });

/* ---------- NFC ---------- */
export const NfcDeviceSchema = new Schema(
  {
    companyId: { type: ObjectId, required: true, index: true },
    cardId: ObjectId,
    employeeId: ObjectId,
    holderName: String,
    office: String,
    uid: { type: String, unique: true }, // public id written to the chip URL
    material: String,
    status: { type: String, enum: ['active', 'disabled', 'lost'], default: 'active' },
    lastTapAt: Date,
    orderId: ObjectId,
  },
  opts,
);

export const NfcOrderSchema = new Schema(
  {
    companyId: { type: ObjectId, required: true, index: true },
    number: { type: String, unique: true },
    items: [{ employeeId: ObjectId, cardId: ObjectId, name: String, title: String, office: String, _id: false }],
    material: String,
    qty: Number,
    stage: {
      type: String,
      enum: ['received', 'proof', 'production', 'encoded', 'shipped', 'delivered', 'cancelled'],
      default: 'received',
    },
    supplier: { type: String, default: 'Default supplier' },
    shipTo: String,
    tracking: String,
    dueAt: Date,
    automatic: { type: Boolean, default: false },
    history: [{ stage: String, at: Date, by: String, _id: false }],
  },
  opts,
);

/* ---------- HR integrations ---------- */
export const IntegrationSchema = new Schema(
  {
    companyId: { type: ObjectId, required: true, index: true },
    provider: { type: String, required: true }, // workday | sap | bamboohr | entra | csv | scim
    status: { type: String, enum: ['draft', 'connected', 'error', 'paused'], default: 'draft' },
    step: { type: Number, default: 1 },
    accountName: String,
    credentials: { type: Schema.Types.Mixed, select: false },
    mapping: [
      {
        src: String,
        sample: String,
        dst: String,
        sourceOfTruth: { type: String, default: 'hr' },
        match: { type: String, default: 'manual' }, // auto | ai | manual
        accepted: { type: Boolean, default: false },
        _id: false,
      },
    ],
    rules: {
      templateByCountry: [{ countries: [String], layout: String, theme: String, _id: false }],
      skipWorkerTypes: { type: [String], default: ['Contractor'] },
      joinersToApproval: { type: Boolean, default: true },
    },
    guardPct: { type: Number, default: 10 },
    lastSyncAt: Date,
    lastError: String,
    issues: [
      {
        id: String,
        who: String,
        why: String,
        fix: String,
        _id: false,
      },
    ],
    // Records waiting in the provider (used by CSV / SCIM / pushed data)
    pendingRecords: { type: [Schema.Types.Mixed], select: false },
  },
  opts,
);

export const SyncRunSchema = new Schema(
  {
    companyId: { type: ObjectId, required: true, index: true },
    integrationId: ObjectId,
    provider: String,
    dryRun: Boolean,
    status: { type: String, enum: ['running', 'done', 'paused', 'failed'], default: 'running' },
    created: { type: Number, default: 0 },
    updated: { type: Number, default: 0 },
    deactivated: { type: Number, default: 0 },
    skipped: { type: Number, default: 0 },
    issues: [String],
    trigger: String,
    finishedAt: Date,
  },
  opts,
);

/* ---------- Activity / audit ---------- */
export const ActivitySchema = new Schema(
  {
    companyId: { type: ObjectId, index: true },
    cardId: { type: ObjectId, index: true },
    actor: String,
    action: String,
    text: String,
    meta: Schema.Types.Mixed,
    platform: { type: Boolean, default: false },
    ip: String,
  },
  opts,
);
ActivitySchema.index({ platform: 1, createdAt: -1 });

/* ---------- Support, notes, billing ---------- */
export const TicketSchema = new Schema(
  {
    companyId: { type: ObjectId, required: true, index: true },
    number: Number,
    subject: String,
    status: { type: String, enum: ['open', 'pending', 'closed'], default: 'open' },
    priority: { type: String, enum: ['low', 'normal', 'high', 'urgent'], default: 'normal' },
    assignee: String,
    openedBy: { name: String, role: String, email: String },
    slaDueAt: Date,
    messages: [
      {
        author: String,
        kind: { type: String, enum: ['customer', 'staff', 'system', 'internal'] },
        body: String,
        at: { type: Date, default: Date.now },
        _id: false,
      },
    ],
  },
  opts,
);

export const NoteSchema = new Schema(
  { companyId: { type: ObjectId, index: true }, author: String, body: String },
  opts,
);

export const InvoiceSchema = new Schema(
  {
    companyId: { type: ObjectId, index: true },
    number: String,
    amount: Number,
    currency: { type: String, default: 'USD' },
    status: { type: String, enum: ['paid', 'open', 'failed'], default: 'open' },
    periodStart: Date,
    periodEnd: Date,
    seats: Number,
    plan: String,
  },
  opts,
);

export const DemoRequestSchema = new Schema(
  { name: String, email: String, company: String, size: String, hr: String, message: String, status: { type: String, default: 'new' } },
  opts,
);

/* ---------- Platform (product owner console) ---------- */
const PlanSnapshot = new Schema({ version: Number, pricePerSeat: Number, minSeats: Number, at: Date, by: String }, { _id: false });

export const PlanSchema = new Schema(
  {
    key: { type: String, required: true, unique: true }, // matches Company.plan
    name: { type: String, required: true },
    version: { type: Number, default: 1 },
    pricePerSeat: { type: Number, required: true }, // USD per seat per month
    minSeats: { type: Number, default: 1 },
    regionalPrices: { type: Map, of: Number, default: {} }, // { me: 9, eu: 10, us: 11 }
    features: [{ name: String, on: Boolean, _id: false }],
    limits: { subBrands: String, hrConnections: String, aiCredits: Number, admins: String, support: String },
    history: [PlanSnapshot],
  },
  opts,
);

export const PartnerSchema = new Schema(
  {
    name: { type: String, required: true },
    kind: { type: String, default: 'Reseller' }, // Reseller | Design agency | HR consultancy | NFC print partner
    region: String,
    commissionPct: { type: Number, default: 0 },
    contactEmail: String,
    status: { type: String, enum: ['pending', 'active', 'archived'], default: 'pending' },
  },
  opts,
);

export const CouponSchema = new Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    offer: { type: String, required: true },
    partnerId: ObjectId,
    maxUses: { type: Number, default: 10 },
    expiresAt: Date,
    status: { type: String, enum: ['active', 'archived'], default: 'active' },
  },
  opts,
);

export const LibraryTemplateSchema = new Schema(
  {
    name: { type: String, required: true },
    layout: { type: String, required: true },
    theme: { type: String, required: true },
    status: { type: String, enum: ['draft', 'live', 'retired'], default: 'draft' },
  },
  opts,
);

export const AiUsageSchema = new Schema(
  {
    companyId: { type: ObjectId, index: true },
    feature: { type: String, required: true },
    provider: String,
    ok: { type: Boolean, default: true },
    inputChars: Number,
    outputChars: Number,
    costUsd: { type: Number, default: 0 },
    helpful: { type: Boolean, default: null },
    ts: { type: Date, default: Date.now, index: true },
  },
  { versionKey: false },
);

export const AnnouncementSchema = new Schema(
  {
    message: { type: String, required: true },
    link: String,
    audience: {
      roles: { type: String, enum: ['admins', 'everyone'], default: 'admins' },
      region: { type: String, enum: ['all', 'me', 'eu', 'us'], default: 'all' },
      plan: { type: String, default: 'all' },
      companyIds: { type: [ObjectId], default: [] }, // when set, only these companies see it
    },
    status: { type: String, enum: ['draft', 'scheduled', 'live', 'archived'], default: 'draft' },
    startsAt: Date,
    endsAt: Date,
    createdBy: String,
  },
  opts,
);

export const EmailLogSchema = new Schema(
  { template: { type: String, index: true }, to: String, delivered: Boolean, ts: { type: Date, default: Date.now, index: true } },
  { versionKey: false },
);

export const DataRequestSchema = new Schema(
  {
    companyId: { type: ObjectId, required: true },
    kind: { type: String, enum: ['export_person', 'delete_person', 'delete_company'], required: true },
    subjectEmail: String, // the person, for person requests
    dueAt: { type: Date, required: true },
    status: { type: String, enum: ['open', 'done', 'rejected'], default: 'open' },
    resolvedBy: String,
    resolvedAt: Date,
  },
  opts,
);

export const FeatureFlagSchema = new Schema(
  {
    key: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    owner: String,
    on: { type: Boolean, default: false },
    rolloutPct: { type: Number, default: 0, min: 0, max: 100 },
    plans: { type: [String], default: [] }, // empty = every plan
    regions: { type: [String], default: [] }, // empty = every region
    companyIds: { type: [ObjectId], default: [] }, // always on for these
  },
  opts,
);

export const ReleaseSchema = new Schema({ version: { type: String, required: true }, notes: { type: String, required: true }, releasedAt: { type: Date, default: Date.now } }, opts);

export const IncidentSchema = new Schema(
  {
    title: { type: String, required: true },
    service: String,
    impact: { type: String, enum: ['degraded', 'outage'], default: 'degraded' },
    status: { type: String, enum: ['open', 'resolved'], default: 'open' },
    resolvedAt: Date,
    declaredBy: String,
  },
  opts,
);

/** Worst status seen per service per day, written by the health job. */
export const HealthSampleSchema = new Schema(
  { service: { type: String, required: true }, day: { type: String, required: true }, status: { type: String, enum: ['healthy', 'degraded', 'down'] } },
  { versionKey: false },
);
HealthSampleSchema.index({ service: 1, day: 1 }, { unique: true });

/** Small key/value store for platform-wide settings (email copy, AI switches, access review). */
export const PlatformSettingSchema = new Schema({ key: { type: String, required: true, unique: true }, value: Schema.Types.Mixed }, opts);

export const MODELS = {
  Company: CompanySchema,
  User: UserSchema,
  MagicToken: MagicTokenSchema,
  Department: DepartmentSchema,
  Employee: EmployeeSchema,
  Template: TemplateSchema,
  Card: CardSchema,
  Lead: LeadSchema,
  Event: EventSchema,
  NfcDevice: NfcDeviceSchema,
  NfcOrder: NfcOrderSchema,
  Integration: IntegrationSchema,
  SyncRun: SyncRunSchema,
  Activity: ActivitySchema,
  Ticket: TicketSchema,
  Note: NoteSchema,
  Invoice: InvoiceSchema,
  DemoRequest: DemoRequestSchema,
  Plan: PlanSchema,
  Partner: PartnerSchema,
  Coupon: CouponSchema,
  LibraryTemplate: LibraryTemplateSchema,
  AiUsage: AiUsageSchema,
  Announcement: AnnouncementSchema,
  EmailLog: EmailLogSchema,
  DataRequest: DataRequestSchema,
  FeatureFlag: FeatureFlagSchema,
  Release: ReleaseSchema,
  Incident: IncidentSchema,
  HealthSample: HealthSampleSchema,
  PlatformSetting: PlatformSettingSchema,
};

export const oid = (id: string | Types.ObjectId) => new Types.ObjectId(String(id));
export const isOid = (id: unknown) => typeof id === 'string' && Types.ObjectId.isValid(id) && id.length === 24;
