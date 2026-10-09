import { BadRequestException } from '@nestjs/common';
import { logActivity, slugify } from '../../common/util';
import { db } from '../../db/db';

const TRIAL_DAYS = 14;

/** A coupon a new customer can still use; throws a friendly error otherwise. */
export async function usableCoupon(code?: string) {
  if (!code) return null;
  const coupon = await db.Coupon.findOne({ code: code.trim().toUpperCase(), status: 'active' }).lean<any>();
  const used = coupon ? await db.Company.countDocuments({ couponCode: coupon.code }) : 0;
  if (!coupon || (coupon.expiresAt && coupon.expiresAt < new Date()) || used >= coupon.maxUses) throw new BadRequestException('This code is not valid or has expired');
  return coupon;
}

/**
 * Self-serve sign-up: a trial company, its default template and its owner.
 * The owner lands in the five setup steps on first sign-in.
 */
export async function createWorkspace(d: { company: string; ownerName: string; email: string; coupon?: string; via: string }) {
  const email = d.email.toLowerCase();
  if (await db.User.exists({ email })) throw new BadRequestException('This email already has a Vellaire account. Sign in instead.');
  const coupon = await usableCoupon(d.coupon);

  let slug = slugify(d.company) || 'company';
  if (await db.Company.exists({ slug })) slug = `${slug}-${Date.now().toString(36).slice(-4)}`;
  const company = await db.Company.create({
    name: d.company.trim(),
    slug,
    plan: 'professional',
    seats: 25,
    status: 'trial',
    trialEndsAt: new Date(Date.now() + TRIAL_DAYS * 86400_000),
    setup: { step: 1, done: false },
    couponCode: coupon?.code,
    partnerId: coupon?.partnerId,
  });
  await db.Template.create({ companyId: company._id, name: 'Company default', layout: 'classic', theme: 'obsidian_gold', isDefault: true });
  const user = await db.User.create({ email, name: d.ownerName.trim(), companyId: company._id, role: 'owner', status: 'invited' });
  await logActivity({ companyId: company._id, actor: d.ownerName, action: 'company.created', text: `${company.name} signed up with ${d.via}`, platform: true });
  return { company, user };
}
