'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Loading, ScreenError } from '@/components/ui';
import { useMe } from '@/lib/api';

/**
 * Where the installed app starts: admins land in the dashboard (their card on a phone), employees in their card,
 * Vellaire staff in the console. Signed-out people go to /signin and come back here.
 */
export default function OpenApp() {
  const { data: me, error, mutate } = useMe();
  const router = useRouter();
  useEffect(() => {
    if (!me) return;
    // On a phone the app is the employee app (My card, Share, Leads); admins reach the dashboard from its Settings
    const phone = window.matchMedia('(max-width: 767px)').matches;
    router.replace(phone && me.home === '/app' ? '/m' : me.home);
  }, [me, router]);
  if (error) return <ScreenError error={error} retry={() => mutate()} />;
  return <Loading className="min-h-screen" />;
}
