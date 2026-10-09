import 'dotenv/config';

const list = (v?: string) =>
  (v || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

export const config = {
  port: Number(process.env.PORT || 4000),
  mongoUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/vellaire',
  webUrl: (process.env.WEB_URL || 'http://localhost:3000').replace(/\/$/, ''),
  jwtSecret: process.env.JWT_SECRET || 'dev-secret',
  isProd: process.env.NODE_ENV === 'production',
  platformAdmins: list(process.env.PLATFORM_ADMIN_EMAILS),
  mail: {
    resendKey: process.env.RESEND_API_KEY || '',
    from: process.env.MAIL_FROM || 'Vellaire <hello@vellaire.app>',
  },
  ai: {
    provider: (process.env.AI_PROVIDER || 'none').toLowerCase() as 'none' | 'claude' | 'openai',
    apiKey: process.env.AI_API_KEY || '',
    model: process.env.AI_MODEL || '',
    // Your provider's price in USD per million tokens, used for the console's cost estimate
    costInPerMTok: Number(process.env.AI_COST_IN_PER_MTOK || 0),
    costOutPerMTok: Number(process.env.AI_COST_OUT_PER_MTOK || 0),
  },
  oauth: {
    google: { id: process.env.GOOGLE_CLIENT_ID || '', secret: process.env.GOOGLE_CLIENT_SECRET || '' },
    microsoft: { id: process.env.MICROSOFT_CLIENT_ID || '', secret: process.env.MICROSOFT_CLIENT_SECRET || '' },
  },
  uploadDir: process.env.UPLOAD_DIR || 'uploads',
};

export type PlanId = 'starter' | 'professional' | 'enterprise';
export interface PlanTerms {
  name: string;
  pricePerSeat: number; // USD per seat per month
  minSeats: number;
}

// Starting prices. The Plan collection is the source of truth once the API starts:
// common/platform.ts loads it into this object, and console edits update it in place.
export const PLANS: Record<PlanId, PlanTerms> = {
  starter: { name: 'Starter', pricePerSeat: 6, minSeats: 10 },
  professional: { name: 'Professional', pricePerSeat: 9, minSeats: 50 },
  enterprise: { name: 'Enterprise', pricePerSeat: 12, minSeats: 250 },
};
