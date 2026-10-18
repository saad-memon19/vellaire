'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Icon, Seal } from '@/components/icons';
import { Loading } from '@/components/ui';
import { NoCard } from '../no-card';
import { useMyCard } from '../use-my-card';

/** Show QR: the code full screen, for someone standing in front of you. Design: ShowQR. */
export default function ShowQr() {
  const { data, error } = useMyCard();
  const awake = useWakeLock();
  if (error) return <NoCard />;
  if (!data) return <Loading className="min-h-screen" />;
  const f = data.card.fields;

  return (
    <main className="flex min-h-screen flex-col gap-4 bg-[#FBFAF7] px-5 pb-7 pt-14">
      <div className="flex items-center justify-between">
        <Link href="/m" aria-label="Close" className="flex h-11 w-11 items-center justify-center rounded-full bg-[#F2EEE6] text-ink">
          <Icon name="x" size={20} />
        </Link>
        {/* A web page cannot raise the brightness; it can keep the screen from dimming */}
        {awake && (
          <span className="flex items-center gap-2 text-[12.5px] text-stone">
            <Icon name="eye" size={18} className="text-gold" /> Screen stays on
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-6">
        <div className="flex flex-col items-center gap-1.5 text-center">
          <span className="flex items-center gap-2">
            <Seal size={20} className="text-gold" />
            <span className="text-[10px] font-semibold tracking-[0.32em] text-gold-text">{data.card.brand?.companyName?.toUpperCase()}</span>
          </span>
          <span className="font-display text-[34px] font-medium leading-tight">{f.name}</span>
          {f.title && <span className="text-[14px] text-stone">{f.title}</span>}
        </div>
        <div className="rounded-[28px] border border-[#EEE8DD] bg-white p-[22px] shadow-[0_24px_60px_rgba(23,23,27,0.12)]">
          <img src="/api/me/qr" alt={`QR code for ${f.name}'s card`} className="h-[280px] w-[280px]" />
        </div>
        <span className="text-center text-[14px] leading-normal text-[#4E4A44]">
          Ask them to point their phone camera here.
          <br />
          No app needed.
        </span>
      </div>

      <nav aria-label="Ways to share" className="grid grid-cols-3 gap-1 rounded-[14px] bg-[#EFEBE3] p-1">
        <span aria-current="page" className="flex h-11 items-center justify-center rounded-[10px] bg-white text-[13.5px] font-semibold shadow-[0_1px_2px_rgba(23,23,27,0.08)]">
          QR code
        </span>
        <Link href="/m/share" className="flex h-11 items-center justify-center rounded-[10px] text-[13.5px] text-[#4E4A44]">
          NFC tap
        </Link>
        <Link href="/m/share" className="flex h-11 items-center justify-center rounded-[10px] text-[13.5px] text-[#4E4A44]">
          Send link
        </Link>
      </nav>
    </main>
  );
}

/** Keeps the screen on while the QR is shown, where the browser allows it. */
function useWakeLock() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null;
    const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } };
    nav.wakeLock
      ?.request('screen')
      .then((l) => {
        lock = l;
        setOn(true);
      })
      .catch(() => setOn(false));
    return () => {
      lock?.release().catch(() => {});
    };
  }, []);
  return on;
}
