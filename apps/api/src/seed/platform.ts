/**
 * Demo data for the owner console's platform pages: partners, coupons, feature flags,
 * releases, announcements, privacy requests and AI usage.
 *
 * Runs as part of `npm run seed`, or alone without wiping anything:
 *   npm run seed:platform -w apps/api
 * Each block only fills a collection that is still empty.
 */
import mongoose from 'mongoose';
import { config } from '../config';
import { connectDb, db } from '../db/db';

const day = (n: number) => new Date(Date.now() - n * 86400_000);

export async function seedPlatform() {
  const companies = await db.Company.find().select('name plan status').lean<any[]>();
  const byName = (name: string) => companies.find((c) => c.name === name);

  if (!(await db.Partner.estimatedDocumentCount())) {
    const [gulf, najd, thames] = await db.Partner.insertMany([
      { name: 'Gulf Brand Studio', kind: 'Design agency', region: 'UAE', commissionPct: 15, status: 'active' },
      { name: 'Najd Digital', kind: 'Reseller', region: 'Saudi Arabia', commissionPct: 20, status: 'active' },
      { name: 'Thames Workplace', kind: 'HR consultancy', region: 'United Kingdom', commissionPct: 10, status: 'active' },
      { name: 'Atelier Print Co.', kind: 'NFC print partner', region: 'UAE', commissionPct: 5, status: 'pending' },
    ]);
    await db.Coupon.insertMany([
      { code: 'GULFSTUDIO15', offer: '15% off the first year', partnerId: gulf!._id, maxUses: 20, expiresAt: day(-80) },
      { code: 'NAJD-LAUNCH', offer: 'Free NFC cards for the first 50 seats', partnerId: najd!._id, maxUses: 10, expiresAt: day(-50) },
      { code: 'EVENTS-OCT', offer: 'Extended 30-day trial', maxUses: 40, expiresAt: day(-22) },
      { code: 'THAMESHR', offer: 'Onboarding service included', partnerId: thames!._id, maxUses: 15, expiresAt: day(-170) },
      { code: 'SPRING26', offer: 'Spring offer', maxUses: 18, expiresAt: day(160), status: 'archived' },
    ]);
    const credit = async (name: string, partnerId: unknown, couponCode?: string) => {
      const c = byName(name);
      if (c) await db.Company.updateOne({ _id: c._id }, { partnerId, couponCode });
    };
    await credit('Gulfstone Engineering', gulf!._id, 'GULFSTUDIO15');
    await credit('Falcon Logistics', gulf!._id, 'GULFSTUDIO15');
    await credit('Atlas Properties', najd!._id, 'NAJD-LAUNCH');
    await credit('Cedar and Vine Law', thames!._id, 'THAMESHR');
    await credit('Marina Ventures', undefined, 'EVENTS-OCT');
  }

  if (!(await db.FeatureFlag.estimatedDocumentCount())) {
    const pilots = ['Meridian Capital', 'Atlas Properties']
      .map(byName)
      .filter(Boolean)
      .map((c) => c._id);
    await db.FeatureFlag.insertMany([
      { key: 'layouts.rtl_first', name: 'Arabic-first layouts', owner: 'Design', on: true, rolloutPct: 20, regions: ['me'] },
      { key: 'ai.followup_drafts', name: 'AI follow-up emails', owner: 'AI', on: true, rolloutPct: 100 },
      { key: 'public.team_page', name: 'Team page for visitors', owner: 'Product', on: true, rolloutPct: 50, plans: ['professional', 'enterprise'] },
      { key: 'cards.video_cover', name: 'Video cover on cards', owner: 'Design', on: true, rolloutPct: 0, companyIds: pilots },
      { key: 'ai.photo_polish', name: 'Photo polish', owner: 'AI', on: false, rolloutPct: 0 },
    ]);
  }

  if (!(await db.Release.estimatedDocumentCount())) {
    await db.Release.insertMany([
      { version: '2.14', releasedAt: day(2), notes: 'Approvals show a before and after view of each card. Faster QR export for large teams.' },
      { version: '2.13', releasedAt: day(9), notes: 'Email signatures can be deployed to Gmail. The sync guard pauses unusual removals.' },
      { version: '2.12', releasedAt: day(17), notes: 'Template library with the Classic Arabic layout.' },
    ]);
  }

  if (!(await db.Announcement.estimatedDocumentCount())) {
    await db.Announcement.insertMany([
      {
        message: 'Arabic-first card layouts are now available on every plan.',
        audience: { roles: 'admins', region: 'me' },
        status: 'live',
        startsAt: day(-3),
        createdBy: 'Vellaire Owner',
      },
      {
        message: 'New: deploy email signatures to Gmail from the Sharing menu.',
        link: '/app/signatures',
        audience: { roles: 'admins' },
        status: 'live',
        startsAt: day(20),
        endsAt: day(9),
        createdBy: 'Vellaire Owner',
      },
      {
        message: 'Holiday NFC shipping dates: order by 15 December for delivery before the new year.',
        audience: { roles: 'admins' },
        status: 'draft',
        createdBy: 'Vellaire Owner',
      },
    ]);
  }

  if (!(await db.DataRequest.estimatedDocumentCount())) {
    const harbour = byName('Harbour Legal');
    const meridian = byName('Meridian Capital');
    await db.DataRequest.insertMany(
      [
        harbour && { companyId: harbour._id, kind: 'delete_person', subjectEmail: 'former.associate@harbourlegal.example', dueAt: day(-3) },
        meridian && { companyId: meridian._id, kind: 'export_person', subjectEmail: 'daniel.reyes@meridian.com', dueAt: day(-12) },
      ].filter(Boolean),
    );
  }

  if (!(await db.AiUsage.estimatedDocumentCount())) {
    const features = ['bio', 'translate', 'follow_up', 'scan', 'mapping', 'brand'];
    const weights = [8, 6, 5, 3, 2, 1];
    const busy = ['Meridian Capital', 'Atlas Properties', 'Gulfstone Engineering', 'Falcon Logistics', 'Harbour Legal'].map(byName).filter(Boolean);
    const rows: any[] = [];
    busy.forEach((c, ci) => {
      const total = [140, 90, 60, 40, 15][ci]!;
      for (let i = 0; i < total; i++) {
        let pick = (i * 7 + ci) % weights.reduce((a, b) => a + b, 0);
        const fi = weights.findIndex((w) => (pick -= w) < 0);
        rows.push({
          companyId: c._id,
          feature: features[fi],
          provider: 'claude',
          ok: i % 37 !== 0,
          inputChars: 900,
          outputChars: 400,
          costUsd: 0.004,
          helpful: i % 5 === 0 ? i % 15 !== 0 : null,
          ts: new Date(Date.now() - ((i * 9973) % (6 * 86400_000))),
        });
      }
    });
    await db.AiUsage.insertMany(rows);
  }
}

if (require.main === module) {
  connectDb(config.mongoUri)
    .then(seedPlatform)
    .then(() => console.log('Platform demo data ready.'))
    .catch((e) => {
      console.error(e);
      process.exitCode = 1;
    })
    .finally(() => mongoose.disconnect());
}
