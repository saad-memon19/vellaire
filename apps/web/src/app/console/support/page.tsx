'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { HealthBar } from '@/components/health-bar';
import { Icon } from '@/components/icons';
import { useToast } from '@/components/toast';
import { Badge, Button, cx, ErrorState, Loading, PageHeader, StatusBadge, PillTabs, Textarea, Toggle } from '@/components/ui';
import { api, useApi } from '@/lib/api';

export default function Page() {
  return (
    <Suspense fallback={<Loading />}>
      <Inbox />
    </Suspense>
  );
}

const PRIORITY_TONE: Record<string, any> = {
  urgent: 'err',
  high: 'warn',
  normal: 'neutral',
  low: 'neutral',
};

function Inbox() {
  const params = useSearchParams();
  const [tab, setTab] = useState('open');
  const [openId, setOpenId] = useState<string | null>(params.get('open'));
  const { data, error, mutate } = useApi<any>(`/console/support?tab=${tab}`);
  useEffect(() => {
    if (!openId && data?.rows?.[0]) setOpenId(data.rows[0].id);
  }, [data, openId]);

  if (error) return <ErrorState error={error} retry={() => mutate()} />;
  return (
    <div>
      <PageHeader
        eyebrow="Support"
        title="Support inbox"
        actions={
          data && (
            <PillTabs
              items={data.tabs.map((t: any) => ({
                id: t.id,
                name: t.name,
                count: t.n,
              }))}
              value={tab}
              onChange={(v) => {
                setTab(v);
                setOpenId(null);
              }}
            />
          )
        }
      />
      <div className="grid overflow-hidden rounded-[14px] border border-linen bg-white max-xl:divide-y xl:grid-cols-[340px_1fr_300px] xl:divide-x divide-linen">
        <section className="min-w-0">
          {!data ? (
            <Loading />
          ) : data.rows.length === 0 ? (
            <p className="p-6 text-center text-[14px] text-stone-2">Inbox zero</p>
          ) : (
            <ul className="divide-y divide-linen">
              {data.rows.map((t: any) => (
                <li key={t.id}>
                  <button type="button" onClick={() => setOpenId(t.id)} className={cx('w-full px-4 py-3 text-left', openId === t.id ? 'bg-gold-tint' : 'hover:bg-pearl')}>
                    <div className="flex items-center justify-between gap-2 text-[12px]">
                      <span className="font-medium text-stone">{t.company}</span>
                      <span className={t.breached ? 'font-medium text-err' : 'text-stone-2'}>{t.sla}</span>
                    </div>
                    <div className="mt-0.5 truncate text-[14px] font-medium">{t.subject}</div>
                    <div className="mt-1 flex items-center gap-2 text-[12px] text-stone-2">
                      <Badge tone={PRIORITY_TONE[t.priority]} className="!py-0.5 capitalize">
                        {t.priority}
                      </Badge>
                      {t.who}
                      {t.assignee && ` · ${t.assignee}`}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
        {openId ? <Ticket id={openId} onChange={() => mutate()} /> : <div />}
      </div>
    </div>
  );
}

function Ticket({ id, onChange }: { id: string; onChange: () => void }) {
  const { data, mutate } = useApi<any>(`/console/support/${id}`);
  const [reply, setReply] = useState('');
  const [internal, setInternal] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const toast = useToast();
  useEffect(() => setReply(''), [id]);

  const act = async (key: string, fn: () => Promise<any>, ok?: string) => {
    setBusy(key);
    try {
      await fn();
      if (ok) toast(ok);
      mutate();
      onChange();
    } catch (e) {
      toast((e as Error).message, 'err');
    } finally {
      setBusy(null);
    }
  };
  const suggest = async () => {
    setBusy('suggest');
    try {
      const r = await api.post(`/console/support/${id}/suggest`);
      setReply(r.text);
    } finally {
      setBusy(null);
    }
  };

  if (!data) return <Loading className="p-10" />;
  const c = data.company;
  return (
    <>
      <section className="min-w-0 p-6">
        <div className="mb-1 flex flex-wrap items-start justify-between gap-3">
          <h2 className="text-[20px] font-semibold leading-snug">{data.subject}</h2>
          <StatusBadge status={data.status} />
        </div>
        <p className="text-[13px] text-stone-2">{data.opened}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            size="sm"
            disabled={!!data.assignee}
            loading={busy === 'assign'}
            onClick={() => act('assign', () => api.patch(`/console/support/${id}`, { assignToMe: true }), 'Assigned to you')}
          >
            {data.assignee ? `Assigned · ${data.assignee}` : 'Assign to me'}
          </Button>
          <Button size="sm" loading={busy === 'esc'} onClick={() => act('esc', () => api.patch(`/console/support/${id}`, { escalate: true }), 'Escalated')}>
            Escalate
          </Button>
          {data.status !== 'closed' ? (
            <Button size="sm" variant="ghost" onClick={() => act('close', () => api.patch(`/console/support/${id}`, { status: 'closed' }), 'Closed')}>
              Close
            </Button>
          ) : (
            <Button size="sm" variant="ghost" onClick={() => act('reopen', () => api.patch(`/console/support/${id}`, { status: 'open' }), 'Reopened')}>
              Reopen
            </Button>
          )}
        </div>
        <div className="mt-6 flex flex-col gap-4">
          {data.messages.map((m: any, i: number) => (
            <div
              key={i}
              className={cx(
                'max-w-[90%] rounded-xl px-4 py-3 text-[14px]',
                m.kind === 'customer'
                  ? 'bg-pearl'
                  : m.kind === 'system'
                    ? 'self-center bg-warn-bg text-[13px] text-warn'
                    : m.kind === 'internal'
                      ? 'self-end border border-dashed border-gold-line bg-gold-tint'
                      : 'self-end bg-ink text-cream',
              )}
            >
              <div className={cx('mb-1 text-[12px]', m.kind === 'staff' ? 'text-cream/70' : 'text-stone-2')}>
                {m.kind === 'internal' ? 'Internal note · ' : ''}
                {m.author} · {m.when}
              </div>
              <div className="whitespace-pre-wrap">{m.body}</div>
            </div>
          ))}
        </div>
        <div className="mt-6 border-t border-line pt-4">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <Button size="sm" variant="gold" icon="sparkle" loading={busy === 'suggest'} onClick={suggest}>
              Suggest a reply
            </Button>
            <label className="flex items-center gap-2 text-[13px] text-stone">
              Internal note
              <Toggle checked={internal} onChange={setInternal} label="Internal note" />
            </label>
          </div>
          <Textarea
            aria-label="Reply"
            rows={4}
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            placeholder={internal ? 'Only Vellaire staff see this' : 'Write a reply'}
          />
          <div className="mt-2 flex justify-end gap-2">
            {!internal && (
              <Button
                disabled={!reply}
                loading={busy === 'sendclose'}
                onClick={() =>
                  act(
                    'sendclose',
                    () =>
                      api.post(`/console/support/${id}/reply`, {
                        body: reply,
                        close: true,
                      }),
                    'Sent and closed',
                  ).then(() => setReply(''))
                }
              >
                Send and close
              </Button>
            )}
            <Button
              variant="ink"
              icon="send"
              disabled={!reply}
              loading={busy === 'send'}
              onClick={() =>
                act(
                  'send',
                  () =>
                    api.post(`/console/support/${id}/reply`, {
                      body: reply,
                      internal,
                    }),
                  internal ? 'Note added' : 'Reply sent',
                ).then(() => setReply(''))
              }
            >
              {internal ? 'Add note' : 'Send'}
            </Button>
          </div>
        </div>
      </section>
      <section className="bg-[#FCFBF8] p-6">
        <div className="mb-4 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-ink font-display text-[18px] text-gold-soft">{c.ini[0]}</span>
          <div>
            <div className="text-[15px] font-medium">{c.name}</div>
            <div className="text-[13px] text-stone-2">{c.plan}</div>
          </div>
        </div>
        <dl className="flex flex-col gap-2 text-[14px]">
          <div className="flex items-center justify-between gap-3 border-b border-linen pb-2">
            <dt className="text-stone-2">Health</dt>
            <dd>
              <HealthBar h={c.health} />
            </dd>
          </div>
          {[
            ['Payment', c.payment],
            ['HR link', c.hr],
            ['Open tickets', c.openTickets],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between gap-3 border-b border-linen pb-2">
              <dt className="text-stone-2">{k}</dt>
              <dd className={cx('text-right', (v === 'Past due' || String(v).toLowerCase().includes('expired')) && 'text-err')}>{v}</dd>
            </div>
          ))}
        </dl>
        <Link href={`/console/companies/${c.id}`} className="mt-4 inline-flex items-center gap-1 text-[14px] text-gold-text hover:text-ink">
          Open company profile <Icon name="right" size={15} />
        </Link>
      </section>
    </>
  );
}
