'use client';

import Link from 'next/link';
import { Seal } from '@/components/icons';
import { useMe } from '@/lib/api';

export function NoCard({ message }: { message?: string }) {
  const { data: me } = useMe();
  return (
    <div className="flex flex-col items-center px-4 py-16 text-center">
      <Seal size={48} className="text-gold" />
      <h1 className="mt-6 font-display text-[32px] leading-tight">Your card is on its way</h1>
      <p className="mt-2 text-[15px] text-stone">{message || `${me?.company?.name || 'Your company'} has not published your card yet. You will get an email the moment it is live.`}</p>
      {me && me.user.role !== 'member' && (
        <Link href="/app" className="mt-6 text-[14px] text-gold-text underline underline-offset-4">
          Go to the company dashboard
        </Link>
      )}
    </div>
  );
}
