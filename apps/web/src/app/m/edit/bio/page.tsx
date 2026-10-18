'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Icon } from '@/components/icons';
import { useToast } from '@/components/toast';
import { Button, cx, Loading, Spinner } from '@/components/ui';
import { api, useApi, useMe } from '@/lib/api';
import { LANGS } from '@/lib/catalog';
import { NoCard } from '../../no-card';
import { useMyCard } from '../../use-my-card';

const TONES = [
  { id: 'formal', name: 'Formal' },
  { id: 'warm', name: 'Warm' },
  { id: 'short', name: 'Short' },
] as const;

/** Write the card bio with AI: a few words, a tone, suggestions to pick from, translations. Design: AIBio. */
export default function AiBio() {
  const { data, error, mutate } = useMyCard();
  const { data: me } = useMe();
  const { data: ai } = useApi<{ languages: Record<string, string> }>('/ai/status');
  const router = useRouter();
  const toast = useToast();
  const [words, setWords] = useState('');
  const [tone, setTone] = useState<(typeof TONES)[number]['id']>('formal');
  const [ideas, setIdeas] = useState<string[]>([]);
  const [i, setI] = useState(0);
  const [translated, setTranslated] = useState<Record<string, string> | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  if (error) return <NoCard />;
  if (!data || !me) return <Loading className="min-h-screen" />;
  const f = data.card.fields;
  // The company's other card languages that AI can translate into
  const others = (data.languages as string[]).filter((l) => l !== 'en' && ai?.languages?.[l]);
  const text = ideas[i] || '';

  const suggest = async () => {
    setBusy('write');
    try {
      const r = await api.post<{ bio: string }>('/ai/bio', { name: f.name, title: f.title, department: f.department, office: f.office, keywords: words || undefined, tone });
      setIdeas((x) => [...x, r.bio.trim()]);
      setI(ideas.length);
      setTranslated(null);
    } catch (e) {
      toast((e as Error).message, 'err');
    } finally {
      setBusy(null);
    }
  };
  const translate = async () => {
    setBusy('translate');
    try {
      const out: Record<string, string> = {};
      for (const l of others) out[l] = (await api.post<{ fields: { bio: string } }>('/ai/translate', { language: l, fields: { bio: text } })).fields.bio;
      setTranslated(out);
      toast(`Translated into ${others.map((l) => LANGS[l] || l).join(', ')}`);
    } catch (e) {
      toast((e as Error).message, 'err');
    } finally {
      setBusy(null);
    }
  };
  const use = async () => {
    setBusy('save');
    try {
      const body: any = { bio: text };
      if (translated) {
        const t = { ...(data.card.translations || {}) };
        for (const [l, bio] of Object.entries(translated)) t[l] = { ...(t[l] || {}), bio };
        body.translations = t;
      }
      const r = await api.patch<{ message: string }>('/me/card', body);
      toast(r.message || 'Bio saved');
      await mutate();
      router.replace('/m/edit');
    } catch (e) {
      toast((e as Error).message, 'err');
      setBusy(null);
    }
  };

  return (
    <main className="relative min-h-screen bg-[#E9E4DA]">
      <div className="absolute inset-0 bg-ink/45" aria-hidden="true" />
      <section role="dialog" aria-label="Write my bio with AI" className="absolute inset-x-0 bottom-0 top-[70px] flex flex-col gap-4 overflow-y-auto rounded-t-3xl bg-[#FBFAF7] px-5 pb-[30px] pt-3">
        <span className="h-[5px] w-10 self-center rounded-full bg-[#D9D2C4]" aria-hidden="true" />
        <div className="flex items-center justify-between">
          <h2 className="m-0 flex items-center gap-2.5 font-display text-[28px] font-medium">
            <Icon name="sparkle" size={22} className="text-gold-text" /> Write my bio
          </h2>
          <Link href="/m/edit" aria-label="Close" className="flex h-10 w-10 items-center justify-center rounded-full bg-[#F2EEE6]">
            <Icon name="x" size={18} />
          </Link>
        </div>

        {!me.features.ai ? (
          <p className="text-[14px] text-stone">AI is not switched on for your company yet. You can still write your bio yourself in Edit my card.</p>
        ) : (
          <>
            <label className="flex flex-col gap-2 text-[13px] font-medium">
              Three words about your work
              <input value={words} onChange={(e) => setWords(e.target.value)} placeholder="For example: family wealth, Gulf, long-term" className="h-12 rounded-xl border border-[#E0D9CC] bg-white px-3.5 text-[15px] font-normal outline-none focus:border-gold" />
            </label>
            <div className="flex flex-col gap-2">
              <span className="text-[13px] font-medium">Tone</span>
              <div className="flex gap-2" role="radiogroup" aria-label="Tone">
                {TONES.map((t) => (
                  <button key={t.id} type="button" role="radio" aria-checked={tone === t.id} onClick={() => setTone(t.id)} className={cx('rounded-full px-3.5 py-2 text-[13px]', tone === t.id ? 'bg-ink text-white' : 'border border-[#E0D9CC] bg-white')}>
                    {t.name}
                  </button>
                ))}
              </div>
            </div>

            {text ? (
              <div className="flex flex-col gap-2.5 rounded-2xl border border-gold-line bg-white p-4">
                <span className="text-[10.5px] font-semibold tracking-[0.2em] text-gold-text">
                  SUGGESTION {i + 1} OF {ideas.length}
                </span>
                <p className="m-0 font-display text-[20px] leading-[1.45]">{text}</p>
                {translated && Object.entries(translated).map(([l, t]) => <p key={l} dir="auto" className="m-0 border-t border-[#F0EBE2] pt-2 text-[14px] leading-relaxed text-stone">{t}</p>)}
                <div className="flex items-center justify-between text-[13px] text-stone-2">
                  <span>{text.length} of 300 characters</span>
                  <span className="flex gap-3.5">
                    {ideas.length > 1 && (
                      <button type="button" onClick={() => (setI((i + 1) % ideas.length), setTranslated(null))} className="text-gold-text">
                        Next
                      </button>
                    )}
                    <button type="button" disabled={!!busy} onClick={suggest} className="text-gold-text disabled:opacity-50">
                      {busy === 'write' ? 'Writing…' : 'Try another'}
                    </button>
                    {others.length > 0 && (
                      <button type="button" disabled={!!busy} onClick={translate} className="text-gold-text disabled:opacity-50">
                        {busy === 'translate' ? 'Translating…' : 'Translate'}
                      </button>
                    )}
                  </span>
                </div>
              </div>
            ) : (
              <Button variant="gold" size="lg" icon={busy === 'write' ? undefined : 'sparkle'} disabled={!!busy} onClick={suggest}>
                {busy === 'write' ? <Spinner size={18} /> : 'Write suggestions'}
              </Button>
            )}

            <span className="text-[12.5px] leading-normal text-stone-2">Uses your title and department from HR. Your company&apos;s data is never used to train AI.</span>
            <Button variant="ink" size="lg" className="mt-auto" disabled={!text} loading={busy === 'save'} onClick={use}>
              Use this bio
            </Button>
          </>
        )}
      </section>
    </main>
  );
}
