import {
  CanActivate,
  createParamDecorator,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { db } from '../db/db';
import { requestContext } from './context';

export const SESSION_COOKIE = 'vl_session';

export type Role = 'owner' | 'admin' | 'brand_manager' | 'hr_manager' | 'dept_manager' | 'member';
export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  platformRole: 'staff' | null;
  companyId: string | null; // effective company (impersonated one for staff)
  employeeId: string | null;
  impersonating: boolean;
}

interface Claims {
  uid: string;
  imp?: string; // company id a platform staff member is viewing as
}

export const signSession = (claims: Claims) => jwt.sign(claims, config.jwtSecret, { expiresIn: '30d' });

export const cookieOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: config.isProd,
  maxAge: 30 * 24 * 3600 * 1000,
  path: '/',
};

const IS_PUBLIC = 'isPublic';
const ROLES = 'roles';
const PLATFORM = 'platform';
const MEMBER_OK = 'memberOk';
const SIGNED_IN = 'signedIn';

/** No sign-in needed. */
export const Public = () => SetMetadata(IS_PUBLIC, true);
/** Company roles allowed. Platform staff viewing as a customer always pass. */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES, roles);
/** Employees (role member) may call this. Everything else is for dashboard roles only. */
export const AllowMember = () => SetMetadata(MEMBER_OK, true);
/** Any signed-in user, with or without a company (e.g. /auth/me). */
export const SignedIn = () => SetMetadata(SIGNED_IN, true);
/** Vellaire staff only (product owner console). */
export const Platform = () => SetMetadata(PLATFORM, true);

export const ADMINS: Role[] = ['owner', 'admin'];
export const MANAGERS: Role[] = ['owner', 'admin', 'brand_manager', 'hr_manager', 'dept_manager'];

export async function loadSession(token?: string): Promise<SessionUser | null> {
  if (!token) return null;
  let claims: Claims;
  try {
    claims = jwt.verify(token, config.jwtSecret) as Claims;
  } catch {
    return null;
  }
  const user = await db.User.findById(claims.uid).lean<any>();
  if (!user || user.status === 'disabled') return null;
  const staff = user.platformRole === 'staff';
  const imp = staff && claims.imp ? claims.imp : null;
  return {
    id: String(user._id),
    email: user.email,
    name: user.name || user.email,
    role: imp ? 'owner' : user.role,
    platformRole: user.platformRole || null,
    companyId: imp || (user.companyId ? String(user.companyId) : null),
    employeeId: !imp && user.employeeId ? String(user.employeeId) : null,
    impersonating: !!imp,
  };
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  async canActivate(ctx: ExecutionContext) {
    const targets = [ctx.getHandler(), ctx.getClass()];
    const req = ctx.switchToHttp().getRequest();
    const user = await loadSession(req.cookies?.[SESSION_COOKIE]);
    req.user = user;
    const context = requestContext();
    if (context) context.companyId = user?.companyId ?? null;
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, targets)) return true;
    if (!user) throw new UnauthorizedException('Please sign in');
    if (this.reflector.getAllAndOverride<boolean>(SIGNED_IN, targets)) return true;

    if (this.reflector.getAllAndOverride<boolean>(PLATFORM, targets)) {
      if (user.platformRole !== 'staff') throw new ForbiddenException('Vellaire staff only');
      return true;
    }
    if (!user.companyId) throw new ForbiddenException('No company workspace');
    if (user.role === 'member' && !this.reflector.getAllAndOverride<boolean>(MEMBER_OK, targets)) {
      throw new ForbiddenException('This is for company admins');
    }
    const roles = this.reflector.getAllAndOverride<Role[]>(ROLES, targets);
    if (roles?.length && !roles.includes(user.role)) {
      throw new ForbiddenException('Your role cannot do this');
    }
    return true;
  }
}

export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): SessionUser => {
  return ctx.switchToHttp().getRequest().user;
});
