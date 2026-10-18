'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { CardFace } from '@/components/card/card-face';
import { OnlineCard } from '@/components/card/online-card';
import { Icon } from '@/components/icons';
import { Avatar, Button, LinkButton } from '@/components/ui';
import { useMe } from '@/lib/api';
import { NoCard } from './no-card';
import { useMyCard } from './use-my-card';
import { AccessEnded, AppLoading } from './system';
import { welcomeKey } from './welcome-key';

export default function MyCard() {
  const { data, error } = useMyCard();
  const { data: me } = useMe();
  const router = useRouter();

  // First visit on this phone: the welcome screen once
  useEffect(() => {
    if (!data || !me) return;
    try {
      if (!localStorage.getItem(welcomeKey(me.user.id))) router.replace('/m/welcome');
    } catch {}
  }, [data, me, router]);

  const [preview, setPreview] = useState(false);
  if (error) return <NoCard message={(error as Error).message.includes('created') ? undefined : (error as Error).message} />;
  if (!data) return <AppLoading />;
  const c = data.card;
  // The company switched the card off: the person has left
  if (c.status === 'deactivated') return <AccessEnded company={c.brand?.companyName} />;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center justify-between">
        <div>
          <div className="text-[14px] text-stone">{data.greeting}</div>
          <h1 className="font-display text-[34px] leading-tight">{data.firstName}</h1>
        </div>
        <Link href="/m/settings" aria-label="Settings">
          <Avatar name={c.fields.name} src={c.fields.photoUrl} size={44} />
        </Link>
      </header>

      <CardFace layout={c.layout} theme={c.theme} fields={c.fields} translations={c.translations} brand={c.brand} width="100%" />

      <div className="-mt-2 flex items-center justify-center gap-2 text-[13px] text-stone">
        <span className={`h-2 w-2 rounded-full ${c.status === 'live' ? 'bg-ok' : 'bg-warn'}`} />
        {c.status === 'live' ? 'Live' : c.status === 'deactivated' ? 'Switched off' : 'Not live yet'} · {data.syncedNote}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <LinkButton size="lg" variant="ink" icon="qr" href="/m/qr">
          Show QR
        </LinkButton>
        <Button size="lg" icon="eye" onClick={() => setPreview(true)}>
          Preview card
        </Button>
      </div>

      <dl className="grid grid-cols-3 divide-x divide-[#F0EBE2] rounded-2xl border border-linen bg-white py-4">
        {[
          [data.week.views, 'Views this week'],
          [data.week.saves, 'Saved you'],
          [data.week.leads, 'New leads'],
        ].map(([v, l]) => (
          <div key={l as string} className="flex flex-col-reverse items-center gap-1 px-2 text-center">
            <dt className="text-[12px] leading-tight text-stone">{l}</dt>
            <dd className="font-display text-[30px] font-medium leading-none">{Number(v).toLocaleString()}</dd>
          </div>
        ))}
      </dl>

      {data.followUp && (
        <Link href={`/m/leads/${data.followUp.id}`} className="flex items-center gap-3.5 rounded-2xl border border-gold-line bg-[#FBF6EC] p-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-ink text-[#E6D3A3]">
            <Icon name="sparkle" size={18} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-semibold">Follow up with {data.followUp.name}</span>
            <span className="block text-[13px] text-stone">{data.followUp.hasDraft ? 'A draft email is ready for you' : 'They shared their details with you'}</span>
          </span>
          <Icon name="right" className="text-stone-2" />
        </Link>
      )}

      <Link href="/m/edit" className="flex items-center gap-3.5 rounded-2xl border border-linen bg-white p-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-gold-tint text-gold-text">
          <Icon name="edit" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-medium">Edit my card</span>
          <span className="block text-[13px] text-stone-2">Bio, photo, links and languages</span>
        </span>
        <Icon name="right" className="text-stone-2" />
      </Link>

      {preview && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-ink/60 sm:p-6" onClick={(e) => e.target === e.currentTarget && setPreview(false)}>
          <div className="mx-auto max-w-[440px] overflow-hidden bg-white sm:rounded-2xl">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <span className="text-[14px] font-medium">What clients see</span>
              <button type="button" onClick={() => setPreview(false)} className="flex h-9 w-9 items-center justify-center rounded-md hover:bg-sand" aria-label="Close preview">
                <Icon name="x" />
              </button>
            </div>
            <OnlineCard card={c} preview />
          </div>
        </div>
      )}
    </div>
  );
}
