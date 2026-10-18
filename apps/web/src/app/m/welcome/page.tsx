'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { CardFace } from '@/components/card/card-face';
import { Icon, Seal } from '@/components/icons';
import { Loading } from '@/components/ui';
import { useMe } from '@/lib/api';
import { NoCard } from '../no-card';
import { useMyCard } from '../use-my-card';
import { welcomeKey } from '../welcome-key';

/** Welcome (E0): the first time someone opens the app, their card and what is left to do. */
export default function Welcome() {
  const { data, error } = useMyCard();
  const { data: me } = useMe();

  useEffect(() => {
    if (!me) return;
    try {
      localStorage.setItem(welcomeKey(me.user.id), '1');
    } catch {}
  }, [me]);

  if (error) return <NoCard />;
  if (!data || !me) return <Loading className="min-h-screen" />;
  const c = data.card;
  const company = c.brand?.companyName || me.company?.name || 'Your company';
  const fromHr = String(data.syncedNote || '').includes('from HR');

  return (
    <main className="flex min-h-screen flex-col gap-4 px-5 pb-[30px] pt-14">
      <div className="flex items-center gap-2.5">
        <Seal size={22} className="text-gold" />
        <span className="font-display text-[15px] font-semibold tracking-[0.24em]">VELLAIRE</span>
      </div>
      <div className="flex flex-1 flex-col justify-center gap-7">
        <div className="flex justify-center">
          <div className="w-[320px] -rotate-4">
            <CardFace layout={c.layout} theme={c.theme} fields={c.fields} translations={c.translations} brand={c.brand} width="100%" />
          </div>
        </div>
        <div className="flex flex-col gap-2.5 text-center">
          <span className="font-display text-[36px] font-medium leading-[1.1]">
            Welcome, {data.firstName}.
            <br />
            Your card is ready.
          </span>
          <span className="text-[14.5px] leading-[1.55] text-stone">{company} created your digital business card. Check your details and add it to your phone.</span>
        </div>
        <div className="flex flex-col gap-2.5 rounded-2xl border border-linen bg-white px-4 py-3.5">
          <Item done>{fromHr ? 'Name and title from HR' : `Name and title added by ${company}`}</Item>
          <Item done>Company brand applied</Item>
          {c.fields.photoUrl ? (
            <Item done>Profile photo added</Item>
          ) : (
            <Link href="/m/edit/photo" className="flex items-center gap-2.5 text-[14px] text-warn">
              <Icon name="plus" size={18} /> Add a profile photo
            </Link>
          )}
        </div>
      </div>
      <div className="flex flex-col gap-2.5">
        <Link href="/m/edit" className="flex h-[54px] items-center justify-center rounded-[14px] bg-ink text-[15px] font-semibold text-white">
          Check my card
        </Link>
        <Link href="/m" className="flex h-[52px] items-center justify-center rounded-[14px] border border-[#D9D2C4] bg-white text-[15px]">
          Go to my card
        </Link>
      </div>
    </main>
  );
}

function Item({ done, children }: { done?: boolean; children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-2.5 text-[14px]">
      <Icon name={done ? 'checkCircle' : 'info'} size={18} className={done ? 'text-ok' : 'text-warn'} />
      {children}
    </span>
  );
}
