'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Icon } from '@/components/icons';
import { cx } from '@/components/ui';

export interface TeamPage {
  company: { name: string; slug: string; logo: string | null };
  departments: string[];
  people: { slug: string; ini: string; name: string; title: string; department: string; photo: string | null }[];
}

const CHIPS = 6;
const PAGE = 40;

/** Public "Meet our team" page: search and filter, then open a person's card. */
export function TeamDirectory({ team }: { team: TeamPage }) {
  const [q, setQ] = useState('');
  const [dept, setDept] = useState('');
  const [limit, setLimit] = useState(PAGE);
  const needle = q.trim().toLowerCase();
  const shown = team.people.filter((p) => (!dept || p.department === dept) && (!needle || `${p.name} ${p.title} ${p.department}`.toLowerCase().includes(needle)));

  return (
    <main className="min-h-screen bg-pearl text-ink sm:py-10">
      <div className="mx-auto flex max-w-110 flex-col gap-4.5 px-5 pb-10 pt-13 sm:rounded-2xl sm:border sm:border-line sm:shadow-xl">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-ink font-display text-[24px] text-gold-soft">
            {team.company.logo ? <img src={team.company.logo} alt="" className="h-9 w-9 object-contain" /> : team.company.name[0]}
          </span>
          <span className="flex flex-col">
            <h1 className="font-display text-[26px] font-medium leading-[1.05]">{team.company.name}</h1>
            <span className="text-[13px] text-stone">Meet our team</span>
          </span>
        </div>
        <label className="flex h-12 items-center gap-2.5 rounded-xl border border-[#E0D9CC] bg-white px-3.5 text-stone-2">
          <Icon name="dSearch" size={18} />
          <input
            type="search"
            aria-label="Search the team"
            placeholder="Search name or team"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setLimit(PAGE);
            }}
            className="min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none"
          />
        </label>
        {team.departments.length > 1 && (
          <div className="scrollbar-thin -mx-5 flex gap-2 overflow-x-auto px-5" role="group" aria-label="Teams">
            {['', ...team.departments.slice(0, CHIPS)].map((d) => (
              <button
                key={d || 'all'}
                type="button"
                aria-pressed={dept === d}
                onClick={() => {
                  setDept(d);
                  setLimit(PAGE);
                }}
                className={cx('shrink-0 whitespace-nowrap rounded-full border px-3.5 py-2 text-[13px]', dept === d ? 'border-ink bg-ink text-white' : 'border-[#E0D9CC] bg-white')}
              >
                {d || 'All'}
              </button>
            ))}
          </div>
        )}
        <section className="overflow-hidden rounded-2xl border border-linen bg-white">
          {shown.length === 0 && <p className="px-4 py-10 text-center text-[14px] text-stone-2">No one matches “{q}”</p>}
          {shown.slice(0, limit).map((p, i) => (
            <Link
              key={p.slug}
              href={`/c/${team.company.slug}/${p.slug}?src=team`}
              className={cx('flex items-center gap-3 px-4 py-3.5 hover:bg-[#FAF7F1]', i > 0 && 'border-t border-[#F0EBE2]')}
            >
              <span className="flex h-11.5 w-11.5 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#F2EEE6] font-display text-[17px] font-semibold text-gold-text">
                {p.photo ? <img src={p.photo} alt="" className="h-full w-full object-cover" /> : p.ini}
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate font-semibold">{p.name}</span>
                <span className="truncate text-[12.5px] text-stone">{p.title}</span>
              </span>
              <Icon name="dRight" size={16} className="shrink-0 text-stone-2" />
            </Link>
          ))}
        </section>
        {shown.length > limit && (
          <button type="button" onClick={() => setLimit(limit + PAGE)} className="h-11 rounded-xl border border-[#E0D9CC] bg-white text-[14px] hover:border-ink">
            Show more · {shown.length - limit} left
          </button>
        )}
        <p className="text-center text-[12px] text-stone-2">{team.people.length} people · Powered by Vellaire</p>
      </div>
    </main>
  );
}
