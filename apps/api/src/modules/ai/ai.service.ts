import { ForbiddenException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { config } from '../../config';
import { requestContext } from '../../common/context';
import { aiCreditsFor, getSetting } from '../../common/platform';
import { db } from '../../db/db';
import { AiImage, AiProvider, createProvider } from './providers';

/** Every AI feature, as the console lists it. */
export const AI_FEATURES = {
  bio: 'Bio writer',
  translate: 'Translation',
  follow_up: 'Follow-up email drafts',
  scan: 'Paper card scanner',
  mapping: 'Field mapping suggestions',
  brand: 'Brand extraction',
  support: 'Support reply drafts',
  upsell: 'Seat upgrade emails',
} as const;
export type AiFeature = keyof typeof AI_FEATURES;

// Rough cost estimate: about four characters per token, priced per million tokens from .env
const costOf = (inputChars: number, outputChars: number) =>
  ((inputChars / 4) * config.ai.costInPerMTok + (outputChars / 4) * config.ai.costOutPerMTok) / 1e6;

const monthStart = () => {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
};

const VOICE =
  'You write for Vellaire, a premium digital business card platform. Write in calm, precise, professional English. ' +
  'No exclamation marks, no emoji, no hype words. Return only the requested text with no preamble.';

/** Pulls the first JSON object or array out of a model reply. */
function parseJson<T>(text: string): T {
  const m = text.match(/[\[{][\s\S]*[\]}]/);
  if (!m) throw new Error('AI returned no JSON');
  return JSON.parse(m[0]) as T;
}

@Injectable()
export class AiService {
  private provider: AiProvider | null = createProvider();

  get enabled() {
    return !!this.provider;
  }
  get providerName() {
    return this.provider?.name || 'none';
  }

  private async run(feature: AiFeature, system: string, prompt: string, maxTokens = 1200, images?: AiImage[]) {
    if (!this.provider) throw new ServiceUnavailableException('AI is turned off for this workspace');
    const disabled = await getSetting<string[]>('ai.disabled', []);
    if (disabled.includes(feature)) throw new ServiceUnavailableException(`${AI_FEATURES[feature]} is switched off for now`);
    const companyId = requestContext()?.companyId || null;
    if (companyId) await this.checkCredits(companyId);

    const fullSystem = `${VOICE}\n\n${system}`;
    const inputChars = fullSystem.length + prompt.length;
    try {
      const out = await this.provider.complete({ system: fullSystem, prompt, maxTokens, images });
      await this.record({ companyId, feature, ok: true, inputChars, outputChars: out.length });
      return out;
    } catch (e) {
      await this.record({ companyId, feature, ok: false, inputChars, outputChars: 0 });
      throw e;
    }
  }

  /** Plans include AI credits per live card each month; stop politely once a company has used them. */
  private async checkCredits(companyId: string) {
    const company = await db.Company.findById(companyId).select('plan').lean<any>();
    const perCard = aiCreditsFor(company?.plan);
    if (perCard === null) return;
    const [used, cards] = await Promise.all([
      db.AiUsage.countDocuments({ companyId, ts: { $gte: monthStart() } }),
      db.Card.countDocuments({ companyId, status: 'live' }),
    ]);
    if (used >= perCard * Math.max(cards, 1)) throw new ForbiddenException('Your AI credits for this month are used up. They renew on the 1st.');
  }

  private record(u: { companyId: string | null; feature: AiFeature; ok: boolean; inputChars: number; outputChars: number }) {
    return db.AiUsage.create({ ...u, provider: this.providerName, costUsd: costOf(u.inputChars, u.outputChars) }).catch(() => undefined);
  }

  bio(input: { name: string; title?: string; department?: string; office?: string; company: string; keywords?: string; tone?: 'formal' | 'warm' | 'short' }) {
    const tone = { formal: 'Formal and precise.', warm: 'Warm and personable.', short: 'One short sentence, under 140 characters.' }[input.tone || 'formal'];
    return this.run(
      'bio',
      `Write a 2–3 sentence professional bio in the third person for a business card. Maximum 300 characters. Tone: ${tone} Give a different wording each time.`,
      `Name: ${input.name}\nTitle: ${input.title || ''}\nDepartment: ${input.department || ''}\nOffice: ${input.office || ''}\nCompany: ${input.company}\nKeywords: ${input.keywords || ''}`,
      400,
    );
  }

  async translate(fields: Record<string, string>, language: string) {
    const out = await this.run(
      'translate',
      `Translate each value into ${language}. Keep personal names as they are usually written in ${language}. ` +
        'Return a JSON object with exactly the same keys.',
      JSON.stringify(fields),
      1200,
    );
    return parseJson<Record<string, string>>(out);
  }

  followUp(input: { leadName: string; leadCompany?: string; note?: string; senderName: string; senderTitle?: string; company: string; tone?: string }) {
    return this.run(
      'follow_up',
      'Write a short follow-up email (under 90 words) from the sender to a person they just met. ' +
        'Start with "Dear <first name>,". Refer to their note if given, propose a next step, sign off with the sender first name. ' +
        `Tone: ${input.tone || 'warm and professional'}.`,
      `Sender: ${input.senderName}, ${input.senderTitle || ''} at ${input.company}\nThey met: ${input.leadName}${input.leadCompany ? `, ${input.leadCompany}` : ''}\nTheir note: ${input.note || '(none)'}`,
      500,
    );
  }

  async mapFields(source: { src: string; sample?: string }[], targets: string[]) {
    const out = await this.run(
      'mapping',
      'Match HR system fields to business card fields. Return a JSON array of {"src": string, "dst": string} ' +
        `where dst is one of: ${targets.join(', ')} or "" when nothing fits.`,
      JSON.stringify(source),
      1500,
    );
    return parseJson<{ src: string; dst: string }[]>(out);
  }

  async scanCard(image: AiImage) {
    const out = await this.run(
      'scan',
      'Read this photo of a paper business card. Return a JSON object with keys name, company, jobTitle, email, phone, website. Use "" for anything missing.',
      'Extract the contact details.',
      600,
      [image],
    );
    return parseJson<Record<string, string>>(out);
  }

  async brandFromSite(input: { url: string; title?: string; colors: string[]; fonts: string[]; description?: string }) {
    const out = await this.run(
      'brand',
      'You are a brand designer. From the website signals, propose a business card brand kit. Return JSON: ' +
        '{"colors":[{"name":string,"use":string,"hex":string}] (3 colours: card background, accent, text), "display": Google font for names, "body": Google font for details, "theme": one of obsidian_gold|ivory_ink|navy_silver|forest_brass|white_brand}.',
      JSON.stringify(input),
      700,
    );
    return parseJson<any>(out);
  }

  supportReply(input: { subject: string; thread: string; company: string; context?: string }) {
    return this.run(
      'support',
      'You help Vellaire support staff. Draft a short, kind reply to the customer (under 100 words). Be concrete about the next step.',
      `Company: ${input.company}\nSubject: ${input.subject}\nContext: ${input.context || ''}\nThread:\n${input.thread}`,
      500,
    );
  }

  seatUpgradeEmail(input: { company: string; owner: string; used: number; seats: number; joiners: number }) {
    return this.run(
      'upsell',
      'Draft a short account-manager email suggesting a seat upgrade. Under 110 words. Sign as "Your Vellaire team".',
      JSON.stringify(input),
      500,
    );
  }
}
