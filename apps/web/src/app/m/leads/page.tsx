'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Icon } from '@/components/icons';
import { useToast } from '@/components/toast';
import { Avatar, Button, cx, Loading, PillTabs } from '@/components/ui';
import { qs, useApi, useMe } from '@/lib/api';
import { useOnline } from '@/lib/online';
import { NoCard } from '../no-card';
import { sendFollowUp } from './follow-up';

export default function MobileLeads() {
  const [tab, setTab] = useState<'follow-up' | 'all'>('follow-up');
  const { data, error, mutate } = useApi<any>(`/me/leads${qs({ tab })}`, { shouldRetryOnError: false });
  const { data: me } = useMe();
  const online = useOnline();
  const toast = useToast();
  const [sending, setSending] = useState(false);

  if (error) return <NoCard />;
  if (!data) return <Loading />;

  const sendDraft = async () => {
    setSending(true);
    try {
      const how = await sendFollowUp(data.draft, data.draft.text, me?.company?.name);
      toast(how === 'sent' ? `Sent to ${data.draft.name}` : 'Opened in your mail app. Marked as followed up.');
      mutate();
    } catch (e) {
      toast((e as Error).message, 'err');
    } finally {
      setSending(false);
    }
  };

  const offline = !online && (
    <div className="flex items-center gap-2.5 rounded-xl bg-ink px-3.5 py-2.5 text-[13px] text-white">
      <Icon name="alert" size={18} className="text-[#E6D3A3]" />
      <span className="flex-1">You are offline. Your QR and wallet pass still work.</span>
    </div>
  );

  // Nobody has shared their details yet: the design's empty screen (EmptyLeads)
  if (data.tabs.all === 0)
    return (
      <div className="flex min-h-[calc(100vh-180px)] flex-col gap-4">
        {offline}
        <h1 className="font-display text-[34px] font-medium">Leads</h1>
        <div className="flex flex-1 flex-col items-center justify-center gap-[18px] px-2.5 text-center">
          <div className="relative h-[120px] w-[160px]" aria-hidden="true">
            <span className="absolute left-2.5 top-6 aspect-[1.586] w-[120px] -rotate-10 rounded-[10px] border-[1.5px] border-[#D9C9A6]" />
            <span className="absolute left-[34px] top-2.5 flex aspect-[1.586] w-[120px] items-center justify-center rounded-[10px] border-[1.5px] border-gold bg-[#FBF6EC] text-gold">
              <Icon name="inbox" size={24} />
            </span>
          </div>
          <span className="font-display text-[28px] font-medium leading-tight">No leads yet</span>
          <span className="text-[14px] leading-[1.55] text-stone">When someone taps your card and shares their details, they appear here. You can also scan a paper card.</span>
          <div className="flex w-full flex-col gap-2.5">
            <Link href="/m/qr" className="flex h-[54px] items-center justify-center rounded-[14px] bg-ink text-[15px] font-semibold text-white">
              Show my QR
            </Link>
            <Link href="/m/leads/scan" className="flex h-[52px] items-center justify-center gap-2.5 rounded-[14px] border border-[#D9D2C4] bg-white text-[15px]">
              <Icon name="scan" size={20} className="text-gold-text" /> Scan a paper card
            </Link>
          </div>
        </div>
      </div>
    );

  return (
    <div className="flex flex-col gap-5">
      {offline}
      <header className="flex items-center justify-between">
        <h1 className="font-display text-[34px]">Leads</h1>
        <Link href="/m/leads/scan" className="flex h-10 items-center gap-1.5 rounded-full border border-[#D9D2C4] bg-white px-3.5 text-[13px]">
          <Icon name="scan" size={17} className="text-gold-text" /> Scan paper card
        </Link>
      </header>
      <PillTabs
        items={[
          { id: 'follow-up', name: 'To follow up', count: data.tabs.followUp },
          { id: 'all', name: 'All', count: data.tabs.all },
        ]}
        value={tab}
        onChange={setTab}
      />

      {data.rows.length === 0 ? (
        <p className="py-10 text-center text-[14px] text-stone-2">All followed up. Well done.</p>
      ) : (
        <ul className="m-0 flex list-none flex-col overflow-hidden rounded-2xl border border-linen bg-white p-0">
          {data.rows.map((l: any, i: number) => (
            <li key={l.id} className={i ? 'border-t border-[#F0EBE2]' : ''}>
              <Link href={`/m/leads/${l.id}`} className="flex w-full items-center gap-3 px-4 py-3.5 text-left">
                <Avatar name={l.name} size={40} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-semibold">{l.name}</span>
                  <span className="block truncate text-[13px] text-stone">{l.co}</span>
                  <span className="block text-[12px] text-stone-2">
                    {l.via} · {l.when}
                  </span>
                </span>
                {/* Gold dot: still waiting for a follow-up */}
                <span aria-label={l.status === 'new' ? 'Needs follow-up' : 'Followed up'} className={cx('h-2 w-2 shrink-0 rounded-full', l.status === 'new' ? 'bg-gold' : 'bg-linen')} />
              </Link>
            </li>
          ))}
        </ul>
      )}

      {data.draft && (
        <div className="flex flex-col gap-3 rounded-2xl border border-gold-line bg-[#FBF6EC] p-4">
          <div className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.2em] text-gold-text">
            <Icon name="sparkle" size={16} /> DRAFT FOR {data.draft.name.toUpperCase()}
          </div>
          <p className="m-0 line-clamp-4 whitespace-pre-wrap text-[14px] leading-relaxed text-ink">{data.draft.text}</p>
          <div className="grid grid-cols-2 gap-2.5">
            <Button variant="ink" onClick={sendDraft} loading={sending} disabled={!data.draft.email}>
              Send email
            </Button>
            <Link href={`/m/leads/${data.draft.id}`} className="flex h-10 items-center justify-center rounded-md border border-line bg-white text-[14px]">
              Edit
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
