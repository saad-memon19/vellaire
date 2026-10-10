'use client';

import { useEffect, useState } from 'react';
import { mutate as globalMutate } from 'swr';
import { CardFace } from '@/components/card/card-face';
import { useToast } from '@/components/toast';
import { cx, Empty, ErrorState, Loading, Panel } from '@/components/ui';
import { api, useApi } from '@/lib/api';

function pronoun(name: string = '') {
  const first = name.split(' ')[0]?.toLowerCase() || '';
  if (['layla', 'sara', 'aisha', 'fatima', 'maya', 'priya', 'hira', 'nadia', 'hana', 'salma', 'ananya', 'rania'].includes(first)) return 'her';
  if (['victor', 'samir', 'hamza', 'ahmed', 'adam', 'khalid', 'yusuf', 'omar', 'karim', 'rashid', 'ben', 'james'].includes(first)) return 'his';
  return 'their';
}

export default function Approvals() {
  const { data, error, mutate } = useApi<any>('/approvals');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const toast = useToast();

  const refresh = () => {
    mutate();
    globalMutate('/auth/me');
  };

  useEffect(() => {
    if (data?.pending?.length && (!selectedId || !data.pending.some((p: any) => p.id === selectedId))) {
      setSelectedId(data.pending[0].id);
    }
  }, [data, selectedId]);

  const selected = data?.pending?.find((p: any) => p.id === selectedId) || data?.pending?.[0];

  const doApprove = async (c: any) => {
    if (!c) return;
    setBusy(c.id);
    try {
      await api.post(`/approvals/${c.id}/approve`);
      toast(c.pendingPhoto ? 'Photo approved' : `${c.name || c.fields?.name}'s card approved`);
      setNote('');
      refresh();
    } catch (e) {
      toast((e as Error).message, 'err');
    } finally {
      setBusy(null);
    }
  };

  const doReject = async (c: any) => {
    if (!c) return;
    setBusy(c.id);
    try {
      await api.post(`/approvals/${c.id}/reject`, { note });
      toast('Sent back');
      setNote('');
      refresh();
    } catch (e) {
      toast((e as Error).message, 'err');
    } finally {
      setBusy(null);
    }
  };

  const approveAllWorkday = async () => {
    setBusy('bulk');
    try {
      const res: any = await api.post('/approvals/bulk-approve', { source: 'workday' });
      toast(`Approved ${res?.approved || 0} cards from Workday`);
      refresh();
    } catch (e) {
      toast((e as Error).message, 'err');
    } finally {
      setBusy(null);
    }
  };

  if (error) return <ErrorState error={error} retry={() => mutate()} />;
  if (!data) return <Loading />;

  const workdayCount = (data.pending || []).filter((p: any) => p.source === 'Workday').length;

  if (data.pending.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-1.5">
          <div className="text-[12px] font-medium uppercase tracking-[0.2em] text-[#876A33]">PEOPLE</div>
          <h1 className="m-0 font-display text-[46px] font-normal leading-[1.05] text-[#17171B]">Approvals</h1>
          <p className="m-0 text-[15px] text-[#5E5952]">No card changes waiting for approval.</p>
        </div>
        <Panel>
          <Empty icon="checkCircle" title="Nothing to approve" desc="New cards and photo changes that need review will appear here." />
        </Panel>
      </div>
    );
  }

  const nowFields = {
    ...selected.fields,
    ...selected.before?.fields,
    title: [selected.before?.fields?.title || selected.fields?.title, selected.before?.fields?.department || selected.fields?.department].filter(Boolean).join(' · '),
  };
  const afterFields = {
    ...selected.fields,
    ...selected.after?.fields,
    title: [selected.after?.fields?.title || selected.fields?.title, selected.after?.fields?.department || selected.fields?.department].filter(Boolean).join(' · '),
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div className="flex flex-col gap-1.5">
          <div className="text-[12px] font-medium uppercase tracking-[0.2em] text-[#876A33]">PEOPLE</div>
          <h1 className="m-0 font-display text-[46px] font-normal leading-[1.05] text-[#17171B]">Approvals</h1>
          <p className="m-0 text-[15px] text-[#5E5952]">
            {data.pending.length} card {data.pending.length === 1 ? 'change is' : 'changes are'} waiting for you. Nothing goes live until you approve it.
          </p>
        </div>
        {workdayCount > 0 && (
          <button
            type="button"
            disabled={busy === 'bulk'}
            onClick={approveAllWorkday}
            className="h-[44px] cursor-pointer rounded-lg border border-[#D9D2C4] bg-white px-[18px] text-[14px] text-[#17171B] transition-colors hover:bg-[#FAF8F5] disabled:opacity-50"
          >
            {busy === 'bulk' ? 'Approving...' : `Approve all ${workdayCount} from Workday`}
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-start gap-5">
        <section className="min-w-0 flex-[1_1_340px] overflow-hidden rounded-[14px] border border-[#E6E0D5] bg-white">
          {data.pending.map((a: any) => {
            const isSel = selected?.id === a.id;
            return (
              <div
                key={a.id}
                onClick={() => setSelectedId(a.id)}
                className={cx(
                  'flex cursor-pointer items-center gap-3 border-b border-[#F0EBE2] px-[18px] py-[14px] transition-colors last:border-b-0',
                  isSel ? 'bg-[#FBF6EC] shadow-[inset_3px_0_0_#B08D4F]' : 'bg-white hover:bg-[#FAF7F1]'
                )}
              >
                <span className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full bg-[#F2EEE6] font-display text-[15px] font-semibold text-[#876A33]">
                  {a.ini}
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate text-[14px] font-semibold text-[#17171B]">{a.name}</span>
                  <span className="truncate text-[12.5px] text-[#5E5952]">{a.what}</span>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-1">
                  <span className="rounded-full border border-[#E6E0D5] px-2 py-0.5 text-[11.5px] text-[#4E4A44]">
                    {a.source}
                  </span>
                  <span className="text-[11.5px] text-[#6E685F]">{a.when}</span>
                </span>
              </div>
            );
          })}
        </section>

        {selected && (
          <section className="min-w-0 flex-[2_1_560px] overflow-hidden rounded-[16px] border border-[#E6E0D5] bg-white">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#F0EBE2] px-6 py-[22px]">
              <div className="flex flex-col gap-0.5">
                <h2 className="m-0 text-[18px] font-semibold text-[#17171B]">
                  {selected.name} · {selected.headerWhat || selected.what}
                </h2>
                <span className="text-[13px] text-[#5E5952]">
                  From {selected.source} · {selected.when} · will also update {pronoun(selected.name)} wallet pass and email signature
                </span>
              </div>
              <span className="rounded-full bg-[#FBF0DC] px-2.5 py-[3px] text-[12px] font-medium text-[#8A5A12]">
                Waiting
              </span>
            </div>

            <div className="grid grid-cols-1 gap-5 bg-[#FAF8F3] p-6 sm:grid-cols-2">
              <div className="flex flex-col gap-2.5">
                <span className="text-[11px] font-medium tracking-[0.18em] text-[#6E685F]">NOW</span>
                <CardFace
                  layout={selected.layout || 'classic'}
                  theme={selected.theme || 'obsidian_gold'}
                  fields={nowFields}
                  translations={selected.translations}
                  brand={selected.brand}
                  width="100%"
                />
              </div>
              <div className="flex flex-col gap-2.5">
                <span className="text-[11px] font-semibold tracking-[0.18em] text-[#876A33]">AFTER APPROVAL</span>
                <CardFace
                  layout={selected.layout || 'classic'}
                  theme={selected.theme || 'obsidian_gold'}
                  fields={afterFields}
                  translations={selected.translations}
                  brand={selected.brand}
                  width="100%"
                />
              </div>
            </div>

            <div className="px-6 pb-1 pt-2">
              <div className="grid grid-cols-[1fr_1.4fr_1.4fr] gap-3 py-2.5 text-[11px] font-medium tracking-[0.14em] text-[#6E685F]">
                <span>FIELD</span>
                <span>BEFORE</span>
                <span>AFTER</span>
              </div>
              {selected.changes?.map((ch: any, idx: number) => (
                <div key={idx} className="grid grid-cols-[1fr_1.4fr_1.4fr] items-center gap-3 border-t border-[#F0EBE2] py-3 text-[14px]">
                  <span className="text-[#5E5952]">{ch.field}</span>
                  {ch.after === 'No change' ? (
                    <span className="text-[#17171B]">{ch.before}</span>
                  ) : (
                    <span className={ch.before && ch.before !== 'None' ? 'line-through text-[#8E887E]' : 'text-[#8E887E]'}>
                      {ch.before || 'None'}
                    </span>
                  )}
                  {ch.after === 'No change' ? (
                    <span className="text-[#6E685F]">No change</span>
                  ) : (
                    <span className="inline-block justify-self-start rounded-md bg-[#F6EFE1] px-2 py-0.5 font-medium text-[#17171B]">
                      {ch.after}
                    </span>
                  )}
                </div>
              ))}
            </div>

            <div className="flex flex-wrap gap-2.5 border-t border-[#F0EBE2] px-6 pb-[22px] pt-4">
              <input
                aria-label={`Note to ${selected.name}`}
                placeholder="Add a note (optional)"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="h-[46px] min-w-0 flex-[1_1_240px] rounded-lg border border-[#E0D9CC] px-3 font-sans text-[14px] text-[#17171B] outline-none focus:border-[#C9A96E]"
              />
              <button
                type="button"
                disabled={busy === selected.id}
                onClick={() => doReject(selected)}
                className="h-[46px] cursor-pointer rounded-lg border border-[#E9B9C0] bg-white px-[18px] text-[14px] text-[#A3283A] transition-colors hover:bg-red-50 disabled:opacity-50"
              >
                Reject
              </button>
              <button
                type="button"
                disabled={busy === selected.id}
                onClick={() => doApprove(selected)}
                className="h-[46px] cursor-pointer rounded-lg border-none bg-[#17171B] px-[22px] text-[14px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {busy === selected.id ? 'Publishing...' : 'Approve and publish'}
              </button>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
