'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Icon, IconName } from '@/components/icons';
import { InstallBanner } from '@/components/pwa';
import { cx } from '@/components/ui';
import { useMe } from '@/lib/api';
import { useOnline } from '@/lib/online';
import { NoCompany } from './no-card';
import { AppError, AppOffline, AppSplash, AppUpdate, rememberUser } from './system';

const TABS: { href: string; label: string; icon: IconName }[] = [
  { href: '/m', label: 'My card', icon: 'dCard' },
  { href: '/m/share', label: 'Share', icon: 'dQr' },
  { href: '/m/leads', label: 'Leads', icon: 'dInbox' },
  { href: '/m/insights', label: 'Insights', icon: 'chart' },
  { href: '/m/settings', label: 'Settings', icon: 'dGear' },
];

// Full-screen steps from the design: no tab bar, no install banner
const FULL_SCREEN = ['/m/qr', '/m/leads/scan', '/m/edit/photo', '/m/edit/bio', '/m/welcome', '/m/wallet', '/m/cards', '/m/nfc'];

/** The employee app: mobile first, installable (PWA), centred on larger screens. */
export default function EmployeeLayout({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const { data: me, error, mutate: reloadMe } = useMe();
  const online = useOnline();
  const [update, setUpdate] = useState(false);

  useEffect(() => {
    if (me) rememberUser({ name: me.user.name, email: me.user.email, company: me.company?.name });
  }, [me]);
  // The service worker took over with a new version of the app
  useEffect(() => {
    const show = () => setUpdate(true);
    window.addEventListener('vellaire:update', show);
    return () => window.removeEventListener('vellaire:update', show);
  }, []);

  // Signed out: no account to load
  if (path === '/m/signed-out') return <>{children}</>;
  if (error) {
    const status = (error as { status?: number }).status;
    if (status === 401) return <AppSplash />;
    if (!online || status === 0) return <div className="mx-auto max-w-[440px] bg-pearl px-5 pt-6"><AppOffline retry={() => reloadMe()} /></div>;
    return <AppError error={error} retry={() => reloadMe()} />;
  }
  if (!me) return <AppSplash />;
  if (!me.company) return <NoCompany />;
  if (update) return <AppUpdate later={() => setUpdate(false)} />;
  const active = (h: string) => (h === '/m' ? path === '/m' || path === '/m/edit' : path.startsWith(h));
  const isEdit = path === '/m/edit';
  if (FULL_SCREEN.some((p) => path.startsWith(p)))
    return (
      <div className="min-h-screen bg-pearl">
        <div className="relative mx-auto flex min-h-screen max-w-[440px] flex-col sm:border-x sm:border-line">{children}</div>
      </div>
    );
  return (
    <div className="min-h-screen bg-pearl">
      <div className={cx('relative mx-auto flex max-w-[440px] flex-col bg-pearl sm:border-x sm:border-line', isEdit ? 'h-[844px] overflow-hidden' : 'min-h-screen')}>
        <main className={cx('flex-1 px-5', isEdit ? 'flex min-h-0 flex-col gap-4 overflow-hidden pb-4 pt-14' : 'pb-28 pt-6')}>
          {!isEdit && <InstallBanner className="mb-4" />}
          {children}
        </main>
        <nav aria-label="Employee app" className={cx('border-t border-linen bg-white', isEdit ? 'h-[84px] flex-none pb-5' : 'fixed inset-x-0 bottom-0 z-30 mx-auto max-w-[440px] pb-[env(safe-area-inset-bottom)] backdrop-blur')}>
          <ul className="grid h-full grid-cols-5">
            {TABS.map((t) => (
              <li key={t.href} className="flex">
                <Link href={t.href} aria-current={active(t.href) ? 'page' : undefined} className={cx('flex flex-1 flex-col items-center justify-center gap-1 text-[10.5px]', active(t.href) ? 'font-semibold text-gold-text' : 'text-stone-2')}>
                  <Icon name={t.icon} size={20} className={active(t.href) ? 'text-gold-text' : ''} />
                  {t.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </div>
  );
}
