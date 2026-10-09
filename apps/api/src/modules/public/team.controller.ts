import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { Public } from '../../common/auth';
import { flagsFor } from '../../common/platform';
import { initials } from '../../common/util';
import { db } from '../../db/db';

/** A company's public team page: everyone with a live card, when the company has turned it on. */
@Controller('public/team')
export class TeamController {
  @Public()
  @Get(':company')
  async team(@Param('company') slug: string) {
    const company = await db.Company.findOne({ slug, status: { $nin: ['suspended', 'churned'] } }).lean<any>();
    if (!company?.settings?.teamPage || !(await flagsFor(company)).includes('public.team_page')) throw new NotFoundException('This team page is not available');

    const cards = await db.Card.find({ companyId: company._id, status: 'live' }).select('slug fields').sort({ 'fields.name': 1 }).lean<any[]>();
    const people = cards
      .filter((c) => c.fields?.name)
      .map((c) => ({
        slug: c.slug,
        ini: initials(c.fields.name),
        name: c.fields.name,
        title: [c.fields.title, c.fields.office].filter(Boolean).join(' · '),
        department: c.fields.department || '',
        photo: c.fields.photoUrl || null,
      }));
    const counts = new Map<string, number>();
    for (const p of people) if (p.department) counts.set(p.department, (counts.get(p.department) || 0) + 1);

    return {
      company: { name: company.name, slug: company.slug, logo: company.brand?.logos?.icon || company.brand?.logos?.light || null },
      // The biggest teams first, so the chips stay useful for large companies
      departments: [...counts].sort((a, b) => b[1] - a[1]).map(([name]) => name),
      people,
    };
  }
}
