'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AnnouncementBar } from '@/components/announcement-bar';
import { CommandPalette } from '@/components/command';
import { Icon, IconName, Seal } from '@/components/icons';
import { cx, Kbd, Loading, ScreenError } from '@/components/ui';
import { api, isAdmin, useMe } from '@/lib/api';

/* Shell built to the dashboard artboards: white sidebar, sand active item, white header. */

interface NavItem {
  label: string;
  href: string;
  icon: IconName;
  badge?: 'approvals' | 'leads' | 'sync';
}

const NAV: { group?: string; items: NavItem[] }[] = [
  { items: [{ label: 'Home', href: '/app', icon: 'dHome' }] },
  {
    group: 'CARDS',
    items: [
      { label: 'All cards', href: '/app/cards', icon: 'dCard' },
      { label: 'Create a card', href: '/app/create', icon: 'plus' },
      { label: 'Templates', href: '/app/templates', icon: 'dGrid' },
      { label: 'Brand kit', href: '/app/brand', icon: 'dPalette' },
    ],
  },
  {
    group: 'PEOPLE',
    items: [
      { label: 'Employees', href: '/app/employees', icon: 'dPeople' },
      { label: 'Departments', href: '/app/departments', icon: 'dMap' },
      { label: 'Approvals', href: '/app/approvals', icon: 'dCheck', badge: 'approvals' },
    ],
  },
  {
    group: 'SHARING',
    items: [
      { label: 'QR codes', href: '/app/qr', icon: 'dQr' },
      { label: 'NFC cards', href: '/app/nfc', icon: 'nfc' },
      { label: 'Wallet passes', href: '/app/wallet', icon: 'dWallet' },
      { label: 'Email signatures', href: '/app/signatures', icon: 'dMail' },
    ],
  },
  {
    group: 'INSIGHTS',
    items: [
      { label: 'Analytics', href: '/app/analytics', icon: 'chart' },
      { label: 'Leads', href: '/app/leads', icon: 'dInbox', badge: 'leads' },
    ],
  },
  {
    group: 'AUTOMATION',
    items: [
      { label: 'HR integrations', href: '/app/integrations', icon: 'dPlug' },
      { label: 'Sync activity', href: '/app/integrations/activity', icon: 'dSync', badge: 'sync' },
    ],
  },
  {
    group: 'SETTINGS',
    items: [
      { label: 'Team and roles', href: '/app/settings/team', icon: 'dPeople' },
      { label: 'Security', href: '/app/settings/security', icon: 'dShield' },
      { label: 'Billing', href: '/app/settings/billing', icon: 'dReceipt' },
      { label: 'Company settings', href: '/app/settings/company', icon: 'dGear' },
    ],
  },
];

const PLAN: Record<string, string> = { starter: 'Starter', professional: 'Professional', enterprise: 'Enterprise' };

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { data: me, error, mutate: reloadMe } = useMe();
  const path = usePathname();
  const router = useRouter();
  const [drawer, setDrawer] = useState(false);
  const [menu, setMenu] = useState(false);

  useEffect(() => setDrawer(false), [path]);
  useEffect(() => {
    if (!me) return;
    if (me.user.role === 'member' && !me.user.impersonating) router.replace('/m');
    else if (!me.company && me.user.platformRole === 'staff') router.replace('/console');
  }, [me, router]);

  if (error) return <ScreenError error={error} retry={() => reloadMe()} />;
  if (!me || !me.company || me.user.role === 'member') return <Loading className="min-h-screen" />;

  // The create-a-card wizard is a full-screen flow with its own header (as designed)
  if (path.startsWith('/app/create')) return <div className="min-h-screen bg-pearl text-[14px]">{children}</div>;

  const c = me.company;
  const active = (href: string) => {
    if (href === '/app') return path === '/app';
    if (href === '/app/integrations') return path.startsWith('/app/integrations') && !path.startsWith('/app/integrations/activity');
    if (href === '/app/settings/company') return path.startsWith('/app/settings/company') || path.startsWith('/app/settings/domain');
    return path === href || path.startsWith(`${href}/`);
  };
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
  const stopImpersonating = async () => {
    const r = await api.post<{ redirect: string }>('/auth/impersonate-stop');
    window.location.href = r.redirect;
  };

  const sidebar = (
    <nav aria-label="Workspace navigation" className="flex h-full flex-col gap-5 px-3.5 py-[22px]">
      <Link href="/app" className="flex items-center gap-2.5 px-2.5 text-ink">
        <Seal size={28} className="text-gold" />
        <span className="font-display text-[17px] font-medium tracking-[0.24em]">VELLAIRE</span>
      </Link>
      <div className="flex min-h-[52px] items-center gap-3 rounded-[10px] border border-linen bg-pearl p-2.5">
        {c.logo ? (
          <img src={c.logo} alt="" className="h-[34px] w-[34px] rounded-lg object-contain" />
        ) : (
          <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-lg bg-ink font-display text-[17px] text-[#E6D3A3]">{c.name[0]}</span>
        )}
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate text-[14px] font-semibold">{c.name}</span>
          <span className="text-[12px] leading-snug text-stone-2">
            {PLAN[c.plan] || c.plan} · {c.seats.toLocaleString()} seats
          </span>
        </span>
        <Icon name="dChevrons" size={18} className="text-[#8E887E]" />
      </div>
      <div className="scrollbar-thin -mx-1 flex flex-1 flex-col gap-4 overflow-y-auto px-1 pb-4">
        {NAV.map((g, i) => (
          <div key={i} className="flex flex-col gap-0.5">
            {g.group && <div className="px-3 pb-1.5 text-[10.5px] font-medium tracking-[0.18em] text-[#7A746A]">{g.group}</div>}
            {g.items.map((it) => {
              const on = active(it.href);
              const badge = it.badge ? me.badges[it.badge] : 0;
              return (
                <Link
                  key={it.href}
                  href={it.href}
                  aria-current={on ? 'page' : undefined}
                  className={cx(
                    'flex min-h-9 items-center gap-3 rounded-lg px-3 py-2 text-[14px]',
                    on ? 'bg-[#F4EEE2] font-semibold text-ink' : 'text-[#4E4A44] hover:bg-[#F7F3EA] hover:text-ink',
                  )}
                >
                  <Icon name={it.icon} size={18} className={on ? 'text-gold' : 'text-[#8E887E]'} />
                  <span className="flex-1">{it.label}</span>
                  {badge > 0 && <span className="rounded-full bg-gold-tint px-2 py-0.5 text-[11px] font-semibold text-gold-text">{badge.toLocaleString()}</span>}
                </Link>
              );
            })}
          </div>
        ))}
      </div>
    </nav>
  );

  const top = me.user.impersonating ? 37 : 0;

  return (
    <div className="min-h-screen bg-pearl text-[14px]">
      {me.user.impersonating && (
        <div className="sticky top-0 z-40 flex flex-wrap items-center justify-center gap-3 bg-ink px-4 py-2 text-[13px] text-cream">
          <Icon name="eye" size={16} className="text-gold-soft" />
          You are viewing {c.name} as Vellaire staff. Every action is logged.
          <button onClick={stopImpersonating} className="rounded border border-white/30 px-2.5 py-1 hover:bg-white/10">
            Back to console
          </button>
        </div>
      )}
      <aside className="fixed bottom-0 left-0 z-30 hidden w-[248px] border-r border-linen bg-white lg:block" style={{ top }}>
        {sidebar}
      </aside>
      {drawer && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-ink/40" onClick={() => setDrawer(false)} />
          <aside className="vl-fade absolute inset-y-0 left-0 w-[280px] bg-white shadow-2xl">{sidebar}</aside>
        </div>
      )}

      <div className="lg:pl-[248px]">
        <header className="sticky z-20 flex flex-wrap items-center gap-4 border-b border-linen bg-white px-4 py-4 sm:px-10" style={{ top }}>
          <button type="button" aria-label="Open menu" onClick={() => setDrawer(true)} className="flex h-[42px] w-[42px] items-center justify-center rounded-lg border border-linen lg:hidden">
            <Icon name="menu" size={18} />
          </button>
          <button
            type="button"
            onClick={() => window.dispatchEvent(new Event('vl:search'))}
            className="flex h-[42px] max-w-[520px] flex-[1_1_320px] items-center gap-2.5 rounded-lg border border-linen bg-pearl px-3.5 text-[14px] text-stone-2"
          >
            <Icon name="dSearch" size={18} />
            <span className="flex-1 truncate text-left">Search people, cards, settings</span>
            <Kbd>⌘K</Kbd>
          </button>
          <div className="relative ml-auto flex items-center gap-2">
            <Link href="/app/support" aria-label="Help and support" className="flex h-[42px] w-[42px] items-center justify-center rounded-lg border border-linen bg-white text-[#4E4A44] hover:border-line-strong">
              <Icon name="dHelp" size={18} />
            </Link>
            <Link
              href="/app/approvals"
              aria-label={`Notifications${me.badges.approvals ? `, ${me.badges.approvals} waiting` : ''}`}
              className="relative flex h-[42px] w-[42px] items-center justify-center rounded-lg border border-linen bg-white text-[#4E4A44] hover:border-line-strong"
            >
              <Icon name="dBell" size={18} />
              {me.badges.approvals + me.badges.sync > 0 && <span className="absolute right-2.5 top-[9px] h-[7px] w-[7px] rounded-full bg-gold" />}
            </Link>
            <button
              type="button"
              aria-label="Account menu"
              aria-expanded={menu}
              onClick={() => setMenu((m) => !m)}
              className="h-[42px] w-[42px] rounded-full border border-[#D9C9A6] bg-gold-tint font-display text-[16px] font-semibold text-gold-text"
            >
              {initials}
            </button>
            {menu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setMenu(false)} />
                <div className="vl-fade absolute right-0 top-12 z-50 w-64 rounded-xl border border-line bg-white p-2 shadow-xl">
                  <div className="px-3 py-2">
                    <div className="text-[14px] font-medium">{me.user.name}</div>
                    <div className="truncate text-[12px] text-stone-2">{me.user.email}</div>
                    <div className="mt-1 text-[12px] capitalize text-gold-text">{me.user.role.replace('_', ' ')}</div>
                  </div>
                  <div className="my-1 h-px bg-line" />
                  {me.user.employeeId && (
                    <Link href="/m" className="flex items-center gap-3 rounded-md px-3 py-2 text-[14px] hover:bg-pearl">
                      <Icon name="card" size={17} /> My card (employee app)
                    </Link>
                  )}
                  <Link href="/app/support" className="flex items-center gap-3 rounded-md px-3 py-2 text-[14px] hover:bg-pearl">
                    <Icon name="inbox" size={17} /> Help and support
                  </Link>
                  {isAdmin(me.user.role) && (
                    <Link href="/app/settings/domain" className="flex items-center gap-3 rounded-md px-3 py-2 text-[14px] hover:bg-pearl">
                      <Icon name="globe" size={17} /> Company domain
                    </Link>
                  )}
                  <button onClick={signOut} className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-[14px] hover:bg-pearl">
                    <Icon name="logout" size={17} /> Sign out
                  </button>
                </div>
              </>
            )}
          </div>
        </header>
        <main className="w-full max-w-[1280px] px-4 pb-14 pt-9 sm:px-10">
          <AnnouncementBar />
          {children}
        </main>
      </div>
      <CommandPalette pages={NAV.flatMap((g) => g.items).map((i) => ({ label: i.label, href: i.href }))} />
    </div>
  );
}
