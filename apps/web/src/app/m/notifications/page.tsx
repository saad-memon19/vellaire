'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { Icon, IconName } from '@/components/icons';
import { cx, Loading } from '@/components/ui';
import { api, useApi } from '@/lib/api';
import { NoCard } from '../no-card';

type N = { id: string; kind: 'lead' | 'ok' | 'warn'; icon: string; text: string; sub?: string; at: string; href: string; unread: boolean };

const ICONS: Record<string, IconName> = { lead: 'user', view: 'eye', photo: 'user', ok: 'check', nfc: 'nfc' };
const TONES = { lead: 'bg-gold-tint text-gold-text', ok: 'bg-ok-bg text-ok', warn: 'bg-warn-bg text-warn' };

/** Notifications: what happened with your card, newest first, today and earlier. Design: AppNotifications. */
export default function Notifications() {
  const { data, error, mutate } = useApi<{ items: N[]; unread: number }>('/me/notifications', { shouldRetryOnError: false });

  // Opening the list counts as reading it; the dots stay until the next visit
  useEffect(() => {
    if (data?.unread) api.post('/me/notifications/read').catch(() => {});
  }, [data?.unread]);

  if (error) return <NoCard />;
  if (!data) return <Loading />;
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const today = data.items.filter((n) => new Date(n.at) >= start);
  const earlier = data.items.filter((n) => new Date(n.at) < start);

  const markAll = async () => {
    await api.post('/me/notifications/read');
    mutate({ ...data, unread: 0, items: data.items.map((n) => ({ ...n, unread: false })) }, false);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Link href="/m" aria-label="Back" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-linen bg-white text-ink">
          <Icon name="left" size={20} />
        </Link>
        <h1 className="m-0 flex-1 font-display text-[28px] font-medium">Notifications</h1>
        {data.items.some((n) => n.unread) && (
          <button type="button" onClick={markAll} className="h-10 rounded-[10px] border border-linen bg-white px-3 text-[12.5px]">
            Mark all read
          </button>
        )}
      </div>

      {data.items.length === 0 && <p className="py-12 text-center text-[14px] text-stone">Nothing yet. When someone opens your card or shares their details, you will see it here.</p>}
      {today.length > 0 && <Group title="TODAY" items={today} time />}
      {earlier.length > 0 && <Group title="EARLIER" items={earlier} />}
    </div>
  );
}

function Group({ title, items, time }: { title: string; items: N[]; time?: boolean }) {
  const when = (at: string) => {
    const d = new Date(at);
    if (time) return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    const y = new Date();
    y.setDate(y.getDate() - 1);
    return d.toDateString() === y.toDateString() ? 'Yesterday' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  };
  return (
    <>
      <span className="text-[11px] font-medium tracking-[0.2em] text-stone-2">{title}</span>
      <section className="overflow-hidden rounded-2xl border border-linen bg-white">
        {items.map((n, i) => (
          <Link key={n.id} href={n.href} className={cx('flex gap-3 px-4 py-3.5 text-ink', i > 0 && 'border-t border-[#F0EBE2]', n.unread && 'bg-[#FFFDF8]')}>
            <span className={cx('flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[10px]', TONES[n.kind])}>
              <Icon name={ICONS[n.icon] || 'info'} size={18} />
            </span>
            <span className="flex flex-1 flex-col gap-[3px]">
              <span className={cx('text-[14px] leading-[1.4]', n.unread && 'font-semibold')}>{n.text}</span>
              <span className="text-[12px] text-stone-2">
                {when(n.at)}
                {n.sub ? ` · ${n.sub}` : ''}
              </span>
            </span>
            <span className={cx('mt-1.5 h-2 w-2 shrink-0 rounded-full', n.unread ? 'bg-gold' : 'bg-transparent')} aria-label={n.unread ? 'Unread' : undefined} />
          </Link>
        ))}
      </section>
    </>
  );
}
