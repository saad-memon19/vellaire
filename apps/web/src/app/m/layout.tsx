'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon, IconName } from '@/components/icons';
import { cx, Loading } from '@/components/ui';
import { useMe } from '@/lib/api';

const TABS: { href: string; label: string; icon: IconName }[] = [
  { href: '/m', label: 'My card', icon: 'dCard' },
  { href: '/m/share', label: 'Share', icon: 'dQr' },
  { href: '/m/leads', label: 'Leads', icon: 'dInbox' },
  { href: '/m/insights', label: 'Insights', icon: 'chart' },
  { href: '/m/settings', label: 'Settings', icon: 'dGear' },
];

/** The employee app: mobile first, installable (PWA), centred on larger screens. */
export default function EmployeeLayout({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const { data: me, error } = useMe();
  if (error) return null;
  if (!me) return <Loading className="min-h-screen" />;
  const active = (h: string) => (h === '/m' ? path === '/m' || path === '/m/edit' : path.startsWith(h));
  return (
    <div className="min-h-screen bg-pearl">
      <div className="relative mx-auto flex min-h-screen max-w-[440px] flex-col bg-pearl sm:border-x sm:border-line">
        <main className="flex-1 px-5 pb-28 pt-6">{children}</main>
        <nav aria-label="Employee app" className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-[440px] border-t border-line bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
          <ul className="grid grid-cols-5">
            {TABS.map((t) => (
              <li key={t.href}>
                <Link href={t.href} aria-current={active(t.href) ? 'page' : undefined} className={cx('flex flex-col items-center gap-1 py-2.5 text-[11px]', active(t.href) ? 'font-semibold text-gold-text' : 'text-stone-2')}>
                  <Icon name={t.icon} size={21} className={active(t.href) ? 'text-gold-text' : ''} />
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
