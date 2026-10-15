'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Icon, IconName, Seal } from '@/components/icons';
import { ChangePassword } from '@/components/change-password';
import { useInstalledApp } from '@/components/pwa';
import { cx, Loading, ScreenError } from '@/components/ui';
import { api, useMe } from '@/lib/api';

/* Console shell built to the "Command center" artboard: gold staff banner, white sidebar. */

const NAV: { group?: string; items: { label: string; href: string; icon: IconName }[] }[] = [
  { items: [{ label: 'Command center', href: '/console', icon: 'dHome' }] },
  {
    group: 'CUSTOMERS',
    items: [
      { label: 'Companies', href: '/console/companies', icon: 'dBuilding' },
      { label: 'Users directory', href: '/console/users', icon: 'dPeople' },
    ],
  },
  {
    group: 'REVENUE',
    items: [
      { label: 'Plans', href: '/console/plans', icon: 'dTag' },
      { label: 'Subscriptions & invoices', href: '/console/revenue', icon: 'dReceipt' },
      { label: 'Revenue analytics', href: '/console/revenue-analytics', icon: 'dChart' },
      { label: 'Partners & coupons', href: '/console/partners', icon: 'dHandshake' },
    ],
  },
  {
    group: 'OPERATIONS',
    items: [
      { label: 'NFC fulfilment', href: '/console/nfc', icon: 'nfc' },
      { label: 'Integration health', href: '/console/integrations', icon: 'dPlug' },
      { label: 'Template library', href: '/console/templates', icon: 'dGrid' },
      { label: 'AI usage & cost', href: '/console/ai', icon: 'dSpark' },
    ],
  },
  {
    group: 'SUPPORT',
    items: [
      { label: 'Support inbox', href: '/console/support', icon: 'dInbox' },
      { label: 'Announcements', href: '/console/announcements', icon: 'dMega' },
    ],
  },
  {
    group: 'PLATFORM',
    items: [
      { label: 'Security & audit', href: '/console/security', icon: 'dShield' },
      { label: 'Feature flags', href: '/console/flags', icon: 'dFlag' },
      { label: 'System health', href: '/console/health', icon: 'dPulse' },
    ],
  },
];
const HREFS = NAV.flatMap((g) => g.items.map((i) => i.href));

export default function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const { data: me, error, mutate: reloadMe } = useMe();
  const router = useRouter();
  const path = usePathname();
  const [drawer, setDrawer] = useState(false);
  const [q, setQ] = useState('');
  const [pwOpen, setPwOpen] = useState(false);
  const installed = useInstalledApp();

  useEffect(() => setDrawer(false), [path]);
  useEffect(() => {
    // The console is browser only: the installed app is the employee card app
    if (installed) router.replace('/m');
    else if (me && me.user.platformRole !== 'staff') router.replace(me.home);
  }, [me, router, installed]);
  if (error) return <ScreenError error={error} retry={() => reloadMe()} />;
  if (installed || !me || me.user.platformRole !== 'staff') return <Loading className="min-h-screen" />;

  // The most specific link that contains the current page is the active one
  const current = HREFS.filter((h) => path === h || (h !== '/console' && path.startsWith(`${h}/`))).sort((a, b) => b.length - a.length)[0];
  const active = (h: string) => h === current;
  const initials = me.user.name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();
  const signOut = async () => {
    await api.post('/auth/logout');
    window.location.href = '/signin';
  };

  const nav = (
    <nav aria-label="Console navigation" className="flex h-full flex-col gap-4 px-3.5 py-4.5">
      <Link href="/console" className="flex items-center gap-2.5 px-2.5 text-ink">
        <Seal size={28} className="text-gold" />
        <span className="flex flex-col gap-0.5">
          <span className="font-display text-[16px] tracking-[0.22em]">VELLAIRE</span>
          <span className="text-[11px] tracking-[0.12em] text-stone-2">CONSOLE</span>
        </span>
      </Link>
      <div className="scrollbar-thin flex flex-1 flex-col gap-2.5 overflow-y-auto">
        {NAV.map((g, i) => (
          <div key={i} className="flex flex-col">
            {g.group && <div className="px-3 pb-1 text-[10.5px] font-medium tracking-[0.18em] text-[#7A746A]">{g.group}</div>}
            {g.items.map((it) => {
              const on = active(it.href);
              return (
                <Link
                  key={it.href}
                  href={it.href}
                  aria-current={on ? 'page' : undefined}
                  className={cx(
                    'flex min-h-8 items-center gap-3 rounded-lg px-3 py-1 text-[14px]',
                    on ? 'bg-[#F4EEE2] font-semibold text-ink' : 'text-[#4E4A44] hover:bg-[#F7F3EA] hover:text-ink',
                  )}
                >
                  <Icon name={it.icon} size={18} className={on ? 'text-gold' : 'text-[#8E887E]'} />
                  {it.label}
                </Link>
              );
            })}
          </div>
        ))}
      </div>
      <button type="button" onClick={() => setPwOpen(true)} className="flex items-center gap-3 rounded-lg px-3 py-2 text-[14px] text-[#4E4A44] hover:bg-[#F7F3EA] hover:text-ink">
        <Icon name="lock" size={18} className="text-[#8E887E]" /> Password
      </button>
      <button type="button" onClick={signOut} className="flex items-center gap-3 rounded-lg px-3 py-2 text-[14px] text-[#4E4A44] hover:bg-[#F7F3EA] hover:text-ink">
        <Icon name="logout" size={18} className="text-[#8E887E]" /> Sign out
      </button>
      <ChangePassword open={pwOpen} onClose={() => setPwOpen(false)} />
    </nav>
  );

  return (
    <div className="min-h-screen bg-pearl text-[14px]">
      <div
        className="sticky top-0 z-40 py-1.5 text-center text-[11px] font-semibold tracking-[0.32em] text-[#0B0B0D]"
        style={{ background: 'linear-gradient(90deg, #8E7244, #B08D4F 50%, #8E7244)' }}
      >
        PLATFORM CONSOLE · INTERNAL STAFF ONLY
      </div>
      <aside className="fixed bottom-0 left-0 top-[29px] z-30 hidden w-[248px] border-r border-[#F4EEE2] bg-white lg:block">{nav}</aside>
      {drawer && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-ink/40" onClick={() => setDrawer(false)} />
          <aside className="absolute inset-y-0 left-0 w-[280px] bg-white shadow-2xl">{nav}</aside>
        </div>
      )}
      <div className="lg:pl-[248px]">
        <header className="sticky top-[29px] z-20 flex flex-wrap items-center gap-4 border-b border-linen bg-white px-4 py-4 sm:px-10">
          <button
            type="button"
            aria-label="Open menu"
            onClick={() => setDrawer(true)}
            className="flex h-[42px] w-[42px] items-center justify-center rounded-lg border border-linen lg:hidden"
          >
            <Icon name="menu" size={18} />
          </button>
          <form
            role="search"
            onSubmit={(e) => {
              e.preventDefault();
              router.push(`/console/companies?q=${encodeURIComponent(q)}`);
            }}
            className="flex h-[42px] max-w-[520px] flex-[1_1_320px] items-center gap-2.5 rounded-lg border border-linen bg-pearl px-3.5 text-stone-2"
          >
            <Icon name="dSearch" size={18} />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              aria-label="Search companies"
              placeholder="Search companies, users, invoices, orders"
              className="min-w-0 flex-1 bg-transparent text-[14px] text-ink outline-none placeholder:text-stone-2"
            />
          </form>
          <div className="ml-auto flex items-center gap-4">
            <span className="hidden items-center gap-2 text-[12px] text-ok sm:inline-flex">
              <span className="h-2 w-2 rounded-full bg-[#2E7D5B]" /> All systems operational
            </span>
            <span
              title={me.user.name}
              className="flex h-[42px] w-[42px] items-center justify-center rounded-full border border-[#D9C9A6] bg-gold-tint font-display text-[16px] font-semibold text-gold-text"
            >
              {initials}
            </span>
          </div>
        </header>
        <main className="w-full max-w-[1280px] px-4 pb-14 pt-9 sm:px-10">{children}</main>
      </div>
    </div>
  );
}
