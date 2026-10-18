'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Icon } from '@/components/icons';
import { useToast } from '@/components/toast';
import { Button, cx, Loading } from '@/components/ui';
import { api, useApi } from '@/lib/api';
import { MATERIALS } from '@/lib/catalog';
import { NoCard } from '../no-card';
import { useMyCard } from '../use-my-card';

type Nfc = { id: string; uid: string; name: string; material: string; status: string; office: string | null; stage: string; deliveredAt: string | null; activatedAt: string | null; lastTapAt: string | null };
type Reader = { scan: (o?: { signal?: AbortSignal }) => Promise<void>; onreading: ((e: { message: { records: { recordType: string; data?: DataView }[] } }) => void) | null; onreadingerror: (() => void) | null };

/**
 * Activate your card: the first real tap switches it on. Android Chrome can read the chip here (Web NFC);
 * on iPhone you tap it on any phone and this screen sees the tap arrive. Design: ActivateNFC.
 */
export default function ActivateNfc() {
  const { data: card, error } = useMyCard();
  // Check again every few seconds until the first tap arrives
  const { data: list, mutate } = useApi<Nfc[]>('/me/nfc', { refreshInterval: (l?: Nfc[]) => (l?.some((d: Nfc) => d.status === 'active' && !d.activatedAt) ? 4000 : 0) });
  const [webNfc, setWebNfc] = useState(false);
  const [reading, setReading] = useState(false);
  const toast = useToast();
  useEffect(() => setWebNfc('NDEFReader' in window), []);

  if (error) return <NoCard />;
  if (!card || !list) return <Loading className="min-h-screen" />;
  const d = list.find((x) => x.status !== 'lost') || list[0];
  const c = card.card;

  const read = async () => {
    const R = (window as unknown as { NDEFReader: new () => Reader }).NDEFReader;
    const reader = new R();
    const stop = new AbortController();
    setReading(true);
    try {
      await reader.scan({ signal: stop.signal });
      reader.onreading = async (e) => {
        stop.abort();
        // The chip holds https://<web>/t/<uid>
        const url = e.message.records.map((r) => (r.recordType === 'url' && r.data ? new TextDecoder().decode(r.data) : '')).find((u) => u.includes('/t/'));
        const uid = url?.split('/t/')[1]?.split(/[?#/]/)[0];
        try {
          if (!uid) throw new Error('This chip has no Vellaire link on it');
          const r = await api.post<{ name: string }>('/me/nfc/activate', { uid });
          toast(`${r.name} activated`);
          mutate();
        } catch (err) {
          toast((err as Error).message, 'err');
        } finally {
          setReading(false);
        }
      };
      reader.onreadingerror = () => toast('Could not read the card. Hold it still near the top of your phone.', 'err');
    } catch (err) {
      setReading(false);
      toast((err as Error).message || 'NFC is off on this phone', 'err');
    }
  };

  const steps = d
    ? [
        { done: d.stage === 'delivered', text: d.stage === 'delivered' ? `Card delivered${d.office ? ` to ${d.office}` : ''}` : `Card on its way (${d.stage})` },
        { done: !!d.activatedAt, text: webNfc ? 'Tap the card to your phone' : 'Tap the card on the back of any phone' },
        { done: !!d.activatedAt && !!d.lastTapAt && new Date(d.lastTapAt) > new Date(d.activatedAt), text: 'Test it on a colleague’s phone' },
      ]
    : [];
  const current = steps.findIndex((s) => !s.done);
  const bg = MATERIALS.find((m) => m.id === d?.material)?.bg;

  return (
    <main className="flex min-h-screen flex-col gap-4 px-5 pb-[30px] pt-14">
      <div className="flex items-center gap-3">
        <Link href="/m" aria-label="Back" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-linen bg-white text-ink">
          <Icon name="left" size={20} />
        </Link>
        <h1 className="m-0 flex-1 font-display text-[28px] font-medium">{d?.activatedAt ? 'My NFC card' : 'Activate your card'}</h1>
      </div>

      {!d ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
          <Icon name="nfc" size={40} className="text-gold" />
          <span className="font-display text-[26px]">No NFC card yet</span>
          <span className="text-[14px] text-stone">Your company orders NFC cards. When yours arrives, activate it here.</span>
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-[30px] text-center">
          <div className="relative flex h-[260px] w-[260px] items-center justify-center">
            {!d.activatedAt && <span className="absolute h-[180px] w-[180px] animate-ping rounded-full border-2 border-gold opacity-40" />}
            <span className="absolute h-[220px] w-[220px] rounded-full bg-[radial-gradient(circle,rgba(176,141,79,0.16),rgba(176,141,79,0)_70%)]" />
            <div className="relative box-border flex aspect-[1.586] w-[210px] -rotate-8 flex-col justify-between rounded-[14px] border border-[rgba(201,169,110,0.4)] p-4 text-[#F6F1E7] shadow-[0_24px_48px_rgba(23,23,27,0.3)]" style={{ background: bg || 'linear-gradient(135deg,#1C1C20 0%,#0E0E10 42%,#26262C 56%,#0C0C0E 100%)' }}>
              <span className="flex items-center justify-between">
                <span className="text-[7.5px] tracking-[0.3em] text-[#C9A96E]">{c.brand?.companyName?.toUpperCase()}</span>
                <Icon name="nfc" size={16} className="text-[#C9A96E]" />
              </span>
              <span className="text-left font-display text-[20px]">{c.fields.name}</span>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <span className="font-display text-[30px] font-medium leading-tight">
              {d.status === 'lost' ? 'This card was reported lost' : d.activatedAt ? 'Your card is active' : webNfc ? 'Hold your card near the top of your phone' : 'Tap your card on any phone'}
            </span>
            <span className="text-[14px] leading-normal text-stone">
              {d.status === 'lost'
                ? 'Ask your admin to switch it back on or order a new one.'
                : d.activatedAt
                  ? `Tapping your ${d.name} opens your card on any phone.`
                  : webNfc
                    ? `We check this ${d.name} is yours. It takes about two seconds.`
                    : `Hold your ${d.name} on the back of a phone, near the top. This screen updates as soon as the tap arrives.`}
            </span>
          </div>
          <ol className="m-0 flex w-full list-none flex-col gap-2.5 p-0 text-left">
            {steps.map((s, i) => (
              <li key={i} className={cx('flex items-center gap-3 text-[14px]', i === current && 'font-semibold', i > current && current >= 0 && 'text-[#8E887E]')}>
                <span className={cx('flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full text-[12px] font-semibold', s.done ? 'bg-gold text-white' : i === current ? 'bg-ink text-white' : 'border border-[#D9D2C4]')}>{s.done ? '✓' : i + 1}</span>
                {s.text}
              </li>
            ))}
          </ol>
          {webNfc && !d.activatedAt && d.status !== 'lost' && (
            <Button variant="ink" size="lg" className="w-full" loading={reading} onClick={read}>
              {reading ? 'Hold the card near your phone…' : 'Read my card'}
            </Button>
          )}
        </div>
      )}

      <span className="text-center text-[13px] text-stone-2">
        Card not working?{' '}
        <Link href="/m/settings" className="text-ink underline underline-offset-2">
          Report a problem
        </Link>
      </span>
    </main>
  );
}
