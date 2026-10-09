'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { CardFace } from '@/components/card/card-face';
import { chartColors, TrendChart } from '@/components/charts';
import { Icon, IconName } from '@/components/icons';
import { cx, ErrorState, Loading } from '@/components/ui';
import { useApi, useMe } from '@/lib/api';

/* Built to the "Home" artboard of the company dashboard. */

const QUICK: { title: string; sub: string; href: string; icon: IconName; dark?: boolean }[] = [
  { title: 'Create a card', sub: 'Design and publish a card in four simple steps', href: '/app/create', icon: 'dCardPlus', dark: true },
  { title: 'Connect HR system', sub: 'Cards create themselves for every new hire', href: '/app/integrations', icon: 'dPlug' },
  { title: 'Order NFC cards', sub: 'Metal, wood or PVC, engraved with your brand', href: '/app/nfc', icon: 'nfc' },
  { title: 'Brand kit', sub: 'Logo, colours and fonts for every card', href: '/app/brand', icon: 'dPalette' },
];

/* Icon and tint for each kind of "needs your attention" row, as drawn in the design */
const ATTENTION: Record<string, { icon: IconName; tint: string; tone: string }> = {
  '/app/approvals': { icon: 'dCheck', tint: '#F6EFE1', tone: '#876A33' },
  '/app/integrations': { icon: 'dAlert', tint: '#F8E4E7', tone: '#A3283A' },
  '/app/nfc': { icon: 'nfc', tint: '#E5F2EB', tone: '#1F7A55' },
  '/app/leads?tab=follow-up': { icon: 'dInbox', tint: '#FBF0DC', tone: '#8A5A12' },
  '/app/employees?filter=no-card': { icon: 'dPeople', tint: '#F6EFE1', tone: '#876A33' },
  '/app/analytics': { icon: 'chart', tint: '#E6ECF6', tone: '#2F4A7A' },
};

const STATUS: Record<string, [string, string, string]> = {
  live: ['Live', '#E5F2EB', '#1F7A55'],
  pending_approval: ['Pending', '#FBF0DC', '#8A5A12'],
  scheduled: ['Scheduled', '#E6ECF6', '#2F4A7A'],
  draft: ['Draft', '#EFEBE3', '#4E4A44'],
  deactivated: ['Off', '#F8E4E7', '#A3283A'],
};

export default function Home() {
  const { data, error, mutate } = useApi<any>('/home');
  const { data: me } = useMe();
  const [range, setRange] = useState<'7' | '30' | '90'>('30');
  const series = useMemo(() => {
    if (!data) return [];
    const map = new Map<string, number>(data.daily.map((d: any) => [d.date, d.views]));
    const out = [];
    for (let i = Number(range) - 1; i >= 0; i--) {
      const k = new Date(Date.now() - i * 86400_000).toISOString().slice(0, 10);
      out.push({ date: k, views: map.get(k) || 0 });
    }
    return out;
  }, [data, range]);

  if (error) return <ErrorState error={error} retry={() => mutate()} />;
  if (!data) return <Loading />;

  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const today = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }).replace(/^(\w+)\s/, '$1, ');

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div className="flex flex-col gap-1.5">
          <div className="text-[12px] font-medium uppercase tracking-[0.2em] text-gold-text">{today}</div>
          <h1 className="m-0 font-display text-[46px] font-normal leading-[1.05]">
            {greet}, {data.greetingName}
          </h1>
          <p className="m-0 text-[15px] text-stone">Here is what is happening across {data.companyName}&rsquo;s cards today.</p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <Link href="/app/employees?import=1" className="inline-flex h-11 items-center gap-2 rounded-lg border border-[#D9D2C4] bg-white px-[18px] text-[14px] text-ink hover:border-ink">
            <Icon name="dDownload" size={18} /> Import employees
          </Link>
          <Link href="/app/create" className="inline-flex h-11 items-center gap-2 rounded-lg bg-ink px-5 text-[14px] font-semibold text-white hover:bg-[#2E2E35]">
            <Icon name="plus" size={18} className="text-[#E6D3A3]" /> Create a card
          </Link>
        </div>
      </div>

      <section aria-label="Quick actions" className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(230px, 100%), 1fr))' }}>
        {QUICK.map((q) => (
          <Link
            key={q.title}
            href={q.href}
            className={cx(
              'flex flex-col gap-3.5 rounded-[14px] border p-[22px] transition-[transform,border-color] duration-200 hover:-translate-y-0.5 hover:border-gold',
              q.dark ? 'border-ink bg-ink text-white' : 'border-linen bg-white text-ink',
            )}
          >
            <span className={cx('flex h-11 w-11 items-center justify-center rounded-xl', q.dark ? 'bg-[rgba(201,169,110,0.16)] text-[#E6D3A3]' : 'bg-gold-tint text-gold-text')}>
              <Icon name={q.icon} size={22} />
            </span>
            <span className="flex flex-col gap-1">
              <span className="text-[16px] font-semibold">{q.title}</span>
              <span className={cx('text-[13px] leading-[1.5]', q.dark ? 'text-[#B9B4AA]' : 'text-stone')}>{q.sub}</span>
            </span>
          </Link>
        ))}
      </section>

      <section aria-label="Key numbers" className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(220px, 100%), 1fr))' }}>
        {data.metrics.map((m: any) => (
          <div key={m.label} className="flex flex-col gap-3 rounded-[14px] border border-linen bg-white p-[22px]">
            <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-stone-2">{m.label}</div>
            <div className="font-display text-[42px] font-medium leading-none">{m.value}</div>
            <div className={cx('text-[13px]', m.tone === 'up' ? 'text-ok' : m.tone === 'down' ? 'text-err' : 'text-stone-2')}>{m.delta}</div>
          </div>
        ))}
      </section>

      <div className="flex flex-wrap gap-4">
        <section className="flex min-w-0 flex-[2_1_560px] flex-col gap-4 rounded-[14px] border border-linen bg-white p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-col gap-1">
              <h2 className="m-0 text-[16px] font-semibold">Card views</h2>
              <div className="text-[13px] text-stone-2">Last {range} days · all channels</div>
            </div>
            <div className="flex gap-1 rounded-lg border border-linen bg-pearl p-[3px]" role="group" aria-label="Period">
              {(['7', '30', '90'] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  aria-pressed={range === r}
                  onClick={() => setRange(r)}
                  className={cx('h-8 rounded-md px-3 text-[13px]', range === r ? 'bg-white font-semibold text-ink shadow-[0_1px_2px_rgba(23,23,27,0.08)]' : 'text-stone-2')}
                >
                  {r}D
                </button>
              ))}
            </div>
          </div>
          <TrendChart data={series} dataKey="views" unit="views" height={250} color={chartColors.GOLD} hideY />
        </section>

        <section className="flex min-w-0 flex-[1_1_320px] flex-col gap-1.5 rounded-[14px] border border-linen bg-white p-6">
          <h2 className="m-0 mb-2.5 text-[16px] font-semibold">Needs your attention</h2>
          {data.attention.length === 0 ? (
            <div className="flex flex-col items-center py-6 text-center text-[14px] text-stone">
              <Icon name="checkCircle" size={26} className="mb-2 text-ok" />
              All clear. Nothing needs you today.
            </div>
          ) : (
            data.attention.slice(0, 4).map((a: any) => {
              const look = ATTENTION[a.href] || { icon: 'info' as IconName, tint: '#F6EFE1', tone: '#876A33' };
              return (
                <Link key={a.title} href={a.href} className="flex min-h-11 items-center gap-3.5 rounded-[10px] p-3 text-ink hover:bg-[#FAF7F1]">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px]" style={{ background: look.tint, color: look.tone }}>
                    <Icon name={look.icon} size={18} />
                  </span>
                  <span className="flex flex-1 flex-col gap-0.5">
                    <span className="font-medium">{a.title}</span>
                    <span className="text-[12px] text-stone-2">{a.sub}</span>
                  </span>
                  <Icon name="dRight" size={18} className="text-[#A39B8E]" />
                </Link>
              );
            })
          )}
          <div className="mt-auto flex gap-2.5 rounded-[10px] border border-gold-line bg-[#FBF6EC] p-3.5 text-[13px] leading-[1.55] text-[#4E4A44]">
            <Icon name="sparkle" size={18} className="mt-px text-gold" />
            <span>
              <b className="font-semibold text-ink">Insight:</b> {data.insight}
            </span>
          </div>
        </section>
      </div>

      <section className="flex flex-col gap-4">
        <div className="flex items-baseline justify-between">
          <h2 className="m-0 text-[16px] font-semibold">Recently created cards</h2>
          <Link href="/app/cards" className="text-[14px] font-medium text-gold-text hover:text-ink">
            View all cards
          </Link>
        </div>
        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(240px, 100%), 1fr))' }}>
          {data.recent.map((c: any) => {
            const [label, bg, fg] = STATUS[c.status] || STATUS.draft!;
            return (
              <Link key={c.id} href={`/app/cards/${c.id}`} className="flex flex-col gap-3.5 rounded-[14px] border border-linen bg-white p-3.5 text-ink transition-[transform,border-color] duration-200 hover:-translate-y-0.5 hover:border-gold">
                <CardFace layout={c.layout} theme={c.theme} fields={{ name: c.name, title: c.title }} brand={{ companyName: me?.company?.name }} width="100%" />
                <span className="flex items-center justify-between px-0.5">
                  <span className="text-[13px] text-stone">{c.when}</span>
                  <span className="rounded-full px-2.5 py-[3px] text-[12px] font-medium" style={{ background: bg, color: fg }}>
                    {label}
                  </span>
                </span>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
