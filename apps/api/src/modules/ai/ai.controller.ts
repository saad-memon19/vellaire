import { Body, Controller, Get, Post } from '@nestjs/common';
import { z } from 'zod';
import { AllowMember, CurrentUser, SessionUser } from '../../common/auth';
import { parse } from '../../common/util';
import { db } from '../../db/db';
import { AiService } from './ai.service';

const LANGS: Record<string, string> = { ar: 'Arabic', fr: 'French', zh: 'Simplified Chinese', es: 'Spanish', de: 'German', ur: 'Urdu', hi: 'Hindi', ru: 'Russian' };

@AllowMember()
@Controller('ai')
export class AiController {
  constructor(private ai: AiService) {}

  @Get('status')
  status() {
    return { enabled: this.ai.enabled, provider: this.ai.providerName, languages: LANGS };
  }

  @Post('bio')
  async bio(@Body() body: unknown, @CurrentUser() u: SessionUser) {
    const d = parse(
      z.object({ name: z.string().min(1), title: z.string().optional(), department: z.string().optional(), office: z.string().optional(), keywords: z.string().max(200).optional() }),
      body,
    );
    const company = await db.Company.findById(u.companyId).select('name').lean<any>();
    return { bio: await this.ai.bio({ ...d, company: company?.name || '' }) };
  }

  @Post('translate')
  async translate(@Body() body: unknown) {
    const d = parse(z.object({ language: z.string().refine((l) => l in LANGS, 'Unsupported language'), fields: z.record(z.string().max(600)) }), body);
    return { language: d.language, fields: await this.ai.translate(d.fields, LANGS[d.language]!) };
  }
}
