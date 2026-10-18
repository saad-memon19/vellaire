'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Icon } from '@/components/icons';
import { useToast } from '@/components/toast';
import { Button, cx, Loading } from '@/components/ui';
import { api } from '@/lib/api';
import { LANGS } from '@/lib/catalog';
import { NoCard } from '../no-card';
import { useMyCard } from '../use-my-card';

const RTL = ['ar', 'ur'];
const NAMES: Record<string, string> = { en: 'English', ar: 'Arabic', fr: 'French', zh: 'Chinese', es: 'Spanish', de: 'German', ur: 'Urdu', hi: 'Hindi', ru: 'Russian' };

/**
 * My cards: each language the card is written in, and which one QR, NFC and plain links open. Design: CardSwitcher.
 * One card holds every language, so a "card" here is a language version of it.
 */
export default function CardSwitcher() {
  const { data, error, mutate } = useMyCard();
  const router = useRouter();
  const toast = useToast();
  const [pick, setPick] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (error) return <NoCard />;
  if (!data) return <Loading className="min-h-screen" />;
  const c = data.card;
  const langs = ['en', ...Object.keys(c.translations || {}).filter((l) => c.translations[l]?.name || c.translations[l]?.bio)];
  const chosen = pick ?? data.defaultLang ?? 'en';
  const url = (l: string) => `${c.displayUrl}${l === 'en' ? '' : `?lang=${l}`}`;

  const use = async () => {
    if (chosen === data.defaultLang) return router.push('/m');
    setBusy(true);
    try {
      await api.patch('/me/card', { defaultLang: chosen });
      await mutate();
      toast(`Your QR, NFC card and link now open in ${NAMES[chosen] || chosen}`);
      router.push('/m');
    } catch (e) {
      toast((e as Error).message, 'err');
      setBusy(false);
    }
  };

  return (
    <main className="relative min-h-screen bg-[#E9E4DA]">
      <Link href="/m" aria-label="Close" className="absolute inset-0 bg-ink/45" />
      <section role="dialog" aria-label="Choose a card" className="absolute inset-x-0 bottom-0 flex max-h-[90vh] flex-col gap-4 overflow-y-auto rounded-t-3xl bg-[#FBFAF7] px-5 pb-[30px] pt-3">
        <span className="h-[5px] w-10 self-center rounded-full bg-[#D9D2C4]" aria-hidden="true" />
        <div className="flex items-center justify-between">
          <h2 className="m-0 font-display text-[28px] font-medium">My cards</h2>
          <Link href="/m" aria-label="Close" className="flex h-10 w-10 items-center justify-center rounded-full bg-[#F2EEE6]">
            <Icon name="x" size={18} />
          </Link>
        </div>

        <div role="radiogroup" aria-label="Card language" className="flex flex-col gap-3">
          {langs.map((l) => {
            const on = chosen === l;
            const name = l === 'en' ? c.fields.name : c.translations[l]?.name || c.fields.name;
            return (
              <button key={l} type="button" role="radio" aria-checked={on} onClick={() => setPick(l)} className={cx('flex items-center gap-3.5 rounded-2xl bg-white p-3 text-left', on ? 'border-2 border-gold' : 'border border-linen')}>
                <span dir={RTL.includes(l) ? 'rtl' : undefined} className="box-border flex aspect-[1.586] w-24 shrink-0 flex-col justify-end rounded-lg border border-[rgba(201,169,110,0.4)] bg-[linear-gradient(135deg,#1C1C20_0%,#0E0E10_42%,#26262C_56%,#0C0C0E_100%)] p-2 font-display text-[12px] text-[#F6F1E7]">
                  {name}
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
                  <span className="font-semibold">{NAMES[l] || LANGS[l] || l} card</span>
                  <span className="truncate text-[12.5px] text-stone">{url(l)}</span>
                  {data.defaultLang === l && <span className="text-[12px] text-ok">Used for QR and NFC</span>}
                </span>
                <span className={cx('flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2', on ? 'border-ink' : 'border-[#C9BFAD]')}>{on && <span className="h-2.5 w-2.5 rounded-full bg-ink" />}</span>
              </button>
            );
          })}
        </div>

        <span className="text-[13px] leading-normal text-stone">
          {langs.length > 1 ? 'Everyone can still switch language on your card.' : 'Your card is in English only.'} Your company decides which languages you have. Ask your admin for another one.
        </span>
        <Button variant="ink" size="lg" loading={busy} onClick={use}>
          Use {NAMES[chosen] || chosen} card
        </Button>
      </section>
    </main>
  );
}
