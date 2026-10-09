'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { CardFace } from '@/components/card/card-face';
import { Icon } from '@/components/icons';
import { useToast } from '@/components/toast';
import { Button, copyText, LinkButton, Loading } from '@/components/ui';
import { useApi } from '@/lib/api';

function Done() {
  const params = useSearchParams();
  const id = params.get('card');
  const { data } = useApi<any>(id ? `/cards/${id}` : null);
  const [result, setResult] = useState<{ status: string; steps: { text: string; state: string }[] } | null>(null);
  const toast = useToast();

  useEffect(() => {
    if (!id) return;
    try {
      setResult(JSON.parse(sessionStorage.getItem(`vl-published-${id}`) || 'null'));
    } catch {
      /* page opened directly */
    }
  }, [id]);

  if (!data) return <Loading />;
  const c = data.card;
  const first = (c.fields.name || '').split(' ')[0];
  const status = result?.status || c.status;
  const heading =
    status === 'live' ? `${first}'s card is live` : status === 'scheduled' ? `${first}'s card is scheduled` : status === 'pending_approval' ? `${first}'s card is waiting for approval` : `${first}'s card is saved`;
  const sub =
    status === 'live'
      ? c.delivery.includes('email')
        ? `We emailed ${first} a welcome pack.${result?.steps.some((s) => s.text.includes('NFC')) ? ' The NFC card is in production.' : ''}`
        : 'Share the link or QR code to start.'
      : status === 'scheduled'
        ? `It goes live on ${new Date(c.publishAt).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}.`
        : status === 'pending_approval'
          ? 'Your Brand Manager will review it before it goes live.'
          : '';

  return (
    <div className="mx-auto max-w-3xl py-6">
      <div className="mb-8 flex flex-col items-center text-center">
        <span className="mb-4 flex items-center gap-2 rounded-full bg-ok-bg px-3 py-1 text-[13px] text-ok">
          <Icon name="check" size={15} /> All 4 steps complete
        </span>
        <h1 className="font-display text-[46px] leading-tight">{heading}</h1>
        {sub && <p className="mt-2 max-w-lg text-[15px] text-stone">{sub}</p>}
      </div>
      <div className="mx-auto mb-8 max-w-[420px]">
        <CardFace layout={c.layout} theme={c.theme} fields={c.fields} translations={c.translations} brand={c.brand} width="100%" />
      </div>
      <div className="mb-10 flex flex-wrap justify-center gap-2">
        <Button icon="copy" onClick={() => copyText(c.url)?.then(() => toast('Link copied'))}>
          Copy link
        </Button>
        <LinkButton href={`/api/cards/${c.id}/qr?format=png`} icon="download">
          Download QR code
        </LinkButton>
        {status === 'live' && (
          <LinkButton href={c.url} target="_blank" rel="noreferrer" icon="external">
            View public card
          </LinkButton>
        )}
        <LinkButton href="/app/create" variant="ink" icon="plus">
          Create another card
        </LinkButton>
      </div>
      {result?.steps?.length ? (
        <section className="rounded-xl border border-line bg-white p-6">
          <h2 className="mb-4 text-[16px] font-semibold">What happened</h2>
          <ul className="flex flex-col divide-y divide-linen">
            {result.steps.map((s) => (
              <li key={s.text} className="flex items-start justify-between gap-4 py-3">
                <span className="flex items-start gap-3 text-[14px]">
                  <Icon name="checkCircle" size={18} className="mt-0.5 text-ok" />
                  {s.text}
                </span>
                <span className="whitespace-nowrap text-[13px] text-stone-2">{s.state}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<Loading />}>
      <Done />
    </Suspense>
  );
}
