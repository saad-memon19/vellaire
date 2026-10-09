import { BadRequestException, Body, Controller, Get, Patch, Post } from '@nestjs/common';
import { z } from 'zod';
import { CurrentUser, MANAGERS, Roles, SessionUser } from '../../common/auth';
import { found, logActivity, parse } from '../../common/util';
import { db } from '../../db/db';
import { oid } from '../../db/schemas';
import { AiService } from '../ai/ai.service';

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Use a 6-digit hex colour like #B08D4F');

const brandSchema = z.object({
  website: z.string().max(200).optional(),
  logos: z.object({ light: z.string().max(400), dark: z.string().max(400), icon: z.string().max(400) }).partial().optional(),
  colors: z.array(z.object({ name: z.string().max(40), use: z.string().max(80), hex })).min(1).max(8).optional(),
  fonts: z.object({ display: z.string().max(60), body: z.string().max(60), customUrl: z.string().max(400).optional() }).optional(),
  buttonStyle: z.enum(['sharp', 'soft', 'pill']).optional(),
  permissions: z.object({ photo: z.boolean(), bio: z.boolean(), links: z.boolean(), theme: z.boolean(), languages: z.boolean() }).partial().optional(),
  subBrands: z
    .array(z.object({ name: z.string().max(80), field: z.string().max(40), value: z.string().max(80), theme: z.string().max(40).optional(), layout: z.string().max(40).optional() }))
    .max(20)
    .optional(),
});

/* WCAG contrast */
function lum(h: string) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(h.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}
export function contrast(a: string, b: string) {
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x! + 0.05) / (y! + 0.05);
}
function contrastLabel(c: string, bg: string) {
  const r = contrast(c, bg);
  const grade = r >= 7 ? 'AAA' : r >= 4.5 ? 'AA' : r >= 3 ? 'AA large' : 'Low';
  return { ratio: Math.round(r * 10) / 10, grade, pass: r >= 3 };
}

const PERMISSION_LABELS: Record<string, { name: string; note: string }> = {
  photo: { name: 'Profile photo', note: 'Needs Brand Manager approval' },
  bio: { name: 'Bio and about', note: 'Two or three sentences' },
  links: { name: 'Links and buttons', note: 'Booking, LinkedIn, files' },
  languages: { name: 'Languages', note: 'Add Arabic, French and more' },
  theme: { name: 'Colour theme', note: 'From approved themes only' },
};

@Controller('brand')
export class BrandController {
  constructor(private ai: AiService) {}

  @Get()
  async get(@CurrentUser() u: SessionUser) {
    const companyId = oid(u.companyId!);
    const company = found(await db.Company.findById(companyId).lean<any>(), 'Company');
    const cards = await db.Card.countDocuments({ companyId, status: { $ne: 'deactivated' } });
    const b = company.brand || {};
    const bg = b.colors?.[0]?.hex || '#17171B';
    const subCounts = await Promise.all(
      (b.subBrands || []).map((s: any) => db.Employee.countDocuments({ companyId, [s.field]: s.value, status: 'active' })),
    );
    return {
      companyName: company.name,
      cards,
      brand: {
        website: b.website || '',
        logos: b.logos || {},
        colors: b.colors || [],
        fonts: b.fonts || { display: 'Cormorant Garamond', body: 'Instrument Sans' },
        buttonStyle: b.buttonStyle || 'soft',
        permissions: b.permissions || {},
        subBrands: b.subBrands || [],
        publishedAt: b.publishedAt,
      },
      contrast: (b.colors || []).map((c: any, i: number) => (i === 0 ? null : contrastLabel(c.hex, bg))),
      permissionLabels: PERMISSION_LABELS,
      subBrandCounts: subCounts,
      aiEnabled: this.ai.enabled,
    };
  }

  @Roles(...MANAGERS)
  @Patch()
  async update(@Body() body: unknown, @CurrentUser() u: SessionUser) {
    const data = parse(brandSchema, body);
    const companyId = oid(u.companyId!);
    const set: any = { 'brand.publishedAt': new Date() };
    for (const [k, v] of Object.entries(data)) if (v !== undefined) set[`brand.${k}`] = v;
    await db.Company.updateOne({ _id: companyId }, { $set: set });
    const cards = await db.Card.countDocuments({ companyId, status: { $ne: 'deactivated' } });
    await logActivity({ companyId, actor: u.name, action: 'brand.published', text: `Brand kit published to ${cards.toLocaleString()} cards` });
    return { ok: true, cards };
  }

  /**
   * "Start from your website": reads the page for its icon, theme colour, CSS colours and Google Fonts.
   * With AI switched on, the signals are turned into a polished proposal; without it, the signals are used directly.
   */
  @Roles(...MANAGERS)
  @Post('extract')
  async extract(@Body() body: unknown) {
    let { url } = parse(z.object({ url: z.string().min(3).max(200) }), body);
    if (!/^https?:\/\//.test(url)) url = `https://${url}`;
    let target: URL;
    try {
      target = new URL(url);
    } catch {
      throw new BadRequestException('That does not look like a web address');
    }
    if (!/\./.test(target.hostname) || /^(localhost|127\.|10\.|192\.168\.|169\.254\.)/.test(target.hostname)) {
      throw new BadRequestException('Use a public website address');
    }
    let html = '';
    try {
      const res = await fetch(target, { headers: { 'User-Agent': 'VellaireBrandBot/1.0' }, signal: AbortSignal.timeout(10_000) });
      html = (await res.text()).slice(0, 600_000);
    } catch {
      throw new BadRequestException('We could not open that website');
    }
    const abs = (h?: string) => {
      if (!h) return undefined;
      try {
        return new URL(h, target).toString();
      } catch {
        return undefined;
      }
    };
    const attr = (re: RegExp) => html.match(re)?.[1];
    const title = attr(/<title[^>]*>([^<]{1,120})/i)?.trim();
    const icon =
      abs(attr(/<link[^>]+rel=["'][^"']*apple-touch-icon[^"']*["'][^>]*href=["']([^"']+)/i)) ||
      abs(attr(/<link[^>]+rel=["'][^"']*icon[^"']*["'][^>]*href=["']([^"']+)/i)) ||
      abs('/favicon.ico');
    const ogImage = abs(attr(/<meta[^>]+property=["']og:image["'][^>]*content=["']([^"']+)/i));
    const themeColor = attr(/<meta[^>]+name=["']theme-color["'][^>]*content=["'](#[0-9a-fA-F]{6})/i);

    // Most used hex colours in inline CSS, ignoring near-white and near-black
    const counts = new Map<string, number>();
    for (const m of html.matchAll(/#([0-9a-fA-F]{6})\b/g)) {
      const h = `#${m[1]!.toUpperCase()}`;
      const l = lum(h);
      if (l > 0.9 || l < 0.01) continue;
      counts.set(h, (counts.get(h) || 0) + 1);
    }
    const colors = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([h]) => h).slice(0, 6);
    if (themeColor && !colors.includes(themeColor.toUpperCase())) colors.unshift(themeColor.toUpperCase());
    const fonts = [...new Set([...html.matchAll(/fonts\.googleapis\.com\/css2?\?family=([^"'&:]+)/g)].map((m) => decodeURIComponent(m[1]!).replace(/\+/g, ' ')))].slice(0, 3);

    const base = {
      website: target.toString(),
      title,
      icon,
      ogImage,
      colors: [
        { name: 'Background', use: 'Card background', hex: '#17171B' },
        { name: 'Accent', use: 'Accents and linework', hex: colors[0] || '#C9A96E' },
        { name: 'Text', use: 'Text on dark', hex: '#F6F1E7' },
      ],
      fonts: { display: fonts[0] || 'Cormorant Garamond', body: fonts[1] || fonts[0] || 'Instrument Sans' },
      theme: 'obsidian_gold',
      usedAi: false,
    };
    if (!this.ai.enabled) return base;
    try {
      const p = await this.ai.brandFromSite({ url: target.toString(), title, colors, fonts });
      return {
        ...base,
        colors: Array.isArray(p.colors) && p.colors.length ? p.colors.filter((c: any) => /^#[0-9a-fA-F]{6}$/.test(c.hex)).slice(0, 3) : base.colors,
        fonts: { display: p.display || base.fonts.display, body: p.body || base.fonts.body },
        theme: p.theme || base.theme,
        usedAi: true,
      };
    } catch {
      return base;
    }
  }
}
