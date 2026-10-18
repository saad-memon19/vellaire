'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { inInstalledApp } from '@/components/pwa';
import { useMe } from '@/lib/api';
import { AppError, AppSplash } from '../m/system';

/**
 * Where the installed app starts: everyone lands in the employee app. In a desktop browser admins land in the
 * dashboard and Vellaire staff in the console. Signed-out people go to /signin and come back here.
 * While the account loads, the design's splash screen shows.
 */
export default function OpenApp() {
  const { data: me, error, mutate } = useMe();
  const router = useRouter();
  useEffect(() => {
    if (!me) return;
    // The installed app is the employee app (My card, Share, Leads) for everyone; the dashboard and the console stay in the browser
    const phone = window.matchMedia('(max-width: 767px)').matches;
    router.replace(inInstalledApp() || phone ? '/m' : me.home);
  }, [me, router]);
  if (error && (error as { status?: number }).status !== 401) return <AppError error={error} retry={() => mutate()} />;
  return <AppSplash />;
}
