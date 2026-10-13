'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Loading, ScreenError } from '@/components/ui';
import { useMe } from '@/lib/api';

/**
 * Where the installed app starts: admins land in the dashboard, employees in their card,
 * Vellaire staff in the console. Signed-out people go to /signin and come back here.
 */
export default function OpenApp() {
  const { data: me, error, mutate } = useMe();
  const router = useRouter();
  useEffect(() => {
    if (me) router.replace(me.home);
  }, [me, router]);
  if (error) return <ScreenError error={error} retry={() => mutate()} />;
  return <Loading className="min-h-screen" />;
}
