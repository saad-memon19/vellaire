import { BadRequestException, Body, Controller, Get, Patch, Post } from '@nestjs/common';
import { z } from 'zod';
import { ADMINS, CurrentUser, Public, Roles, SessionUser } from '../../common/auth';
import { cardUrl, createCardForEmployee, publishCard } from '../../common/cards';
import { LAYOUTS, THEMES } from '../../common/catalog';
import { found, parse } from '../../common/util';
import { db } from '../../db/db';
import { oid } from '../../db/schemas';
import { sendSignInLink } from '../auth/signin-link';
import { PROVIDERS } from '../integrations/fetchers';
import { appleReady, googleReady } from '../public/wallet';
import { createWorkspace } from './workspace';

const HEX = /^#[0-9a-fA-F]{6}$/;

@Controller('auth')
export class SignupController {
  @Public()
  @Post('signup')
  async signup(@Body() body: unknown) {
    const d = parse(
      z.object({
        firstName: z.string().trim().min(1).max(60),
        lastName: z.string().trim().min(1).max(60),
        email: z.string().email(),
        company: z.string().trim().min(2).max(120),
        coupon: z.string().max(24).optional(),
        agree: z.literal(true, { errorMap: () => ({ message: 'Please agree to the terms to continue' }) }),
      }),
      body,
    );
    const { user } = await createWorkspace({ company: d.company, ownerName: `${d.firstName} ${d.lastName}`, email: d.email, coupon: d.coupon, via: 'email' });
    const devLink = await sendSignInLink(user.email, {
      heading: `Welcome to Vellaire, ${d.firstName}`,
      line: `Your workspace for ${d.company} is ready. Use the button to sign in and finish setting up.`,
    });
    return { sent: true, ...(devLink ? { devLink } : {}) };
  }
}

/** The five setup steps after sign-up: company, brand, template, people, first card. */
@Roles(...ADMINS)
@Controller('setup')
export class SetupController {
  private company(u: SessionUser) {
    return db.Company.findById(oid(u.companyId!));
  }

  private advance(company: any, to: number) {
    company.set('setup.step', Math.max(company.setup?.step || 1, to));
  }

  @Get()
  async state(@CurrentUser() u: SessionUser) {
    const c = found(await this.company(u), 'Company');
    const [template, owner] = await Promise.all([
      db.Template.findOne({ companyId: c._id, isDefault: true }).lean<any>(),
      db.User.findById(u.id).select('name employeeId').lean<any>(),
    ]);
    const employee = owner?.employeeId ? await db.Employee.findById(owner.employeeId).lean<any>() : null;
    const card = employee?.cardId ? await db.Card.findById(employee.cardId).lean<any>() : null;
    return {
      step: c.setup?.step || 1,
      done: c.setup?.done ?? true,
      firstName: (owner?.name || '').split(' ')[0],
      ownerName: owner?.name || '',
      company: {
        name: c.name,
        website: (c.brand?.website || '').replace(/^https?:\/\//, '').replace(/\/$/, ''),
        industry: c.industry || '',
        size: c.size || '',
        country: c.country || '',
        languages: c.settings?.languages || ['en'],
      },
      brand: { logo: c.brand?.logos?.light || '', colors: c.brand?.colors || [], fonts: c.brand?.fonts, theme: template?.theme || 'obsidian_gold' },
      layout: template?.layout || 'classic',
      people: c.setup?.people || 'hr',
      card: card && { id: String(card._id), url: cardUrl(c, card.slug), status: card.status },
      wallet: { apple: appleReady(), google: googleReady() },
      providers: PROVIDERS.map((p) => ({ id: p.id, name: p.name })),
      layouts: LAYOUTS,
      themes: THEMES.filter((t) => !t.id.startsWith('brand') && t.id !== 'white_brand'),
    };
  }

  @Patch('company')
  async saveCompany(@Body() body: unknown, @CurrentUser() u: SessionUser) {
    const d = parse(
      z.object({
        name: z.string().trim().min(2).max(120),
        website: z.string().max(200).optional(),
        industry: z.string().max(60).optional(),
        size: z.string().max(40).optional(),
        country: z.string().max(80).optional(),
        languages: z.array(z.string().min(2).max(5)).min(1).max(6),
      }),
      body,
    );
    const c = found(await this.company(u), 'Company');
    c.set({ name: d.name, industry: d.industry, size: d.size, country: d.country, 'settings.languages': d.languages });
    if (d.website) c.set('brand.website', /^https?:\/\//.test(d.website) ? d.website : `https://${d.website}`);
    this.advance(c, 2);
    await c.save();
    return { ok: true };
  }

  @Patch('brand')
  async saveBrand(@Body() body: unknown, @CurrentUser() u: SessionUser) {
    const d = parse(
      z.object({
        colors: z
          .array(z.object({ name: z.string().max(40), use: z.string().max(60), hex: z.string().regex(HEX) }))
          .min(1)
          .max(6),
        theme: z.enum(THEMES.map((t) => t.id) as [string, ...string[]]),
        logo: z.string().max(500).optional(),
        fonts: z.object({ display: z.string().max(60), body: z.string().max(60) }).optional(),
      }),
      body,
    );
    const c = found(await this.company(u), 'Company');
    c.set({ 'brand.colors': d.colors, 'settings.defaultTheme': d.theme });
    if (d.fonts) c.set({ 'brand.fonts.display': d.fonts.display, 'brand.fonts.body': d.fonts.body });
    if (d.logo) c.set({ 'brand.logos.light': d.logo, 'brand.logos.icon': c.brand?.logos?.icon || d.logo });
    this.advance(c, 3);
    await c.save();
    await db.Template.updateOne({ companyId: c._id, isDefault: true }, { theme: d.theme });
    return { ok: true };
  }

  @Patch('template')
  async saveTemplate(@Body() body: unknown, @CurrentUser() u: SessionUser) {
    const { layout } = parse(z.object({ layout: z.enum(LAYOUTS.map((l) => l.id) as [string, ...string[]]) }), body);
    const c = found(await this.company(u), 'Company');
    c.set('settings.defaultLayout', layout);
    this.advance(c, 4);
    await c.save();
    await db.Template.updateOne({ companyId: c._id, isDefault: true }, { layout });
    return { ok: true };
  }

  /** Records how people will be added, then makes the owner's own card so they can try it. */
  @Patch('people')
  async savePeople(@Body() body: unknown, @CurrentUser() u: SessionUser) {
    const d = parse(z.object({ choice: z.enum(['hr', 'csv', 'invite', 'later']), provider: z.string().optional() }), body);
    if (d.choice === 'hr' && !PROVIDERS.some((p) => p.id === d.provider)) throw new BadRequestException('Choose your HR system');
    const c = found(await this.company(u), 'Company');
    c.set('setup.people', d.choice === 'hr' ? `hr:${d.provider}` : d.choice);
    this.advance(c, 5);
    await c.save();
    await this.ownerCard(c, u);
    return { ok: true };
  }

  @Post('finish')
  async finish(@CurrentUser() u: SessionUser) {
    await db.Company.updateOne({ _id: oid(u.companyId!) }, { 'setup.done': true });
    return { redirect: '/app' };
  }

  private async ownerCard(company: any, u: SessionUser) {
    const user = found(await db.User.findById(u.id), 'User');
    let employee = user.employeeId ? await db.Employee.findById(user.employeeId) : null;
    if (!employee) {
      const [firstName, ...rest] = (user.name || user.email).split(' ');
      employee = await db.Employee.create({ companyId: company._id, name: user.name || user.email, firstName, lastName: rest.join(' '), email: user.email, source: 'manual' });
      user.employeeId = employee._id;
      await user.save();
    }
    const card = await createCardForEmployee(company.toObject(), employee.toObject(), { actor: user.name || user.email });
    if (card.status !== 'live') await publishCard(card._id, { name: user.name || user.email, role: 'owner' }, { skipApproval: true });
  }
}
