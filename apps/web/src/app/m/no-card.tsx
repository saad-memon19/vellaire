'use client';

import Link from 'next/link';
import { Seal } from '@/components/icons';
import { useInstalledApp } from '@/components/pwa';
import { Button } from '@/components/ui';
import { api, useMe } from '@/lib/api';

/** In the installed app the dashboard is not offered: it is a browser page, so we name the address instead. */
function BrowserLink({ href, label }: { href: string; label: string }) {
  const installed = useInstalledApp();
  if (installed)
    return (
      <p className="mt-6 text-[14px] text-stone">
        {label} in a browser at <span className="font-medium text-ink">{`${window.location.host}${href}`}</span>
      </p>
    );
  return (
    <Link href={href} className="mt-6 text-[14px] text-gold-text underline underline-offset-4">
      {label}
    </Link>
  );
}

export function NoCard({ message }: { message?: string }) {
  const { data: me } = useMe();
  return (
    <div className="flex flex-col items-center px-4 py-16 text-center">
      <Seal size={48} className="text-gold" />
      <h1 className="mt-6 font-display text-[32px] leading-tight">Your card is on its way</h1>
      <p className="mt-2 text-[15px] text-stone">{message || `${me?.company?.name || 'Your company'} has not published your card yet. You will get an email the moment it is live.`}</p>
      {me && me.user.role !== 'member' && <BrowserLink href="/app" label="Open the company dashboard" />}
    </div>
  );
}

/** Vellaire staff with no company of their own have no card, so the app has nothing to show them. */
export function NoCompany() {
  const signOut = async () => {
    await api.post('/auth/logout');
    window.location.href = '/signin';
  };
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-pearl px-8 text-center">
      <Seal size={48} className="text-gold" />
      <h1 className="mt-6 font-display text-[32px] leading-tight">The app is for card holders</h1>
      <p className="mt-2 max-w-85 text-[15px] text-stone">This account runs Vellaire and has no business card. Sign in with an employee account to use the app.</p>
      <BrowserLink href="/console" label="Open the owner console" />
      <Button className="mt-6" icon="logout" onClick={signOut}>
        Sign out
      </Button>
    </div>
  );
}
