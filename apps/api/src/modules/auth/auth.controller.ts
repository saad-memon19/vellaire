import { BadRequestException, Body, ForbiddenException, Controller, Get, HttpException, HttpStatus, Param, Post, Query, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { config } from '../../config';
import { cookieOptions, CurrentUser, Platform, Public, Roles, SESSION_COOKIE, SessionUser, SignedIn, signSession } from '../../common/auth';
import { ensureMemberUser } from '../../common/cards';
import { flagsFor } from '../../common/platform';
import { createWorkspace } from '../onboarding/workspace';
import { mailReady } from '../../common/mail';
import { checkPassword, hashPassword, passwordSchema } from '../../common/password';
import { codeHash, createResetLink, MAX_CODE_ATTEMPTS, sendResetLink, sendSignInLink, showLinksOnScreen } from './signin-link';
import { logActivity, parse, requireId, sha256, toCsv, token } from '../../common/util';
import { db } from '../../db/db';
import { AiService } from '../ai/ai.service';

const homeFor = (u: { platformRole?: string | null; companyId?: unknown; role?: string; setupPending?: boolean }) => {
  if (u.platformRole === 'staff' && !u.companyId) return '/console';
  if (u.role === 'member') return '/m';
  return u.setupPending ? '/setup' : '/app';
};

/** Owners and admins of a self-serve sign-up finish the setup steps before the dashboard. */
const setupPending = async (u: { companyId?: unknown; role?: string }) =>
  !!u.companyId && u.role !== 'member' && !!(await db.Company.exists({ _id: u.companyId, 'setup.done': false }));

const demoEnabled = () => !config.isProd || process.env.DEMO_LOGIN === '1';
const SIGNUP_COOKIE = 'vl_signup';
const MAX_PASSWORD_TRIES = 5;

const OAUTH = {
  google: {
    auth: 'https://accounts.google.com/o/oauth2/v2/auth',
    token: 'https://oauth2.googleapis.com/token',
    scope: 'openid email profile',
  },
  microsoft: {
    auth: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    token: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    scope: 'openid email profile',
  },
} as const;
type OAuthProvider = keyof typeof OAUTH;

/** Signs a person in: sets the session cookie and says where they land. Used by every way of signing in. */
export async function startSession(res: Response, user: any) {
  // A suspended account stays suspended; signing in only turns an invite into an active account
  if (user.status === 'disabled') throw new ForbiddenException('This account is suspended. Contact your company admin.');
  await db.User.updateOne({ _id: user._id }, { lastLoginAt: new Date(), status: 'active' });
  if (user.platformRole === 'staff')
    await logActivity({
      actor: user.name || user.email,
      action: 'staff.signin',
      text: 'Signed in to the console',
      platform: true,
    });
  res.cookie(SESSION_COOKIE, signSession({ uid: String(user._id) }), cookieOptions);
  return { redirect: homeFor({ ...(user.toObject?.() ?? user), setupPending: await setupPending(user) }) };
}

@Controller('auth')
export class AuthController {
  constructor(private ai: AiService) {}

  private login(res: Response, user: any) {
    return startSession(res, user);
  }

  @Public()
  @Get('providers')
  providers() {
    return {
      google: !!config.oauth.google.id,
      microsoft: !!config.oauth.microsoft.id,
      // Email sign-in links work once an email provider is set (or on screen in local development)
      email: mailReady() || showLinksOnScreen(),
    };
  }

  /** Email and password. Five wrong tries lock the account for 15 minutes. */
  @Public()
  @Post('password')
  async passwordLogin(@Body() body: unknown, @Res({ passthrough: true }) res: Response) {
    const d = parse(z.object({ email: z.string().email('Enter your email'), password: z.string().min(1, 'Enter your password').max(200) }), body);
    const wrong = new BadRequestException('Email or password is not right. No password yet? Use “Forgot password”.');
    const user = await db.User.findOne({ email: d.email.toLowerCase() }).select('+passwordHash');
    if (!user) throw wrong;
    if (user.lockedUntil && user.lockedUntil > new Date()) throw new HttpException('Too many wrong passwords. Try again in 15 minutes, or reset your password.', HttpStatus.TOO_MANY_REQUESTS);
    if (!(await checkPassword(d.password, user.passwordHash))) {
      const failed = (user.failedLogins || 0) + 1;
      await db.User.updateOne({ _id: user._id }, failed >= MAX_PASSWORD_TRIES ? { failedLogins: 0, lockedUntil: new Date(Date.now() + 15 * 60_000) } : { failedLogins: failed });
      throw wrong;
    }
    await db.User.updateOne({ _id: user._id }, { failedLogins: 0, $unset: { lockedUntil: 1 } });
    return this.login(res, user);
  }

  /** "Forgot password": emails a reset link. The answer is the same whether or not the email has an account. */
  @Public()
  @Post('forgot')
  async forgot(@Body() body: unknown) {
    const { email } = parse(z.object({ email: z.string().email('Enter your email') }), body);
    if (!mailReady() && !showLinksOnScreen())
      return {
        sent: false,
        message: 'Email is not set up yet, so we cannot send a reset link. Ask your company admin for a password link.',
      };
    const generic = { sent: true, message: 'If this email has a Vellaire account, a reset link is on its way.' };
    const user = await db.User.findOne({ email: email.toLowerCase() }).lean<any>();
    if (!user || user.status === 'disabled') return generic;
    const devLink = await sendResetLink(user.email);
    return devLink ? { ...generic, devLink } : generic;
  }

  /** Sets a new password from a reset link, then signs in. */
  @Public()
  @Post('reset')
  async reset(@Body() body: unknown, @Res({ passthrough: true }) res: Response) {
    const d = parse(z.object({ token: z.string().min(10), password: passwordSchema }), body);
    const rec = await db.MagicToken.findOneAndUpdate({ tokenHash: sha256(d.token), purpose: 'reset', used: false, expiresAt: { $gt: new Date() } }, { used: true });
    if (!rec) throw new BadRequestException('This link has expired or was already used. Ask for a new one.');
    const user = await db.User.findOne({ email: rec.email });
    if (!user) throw new BadRequestException('Account not found');
    await db.User.updateOne({ _id: user._id }, { passwordHash: await hashPassword(d.password), failedLogins: 0, $unset: { lockedUntil: 1 } });
    return this.login(res, user);
  }

  /** Set or change your own password. Changing one needs the current password. */
  @SignedIn()
  @Post('change-password')
  async changePassword(@Body() body: unknown, @CurrentUser() u: SessionUser) {
    const d = parse(z.object({ current: z.string().max(200).optional(), password: passwordSchema }), body);
    const user = await db.User.findById(u.id).select('+passwordHash');
    if (!user) throw new BadRequestException('Account not found');
    if (user.passwordHash && !(await checkPassword(d.current || '', user.passwordHash))) throw new BadRequestException('Your current password is not right');
    await db.User.updateOne({ _id: user._id }, { passwordHash: await hashPassword(d.password) });
    return { ok: true };
  }

  /** Whether you have a password yet, for the Settings screen. */
  @SignedIn()
  @Get('password')
  async hasPassword(@CurrentUser() u: SessionUser) {
    const user = await db.User.findById(u.id).select('+passwordHash').lean<any>();
    return { hasPassword: !!user?.passwordHash };
  }

  /**
   * A password link an admin shares by hand (WhatsApp, chat) when email is not set up or did not arrive.
   * Company admins and HR can make one for their own people; Vellaire staff for anyone. Valid for 24 hours.
   */
  @SignedIn()
  @Post('reset-link/:userId')
  async resetLinkFor(@Param('userId') id: string, @CurrentUser() u: SessionUser) {
    const target = await db.User.findById(requireId(id)).lean<any>();
    if (!target) throw new BadRequestException('Person not found');
    const staff = u.platformRole === 'staff' && !u.impersonating;
    const sameCompany = !!u.companyId && String(target.companyId) === u.companyId && !target.platformRole;
    const canManage = ['owner', 'admin', 'hr_manager'].includes(u.role) && (target.role !== 'owner' || u.role === 'owner');
    if (!staff && !(sameCompany && canManage)) throw new ForbiddenException('You cannot make a password link for this person');
    if (target.status === 'disabled') throw new BadRequestException('This account is suspended');
    const url = await createResetLink(target.email, 24 * 60);
    await logActivity({ companyId: target.companyId, actor: u.name, action: 'user.reset_link', text: `Password link made for ${target.name || target.email}`, platform: staff });
    return { url, expiresInHours: 24 };
  }

  /** The same for an employee, from the Employees list. Makes their app account first if they have none yet. */
  @Roles('owner', 'admin', 'hr_manager')
  @Post('reset-link/employee/:employeeId')
  async resetLinkForEmployee(@Param('employeeId') id: string, @CurrentUser() u: SessionUser) {
    const employee = await db.Employee.findOne({ _id: requireId(id), companyId: u.companyId }).lean<any>();
    if (!employee) throw new BadRequestException('Person not found');
    if (!employee.email) throw new BadRequestException('Add an email for this person first');
    const company = await db.Company.findById(u.companyId).lean<any>();
    await ensureMemberUser(company, employee);
    const user = await db.User.findOne({ email: employee.email.toLowerCase() }).lean<any>();
    if (!user || String(user.companyId) !== u.companyId || user.platformRole) throw new ForbiddenException('This email belongs to an account outside your company');
    return this.resetLinkFor(String(user._id), u);
  }

  /**
   * Password links for many employees at once, as a CSV the admin shares by hand (works without email).
   * Links last 7 days, like invites, because handing out a whole list takes longer than one link.
   * People who cannot get a link stay in the file with the reason.
   */
  @Roles('owner', 'admin', 'hr_manager')
  @Post('reset-link/employees')
  async resetLinksForEmployees(@Body() body: unknown, @CurrentUser() u: SessionUser) {
    const { ids } = parse(z.object({ ids: z.array(z.string()).min(1).max(2000) }), body);
    const company = await db.Company.findById(u.companyId).lean<any>();
    const employees = await db.Employee.find({ companyId: u.companyId, _id: { $in: ids.map(requireId) } })
      .sort({ name: 1 })
      .lean<any[]>();
    const expires = new Date(Date.now() + 7 * 24 * 60 * 60_000);
    const rows: { name: string; email: string; password_link: string; expires: string; note: string }[] = [];
    for (const e of employees) {
      const row = { name: e.name, email: e.email || '', password_link: '', expires: '', note: '' };
      rows.push(row);
      if (!e.email) {
        row.note = 'No email: add one first';
        continue;
      }
      await ensureMemberUser(company, e);
      const user = await db.User.findOne({ email: e.email.toLowerCase() }).lean<any>();
      if (!user || String(user.companyId) !== u.companyId || user.platformRole) row.note = 'Email belongs to an account outside your company';
      else if (user.status === 'disabled') row.note = 'Account suspended';
      else if (user.role === 'owner' && u.role !== 'owner') row.note = 'Only an owner can make this link';
      else {
        row.password_link = await createResetLink(user.email, 7 * 24 * 60);
        row.expires = expires.toISOString().slice(0, 10);
      }
    }
    const made = rows.filter((r) => r.password_link).length;
    if (made) await logActivity({ companyId: u.companyId, actor: u.name, action: 'user.reset_link', text: `Password links made for ${made} people` });
    return { csv: toCsv(rows), made, skipped: rows.length - made };
  }

  /**
   * Demo access: one-click sign-in as a demo user, so the product can be seen without the email form.
   * On in development; in production only when DEMO_LOGIN=1.
   */
  @Public()
  @Get('demo')
  demoInfo() {
    return { enabled: demoEnabled() };
  }

  @Public()
  @Post('demo')
  async demo(@Body() body: unknown, @Res({ passthrough: true }) res: Response) {
    if (!demoEnabled()) throw new BadRequestException('Demo access is turned off');
    const { as } = parse(z.object({ as: z.enum(['owner', 'employee', 'console']) }), body);
    let user: any;
    if (as === 'employee') {
      // An employee whose card is live, so the app has something to show
      const members = await db.User.find({
        role: 'member',
        status: { $ne: 'disabled' },
        employeeId: { $ne: null },
      }).limit(50);
      for (const m of members) {
        const e = await db.Employee.findById(m.employeeId).select('cardId').lean<any>();
        if (e?.cardId && (await db.Card.exists({ _id: e.cardId, status: 'live' }))) {
          user = m;
          break;
        }
      }
    } else {
      const email = as === 'owner' ? 'sara.khan@meridian.com' : config.platformAdmins[0] || 'owner@vellaire.app';
      user = await db.User.findOne({ email });
    }
    if (!user) throw new BadRequestException('Demo data is missing. Run npm run seed first.');
    return this.login(res, user);
  }

  @Public()
  @Post('start')
  async start(@Body() body: unknown) {
    const { email } = parse(z.object({ email: z.string().email() }), body);
    const user = await db.User.findOne({
      email: email.toLowerCase(),
    }).lean<any>();
    const generic = {
      sent: true,
      message: 'If this email has a Vellaire account, a sign-in link is on its way.',
    };
    if (!mailReady() && !showLinksOnScreen()) throw new BadRequestException('Email sign-in is not set up yet. Sign in with your password.');
    if (!user || user.status === 'disabled') return generic;
    const devLink = await sendSignInLink(user.email);
    return devLink ? { ...generic, devLink } : generic;
  }

  /** The 6-digit code from the sign-in email; five wrong tries and that code stops working. */
  @Public()
  @Post('verify-code')
  async verifyCode(@Body() body: unknown, @Res({ passthrough: true }) res: Response) {
    const d = parse(z.object({ email: z.string().email(), code: z.string().regex(/^\d{6}$/, 'Enter the 6-digit code') }), body);
    const email = d.email.toLowerCase();
    const rec = await db.MagicToken.findOne({ email, purpose: { $ne: 'reset' }, used: false, expiresAt: { $gt: new Date() }, codeHash: { $exists: true } }).sort({ createdAt: -1 });
    if (!rec || rec.attempts >= MAX_CODE_ATTEMPTS) throw new BadRequestException('This code has expired. Request a new one.');
    if (rec.codeHash !== codeHash(email, d.code)) {
      rec.attempts += 1;
      await rec.save();
      throw new BadRequestException(rec.attempts >= MAX_CODE_ATTEMPTS ? 'Too many tries. Request a new code.' : 'That code is not right. Check the email and try again.');
    }
    rec.used = true;
    await rec.save();
    const user = await db.User.findOne({ email });
    if (!user) throw new BadRequestException('Account not found');
    return this.login(res, user);
  }

  @Public()
  @Post('verify')
  async verify(@Body() body: unknown, @Res({ passthrough: true }) res: Response) {
    const { token: t } = parse(z.object({ token: z.string().min(10) }), body);
    // A password-reset link is not a sign-in link
    const rec = await db.MagicToken.findOneAndUpdate({ tokenHash: sha256(t), purpose: { $ne: 'reset' }, used: false, expiresAt: { $gt: new Date() } }, { used: true });
    if (!rec) throw new BadRequestException('This link has expired or was already used. Request a new one.');
    const user = await db.User.findOne({ email: rec.email });
    if (!user) throw new BadRequestException('Account not found');
    return this.login(res, user);
  }

  @Public()
  @Get('oauth/:provider')
  oauthStart(@Param('provider') p: string, @Query() q: { company?: string; coupon?: string }, @Res() res: Response) {
    const provider = p as OAuthProvider;
    const cfg = config.oauth[provider];
    if (!OAUTH[provider] || !cfg?.id) return res.redirect(`${config.webUrl}/${q.company ? 'signup' : 'signin'}?error=provider`);
    const state = token(16);
    res.cookie('vl_oauth_state', state, {
      ...cookieOptions,
      maxAge: 10 * 60_000,
    });
    // Sign-up with Google or Microsoft: remember the company until the provider sends the person back
    if (q.company) res.cookie(SIGNUP_COOKIE, JSON.stringify({ company: q.company.slice(0, 120), coupon: q.coupon?.slice(0, 24) }), { ...cookieOptions, maxAge: 10 * 60_000 });
    const url = new URL(OAUTH[provider].auth);
    url.searchParams.set('client_id', cfg.id);
    url.searchParams.set('redirect_uri', `${config.webUrl}/api/auth/oauth/${provider}/callback`);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', OAUTH[provider].scope);
    url.searchParams.set('state', state);
    url.searchParams.set('prompt', 'select_account');
    return res.redirect(url.toString());
  }

  @Public()
  @Get('oauth/:provider/callback')
  async oauthCallback(@Param('provider') p: string, @Query() q: { code?: string; state?: string }, @Req() req: Request, @Res() res: Response) {
    const provider = p as OAuthProvider;
    const cfg = config.oauth[provider];
    const fail = (code: string) => res.redirect(`${config.webUrl}/signin?error=${code}`);
    if (!OAUTH[provider] || !cfg?.id || !q.code) return fail('provider');
    if (!q.state || q.state !== req.cookies?.vl_oauth_state) return fail('state');

    const tokenRes = await fetch(OAUTH[provider].token, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code: q.code,
        client_id: cfg.id,
        client_secret: cfg.secret,
        redirect_uri: `${config.webUrl}/api/auth/oauth/${provider}/callback`,
        grant_type: 'authorization_code',
      }),
    });
    if (!tokenRes.ok) return fail('token');
    const json: any = await tokenRes.json();
    // The id_token comes straight from the provider over TLS, so its payload can be read directly.
    const payload = JSON.parse(Buffer.from(String(json.id_token).split('.')[1] || '', 'base64url').toString());
    const email = String(payload.email || payload.preferred_username || '').toLowerCase();
    let user = email ? await db.User.findOne({ email }) : null;
    const signup = req.cookies?.[SIGNUP_COOKIE];
    if (signup) res.clearCookie(SIGNUP_COOKIE, cookieOptions);
    if (!user && signup && email) {
      try {
        const s = JSON.parse(signup);
        ({ user } = await createWorkspace({ company: String(s.company), coupon: s.coupon, ownerName: String(payload.name || email.split('@')[0]), email, via: provider }));
      } catch (e) {
        return res.redirect(`${config.webUrl}/signup?error=${encodeURIComponent((e as Error).message)}`);
      }
    }
    if (!user || user.status === 'disabled') return fail('no-account');
    const { redirect } = await this.login(res, user);
    return res.redirect(`${config.webUrl}${redirect}`);
  }

  @SignedIn()
  @Get('me')
  async me(@CurrentUser() u: SessionUser) {
    const company = u.companyId
      ? await db.Company.findById(u.companyId).select('name slug plan seats status dataRegion setup brand.logos brand.colors domain settings.languages').lean<any>()
      : null;
    const pending = u.companyId
      ? await db.Card.countDocuments({
          companyId: u.companyId,
          $or: [{ status: 'pending_approval' }, { 'approval.pendingPhoto': { $nin: [null, ''] } }],
        })
      : 0;
    return {
      user: u,
      company: company && {
        id: String(company._id),
        name: company.name,
        slug: company.slug,
        plan: company.plan,
        seats: company.seats,
        status: company.status,
        logo: company.brand?.logos?.icon || company.brand?.logos?.light || null,
        accent: company.brand?.colors?.[1]?.hex || '#C9A96E',
        cardHost: company.domain?.verified ? company.domain.host : null,
        languages: company.settings?.languages || ['en'],
        // Feature flags turned on for this company (rolled out from the console)
        flags: await flagsFor(company),
      },
      badges: {
        approvals: pending,
        // Leads nobody has followed up yet, and HR syncs that need a look
        leads:
          u.companyId && u.role !== 'member'
            ? await db.Lead.countDocuments({
                companyId: u.companyId,
                status: 'new',
              })
            : 0,
        sync:
          u.companyId && u.role !== 'member'
            ? ((await db.Integration.findOne({ companyId: requireId(u.companyId) }).lean<any>())?.issues?.length ?? 2)
            : 0,
      },
      features: { ai: this.ai.enabled },
      home: homeFor({ ...u, companyId: u.impersonating ? null : u.companyId, setupPending: !u.impersonating && company?.setup?.done === false && u.role !== 'member' }),
    };
  }

  @Public()
  @Post('logout')
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(SESSION_COOKIE, { path: '/' });
    return { ok: true };
  }

  /** Vellaire staff: open a customer's dashboard exactly as they see it. Every use is logged. */
  @Platform()
  @Post('impersonate/:companyId')
  async impersonate(@Param('companyId') id: string, @CurrentUser() u: SessionUser, @Res({ passthrough: true }) res: Response) {
    const company = await db.Company.findById(requireId(id)).lean<any>();
    if (!company) throw new BadRequestException('Company not found');
    res.cookie(SESSION_COOKIE, signSession({ uid: u.id, imp: String(company._id) }), cookieOptions);
    await logActivity({
      companyId: company._id,
      actor: u.name,
      action: 'impersonate',
      text: `${u.name} (Vellaire) opened the dashboard as customer`,
      platform: true,
    });
    return { redirect: '/app' };
  }

  @Platform()
  @Post('impersonate-stop')
  stop(@CurrentUser() u: SessionUser, @Res({ passthrough: true }) res: Response) {
    res.cookie(SESSION_COOKIE, signSession({ uid: u.id }), cookieOptions);
    return { redirect: '/console' };
  }
}
