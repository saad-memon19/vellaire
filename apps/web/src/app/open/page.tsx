'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { inInstalledApp } from '@/components/pwa';
import { Loading, ScreenError } from '@/components/ui';
import { useMe } from '@/lib/api';

/**
 * Where the installed app starts: everyone lands in the employee app. In a desktop browser admins land in the
 * dashboard and Vellaire staff in the console. Signed-out people go to /signin and come back here.
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
  if (error) return <ScreenError error={error} retry={() => mutate()} />;
  return <Loading className="min-h-screen" />;
}
