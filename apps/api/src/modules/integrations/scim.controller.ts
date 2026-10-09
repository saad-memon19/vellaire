import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Put, Query, Req, UnauthorizedException, NotFoundException } from '@nestjs/common';
import type { Request } from 'express';
import { Public } from '../../common/auth';
import { createCardForEmployee, deactivateCard, publishCard } from '../../common/cards';
import { sha256 } from '../../common/util';
import { db } from '../../db/db';
import { isOid } from '../../db/schemas';

const ENT = 'urn:ietf:params:scim:schemas:extension:enterprise:2.0:User';

/**
 * SCIM 2.0 endpoint for Microsoft Entra ID (and Okta, OneLogin…).
 * The identity provider pushes joiners, movers and leavers; each becomes a person and a card.
 */
@Public()
@Controller('scim/v2')
export class ScimController {
  private async company(req: Request) {
    const auth = String(req.headers.authorization || '');
    const t = auth.replace(/^Bearer\s+/i, '');
    if (!t) throw new UnauthorizedException();
    const c = await db.Company.findOne({ 'settings.scimTokenHash': sha256(t) }).lean<any>();
    if (!c) throw new UnauthorizedException();
    return c;
  }

  private toScim(e: any) {
    return {
      schemas: ['urn:ietf:params:scim:schemas:core:2.0:User', ENT],
      id: String(e._id),
      externalId: e.hrId,
      userName: e.email,
      active: e.status === 'active',
      displayName: e.name,
      name: { givenName: e.firstName, familyName: e.lastName, formatted: e.name },
      title: e.title,
      emails: e.email ? [{ value: e.email, type: 'work', primary: true }] : [],
      phoneNumbers: e.phone ? [{ value: e.phone, type: 'work' }] : [],
      [ENT]: { department: e.department },
      meta: { resourceType: 'User', created: e.createdAt, lastModified: e.updatedAt },
    };
  }

  private fromScim(b: any) {
    const email = String(b.emails?.find((x: any) => x.primary)?.value || b.emails?.[0]?.value || b.userName || '').toLowerCase();
    const first = b.name?.givenName || '';
    const last = b.name?.familyName || '';
    const out: any = {
      hrId: b.externalId,
      email,
      firstName: first,
      lastName: last,
      name: b.displayName || b.name?.formatted || [first, last].filter(Boolean).join(' ') || email,
      title: b.title,
      department: b[ENT]?.department,
      office: b.addresses?.[0]?.locality,
      country: b.addresses?.[0]?.country,
      phone: b.phoneNumbers?.find((p: any) => p.type === 'work')?.value,
      mobile: b.phoneNumbers?.find((p: any) => p.type === 'mobile')?.value,
    };
    return Object.fromEntries(Object.entries(out).filter(([, v]) => v !== undefined && v !== ''));
  }

  private async setActive(company: any, e: any, active: boolean) {
    if (active === (e.status === 'active')) return;
    if (!active) {
      await db.Employee.updateOne({ _id: e._id }, { status: 'leaver' });
      if (e.cardId) await deactivateCard(e.cardId, 'Entra ID', `${e.name} deactivated in Entra ID`);
    } else {
      await db.Employee.updateOne({ _id: e._id }, { status: 'active' });
    }
  }

  private async findEmployee(company: any, id: string) {
    if (!isOid(id)) throw new NotFoundException();
    const e = await db.Employee.findOne({ _id: id, companyId: company._id }).lean<any>();
    if (!e) throw new NotFoundException();
    return e;
  }

  @Get('Users')
  async list(@Req() req: Request, @Query('filter') filter?: string, @Query('startIndex') start = '1', @Query('count') count = '100') {
    const company = await this.company(req);
    const q: any = { companyId: company._id };
    const m = filter?.match(/userName eq "([^"]+)"/i);
    if (m) q.email = m[1]!.toLowerCase();
    const skip = Math.max(Number(start) - 1, 0);
    const [rows, total] = await Promise.all([
      db.Employee.find(q).skip(skip).limit(Math.min(Number(count) || 100, 200)).lean<any[]>(),
      db.Employee.countDocuments(q),
    ]);
    return {
      schemas: ['urn:ietf:params:scim:api:messages:2.0:ListResponse'],
      totalResults: total,
      startIndex: skip + 1,
      itemsPerPage: rows.length,
      Resources: rows.map((e) => this.toScim(e)),
    };
  }

  @Get('Users/:id')
  async get(@Req() req: Request, @Param('id') id: string) {
    const company = await this.company(req);
    return this.toScim(await this.findEmployee(company, id));
  }

  @Post('Users')
  @HttpCode(201)
  async create(@Req() req: Request, @Body() body: any) {
    const company = await this.company(req);
    const data = this.fromScim(body);
    let e = data.email ? await db.Employee.findOne({ companyId: company._id, email: data.email }).lean<any>() : null;
    if (!e) {
      e = (await db.Employee.create({ ...data, companyId: company._id, source: 'entra', status: body.active === false ? 'leaver' : 'active' })).toObject();
      if (body.active !== false) {
        const card = await createCardForEmployee(company, e, { actor: 'Entra ID' });
        const integration = await db.Integration.findOne({ companyId: company._id, provider: 'entra' }).lean<any>();
        if (integration?.rules?.joinersToApproval) {
          await db.Card.updateOne({ _id: card._id }, { status: 'pending_approval', approval: { requestedBy: 'Entra ID', requestedAt: new Date(), reason: 'New joiner from Entra ID' } });
        } else {
          await publishCard(card._id, { name: 'Entra ID', role: 'admin' }, { skipApproval: true });
        }
      }
      await db.Integration.updateOne({ companyId: company._id, provider: 'entra' }, { lastSyncAt: new Date(), status: 'connected' }, { upsert: true });
    }
    return this.toScim(e);
  }

  @Put('Users/:id')
  async replace(@Req() req: Request, @Param('id') id: string, @Body() body: any) {
    const company = await this.company(req);
    const e = await this.findEmployee(company, id);
    const data = this.fromScim(body);
    await db.Employee.updateOne({ _id: e._id }, data);
    await this.syncCard(e, data);
    if (typeof body.active === 'boolean') await this.setActive(company, e, body.active);
    return this.toScim(await db.Employee.findById(e._id).lean());
  }

  @Patch('Users/:id')
  async patch(@Req() req: Request, @Param('id') id: string, @Body() body: any) {
    const company = await this.company(req);
    const e = await this.findEmployee(company, id);
    const update: any = {};
    let active: boolean | undefined;
    for (const op of body.Operations || []) {
      const val = op.value;
      if (op.path === 'active' || (val && typeof val === 'object' && 'active' in val)) {
        active = String(op.path === 'active' ? val : val.active).toLowerCase() === 'true';
      }
      const path = String(op.path || '');
      if (path === 'title') update.title = val;
      if (path === 'displayName') update.name = val;
      if (path === 'name.givenName') update.firstName = val;
      if (path === 'name.familyName') update.lastName = val;
      if (path.startsWith('emails')) update.email = String(Array.isArray(val) ? val[0]?.value : val).toLowerCase();
      if (path.endsWith(':department') || path === `${ENT}:department`) update.department = val;
      if (path.startsWith('phoneNumbers[type eq "work"]')) update.phone = val;
      if (path.startsWith('phoneNumbers[type eq "mobile"]')) update.mobile = val;
      if (path.startsWith('addresses[type eq "work"].locality')) update.office = val;
    }
    if (Object.keys(update).length) {
      await db.Employee.updateOne({ _id: e._id }, update);
      await this.syncCard(e, update);
    }
    if (active !== undefined) await this.setActive(company, e, active);
    return this.toScim(await db.Employee.findById(e._id).lean());
  }

  @Delete('Users/:id')
  @HttpCode(204)
  async remove(@Req() req: Request, @Param('id') id: string) {
    const company = await this.company(req);
    const e = await this.findEmployee(company, id);
    await this.setActive(company, e, false);
  }

  private async syncCard(e: any, data: any) {
    if (!e.cardId) return;
    const card = await db.Card.findById(e.cardId);
    if (!card) return;
    for (const k of Object.keys(data)) if (card.syncedFields.includes(k)) (card.fields as any)[k] = data[k];
    await card.save();
  }
}
