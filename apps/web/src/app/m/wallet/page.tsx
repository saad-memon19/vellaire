'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { Icon, Seal } from '@/components/icons';
import { Loading } from '@/components/ui';
import { NoCard } from '../no-card';
import { useMyCard } from '../use-my-card';

/**
 * Add to wallet: a preview of the pass, then the real Apple or Google pass. Design: AddWallet.
 * The browser cannot tell whether the phone saved it, so the screen says what to do, not that it is done.
 */
export default function AddWalletPage() {
  return (
    <Suspense fallback={<Loading className="min-h-screen" />}>
      <AddWallet />
    </Suspense>
  );
}

function AddWallet() {
  const kind = useSearchParams().get('kind') === 'google' ? 'google' : 'apple';
  const { data, error } = useMyCard();
  const [opened, setOpened] = useState(false);
  if (error) return <NoCard />;
  if (!data) return <Loading className="min-h-screen" />;
  const c = data.card;
  const name = kind === 'apple' ? 'Apple Wallet' : 'Google Wallet';
  const ready = data.wallet[kind];

  return (
    <main className="flex min-h-screen flex-col gap-4 px-5 pb-[30px] pt-14">
      <div className="flex flex-1 flex-col items-center justify-center gap-[22px] text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-ink text-[#E6D3A3]">
          <Icon name={opened ? 'check' : 'wallet'} size={26} />
        </span>
        <div className="flex flex-col gap-1.5">
          <span className="font-display text-[32px] font-medium">{opened ? 'Check your phone' : 'Add to your wallet'}</span>
          <span className="text-[14px] leading-normal text-stone">
            {!ready
              ? `${name} is not set up by your company yet.`
              : opened
                ? `Tap Add on the ${name} screen. Then show the pass to share your card, even without internet.`
                : 'Keep your card in your phone’s wallet and share it even without internet.'}
          </span>
        </div>
        <div className="flex w-[300px] flex-col gap-3.5 rounded-[22px] bg-[linear-gradient(160deg,#1A1A1E,#0E0E10)] p-5 text-left text-[#F6F1E7] shadow-[0_30px_60px_rgba(23,23,27,0.3)]">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Seal size={18} className="text-[#C9A96E]" />
              <span className="text-[9px] tracking-[0.28em] text-[#C9A96E]">{c.brand?.companyName?.toUpperCase()}</span>
            </span>
            <span className="text-[9px] tracking-[0.2em] text-[#A9A49A]">WALLET PASS</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-[9px] tracking-[0.2em] text-[#A9A49A]">NAME</span>
            <span className="font-display text-[26px]">{c.fields.name}</span>
          </div>
          {c.fields.title && (
            <div className="flex flex-col gap-0.5">
              <span className="text-[9px] tracking-[0.2em] text-[#A9A49A]">TITLE</span>
              <span className="text-[13px]">{c.fields.title}</span>
            </div>
          )}
          <div className="h-[132px] w-[132px] self-center rounded-[10px] bg-[#F6F1E7] p-[9px]">
            <img src="/api/me/qr" alt="" className="h-full w-full" />
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-2.5">
        {ready && (
          <a href={`/api/public/cards/${c.id}/wallet/${kind}`} onClick={() => setOpened(true)} className="flex h-[54px] items-center justify-center gap-2.5 rounded-[14px] bg-black text-[15px] font-semibold text-white">
            <Icon name="wallet" size={20} /> {opened ? `Open ${name} again` : `Add to ${name}`}
          </a>
        )}
        <Link href="/m" className="flex h-[52px] items-center justify-center rounded-[14px] border border-[#D9D2C4] bg-white text-[15px]">
          Done
        </Link>
      </div>
    </main>
  );
}
