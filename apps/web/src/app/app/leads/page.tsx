'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { useToast } from '@/components/toast';
import {
  Button,
  cx,
  Empty,
  ErrorState,
  Field,
  Input,
  Loading,
  Modal,
  Pagination,
  Select,
} from '@/components/ui';
import { api, isAdmin, qs, useApi, useMe } from '@/lib/api';

export default function Page() {
  return (
    <Suspense fallback={<Loading />}>
      <Leads />
    </Suspense>
  );
}

function Leads() {
  const params = useSearchParams();
  const [tab, setTab] = useState(params.get('tab') || 'needs_follow_up');
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<string | null>(params.get('open'));
  const [crmModal, setCrmModal] = useState(false);
  const { data, error, mutate } = useApi<any>(`/leads${qs({ tab, page })}`);
  const { data: me } = useMe();

  useEffect(() => {
    if (!open && data?.rows?.[0] && typeof window !== 'undefined' && window.innerWidth >= 1024) {
      setOpen(data.rows[0].id);
    }
  }, [data, open]);

  const tabsList = data?.tabs || [
    { id: 'all', name: 'All', count: 312 },
    { id: 'needs_follow_up', name: 'Needs follow-up', count: 12 },
    { id: 'in_crm', name: 'In CRM', count: 281 },
    { id: 'paper_scans', name: 'Scanned paper cards', count: 19 },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* Top Header */}
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div className="flex flex-col gap-1.5">
          <div className="text-[12px] font-medium tracking-[0.2em] text-[#876A33]">INSIGHTS</div>
          <h1 className="m-0 font-display text-[46px] font-normal leading-[1.05] text-[#17171B]">Leads</h1>
          <p className="m-0 text-[15px] text-[#5E5952]">
            {data ? (
              `People who shared their details back from a card. ${data.month?.toLocaleString() || 312} this month, ${data.tabs?.[1]?.count || 12} without a follow-up.`
            ) : (
              'People who shared their details back from a card. 312 this month, 12 without a follow-up.'
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <a
            href="/api/leads/export"
            download
            className="flex h-11 items-center rounded-lg border border-[#D9D2C4] bg-white px-4 text-[14px] text-[#17171B] transition-colors hover:bg-[#FAF7F1]"
          >
            Export CSV
          </a>
          {isAdmin(me?.user.role) && (
            <button
              type="button"
              onClick={() => setCrmModal(true)}
              className="flex h-11 items-center rounded-lg bg-[#17171B] px-4.5 text-[14px] font-semibold text-white transition-colors hover:bg-[#2E2E35]"
            >
              Connect a CRM
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div role="tablist" aria-label="Lead status" className="flex flex-wrap gap-7 border-b border-[#E6E0D5]">
        {tabsList.map((t: any) => {
          const isSelected = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={isSelected}
              onClick={() => {
                setTab(t.id);
                setPage(1);
              }}
              className={cx(
                '-mb-px flex items-center gap-2 border-b-2 py-3 text-[14px] transition-colors',
                isSelected
                  ? 'border-[#B08D4F] font-semibold text-[#17171B]'
                  : 'border-transparent text-[#6E685F] hover:text-[#17171B]'
              )}
            >
              {t.name}
              {t.count !== undefined && (
                <span
                  className={cx(
                    'rounded-full px-2 py-px text-[12px]',
                    isSelected ? 'bg-[#F6EFE1] font-semibold text-[#876A33]' : 'bg-[#EFEBE3] text-[#4E4A44]'
                  )}
                >
                  {t.count.toLocaleString()}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Content Layout */}
      <div className="flex flex-wrap items-start gap-5">
        {/* Left: Table Container */}
        <section className="min-w-0 flex-[3_1_560px] overflow-hidden rounded-[14px] border border-[#E6E0D5] bg-white">
          {error ? (
            <ErrorState error={error} retry={() => mutate()} />
          ) : !data ? (
            <Loading />
          ) : data.rows.length === 0 ? (
            <Empty icon="leads" title="No leads here" desc="When someone taps “Share your details” on a card, they appear here." />
          ) : (
            <>
              <div className="overflow-x-auto">
                <div className="min-w-[640px]">
                  {/* Table Header */}
                  <div className="grid grid-cols-[2.2fr_1.4fr_1fr_0.9fr_1fr] gap-3.5 bg-[#FAF8F3] px-5 py-2.5 text-[11px] font-medium tracking-[0.14em] text-[#6E685F]">
                    <span>LEAD</span>
                    <span>MET</span>
                    <span>VIA</span>
                    <span>WHEN</span>
                    <span>CRM</span>
                  </div>

                  {/* Table Rows */}
                  {data.rows.map((l: any) => {
                    const isSelected = open === l.id;
                    const ini = (l.name || '?')
                      .split(/\s+/)
                      .filter(Boolean)
                      .slice(0, 2)
                      .map((p: string) => p[0]!.toUpperCase())
                      .join('');

                    const inCrm = l.status === 'in_crm';

                    return (
                      <div
                        key={l.id}
                        onClick={() => setOpen(l.id)}
                        className={cx(
                          'grid cursor-pointer grid-cols-[2.2fr_1.4fr_1fr_0.9fr_1fr] items-center gap-3.5 border-t border-[#F0EBE2] px-5 py-3 transition-colors',
                          isSelected
                            ? 'bg-[#FBF6EC] shadow-[inset_3px_0_0_#B08D4F]'
                            : 'bg-white hover:bg-[#FAF7F1]'
                        )}
                      >
                        <span className="flex min-w-0 items-center gap-3">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#F2EEE6] font-display text-[13px] font-semibold text-[#876A33]">
                            {ini}
                          </span>
                          <span className="flex min-w-0 flex-col">
                            <span className="truncate text-[14px] font-semibold text-[#17171B]">{l.name}</span>
                            <span className="truncate text-[12.5px] text-[#6E685F]">{l.co}</span>
                          </span>
                        </span>
                        <span className="text-[13.5px] text-[#2A2A30]">{l.owner}</span>
                        <span>
                          <span className="inline-block rounded-full border border-[#E6E0D5] bg-white px-2.5 py-0.5 text-[12px] text-[#4E4A44]">
                            {l.via}
                          </span>
                        </span>
                        <span className="text-[13px] text-[#6E685F]">{l.when}</span>
                        <span
                          className="text-[12.5px] font-medium"
                          style={{ color: inCrm ? '#1F7A55' : '#8A5A12' }}
                        >
                          {inCrm ? 'In CRM' : 'Not synced'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
              <Pagination page={data.page} limit={data.limit} total={data.total} onPage={setPage} />
            </>
          )}
        </section>

        {/* Right: Lead Detail Card */}
        {open && (
          <aside
            aria-label="Lead detail"
            className="min-w-0 flex-[2_1_360px] overflow-hidden rounded-[16px] border border-[#E6E0D5] bg-white"
          >
            <LeadDetail
              id={open}
              ai={!!data?.aiEnabled}
              crm={data?.crm}
              onClose={() => setOpen(null)}
              onChange={() => mutate()}
            />
          </aside>
        )}
      </div>

      <CrmModal open={crmModal} onClose={() => setCrmModal(false)} onSaved={() => mutate()} />
    </div>
  );
}

function LeadDetail({
  id,
  ai,
  crm,
  onClose,
  onChange,
}: {
  id: string;
  ai: boolean;
  crm: string | null;
  onClose: () => void;
  onChange: () => void;
}) {
  const { data, mutate } = useApi<any>(`/leads/${id}`);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const toast = useToast();

  useEffect(() => {
    if (data?.draft) {
      setText(data.draft);
    } else if (data) {
      const ownerName = data.ownerName?.split(' ')[0] || 'Sara';
      const leadName = data.name?.split(' ')[0] || 'Faisal';
      setText(
        `Dear ${leadName},\n\nIt was a pleasure meeting you. I would be glad to follow up regarding our conversation and explore how we can support your initiatives.\n\nWould a call early next week suit you?\n\nWarm regards,\n${ownerName}`
      );
    }
  }, [data]);

  const run = async (key: string, fn: () => Promise<any>, ok?: string) => {
    setBusy(key);
    try {
      const r = await fn();
      if (ok) toast(ok);
      mutate();
      onChange();
      return r;
    } catch (e) {
      toast((e as Error).message, 'err');
    } finally {
      setBusy(null);
    }
  };

  if (!data) {
    return (
      <div className="p-8">
        <Loading />
      </div>
    );
  }

  const ini = (data.name || '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p: string) => p[0]!.toUpperCase())
    .join('');

  const ownerFirst = data.ownerName?.split(' ')[0] || 'Sara';

  return (
    <div>
      {/* Detail Header & Info */}
      <div className="flex flex-col gap-4 border-b border-[#F0EBE2] p-6">
        <div className="flex items-center gap-3.5">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#F2EEE6] font-display text-[22px] font-semibold text-[#876A33]">
            {ini}
          </span>
          <div className="flex flex-col">
            <h2 className="m-0 font-display text-[28px] font-normal leading-[1.05] text-[#17171B]">
              {data.name}
            </h2>
            <span className="text-[13.5px] text-[#5E5952]">
              {[data.jobTitle, data.company].filter(Boolean).join(' · ') || 'Principal · Family office, Abu Dhabi'}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-[90px_1fr] gap-x-3 gap-y-2 text-[13.5px]">
          <span className="text-[#6E685F]">Email</span>
          <span className="truncate text-[#17171B]">{data.email || '—'}</span>

          <span className="text-[#6E685F]">Phone</span>
          <span className="text-[#17171B]">{data.phone || '—'}</span>

          <span className="text-[#6E685F]">Met</span>
          <span className="text-[#17171B]">{data.met || `${data.ownerName || 'Sara Khan'} · NFC tap · today, 18:40`}</span>

          <span className="text-[#6E685F]">Consent</span>
          <span style={{ color: data.consent ? '#1F7A55' : '#8E887E' }}>
            {data.consent ? 'Agreed to be contacted' : 'No consent'}
          </span>
        </div>

        {data.note && (
          <div className="rounded-[10px] bg-[#F7F5F0] p-[12px_14px] text-[13.5px] leading-[1.55] text-[#2A2A30]">
            <span className="mb-1 block text-[11px] font-medium tracking-[0.16em] text-[#6E685F]">
              THEIR NOTE
            </span>
            {data.note}
          </div>
        )}
      </div>

      {/* AI Follow-Up Draft */}
      <div
        className="flex flex-col gap-3 p-6"
        style={{ background: 'linear-gradient(180deg, #FBF6EC, #FFFFFF 60%)' }}
      >
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.2em] text-[#876A33]">
            <svg
              className="h-[18px] w-[18px]"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" />
            </svg>
            AI FOLLOW-UP DRAFT
          </span>
          <button
            type="button"
            disabled={busy === 'draft'}
            onClick={() =>
              run('draft', async () => {
                const r = await api.post(`/leads/${id}/draft`, {});
                setText(r.draft);
              })
            }
            className="text-[13px] font-medium text-[#876A33] hover:underline disabled:opacity-60"
          >
            Rewrite
          </button>
        </div>

        <textarea
          aria-label="Follow-up email draft"
          rows={7}
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="resize-y rounded-[10px] border border-[#E0D9CC] bg-white p-3.5 text-[13.5px] leading-[1.6] text-[#17171B] outline-none"
        />

        <div className="flex flex-wrap gap-2.5">
          <button
            type="button"
            disabled={!text || !data.email || !data.consent || busy === 'send'}
            onClick={() => run('send', () => api.post(`/leads/${id}/send`, { text }), 'Follow-up sent')}
            className="flex h-[46px] min-w-[140px] flex-1 items-center justify-center rounded-lg bg-[#17171B] text-[14px] font-semibold text-white transition-colors hover:bg-[#2E2E35] disabled:opacity-50"
          >
            Send as {ownerFirst}
          </button>
          <button
            type="button"
            disabled={!crm || data.status === 'in_crm' || busy === 'crm'}
            onClick={() => run('crm', () => api.post(`/leads/${id}/crm`), 'Pushed to CRM')}
            className="flex h-[46px] min-w-[140px] flex-1 items-center justify-center rounded-lg border border-[#D9D2C4] bg-white text-[14px] text-[#17171B] transition-colors hover:bg-[#FAF7F1] disabled:opacity-50"
          >
            Push to {crm ? crm[0].toUpperCase() + crm.slice(1) : 'Salesforce'}
          </button>
        </div>

        {data.status === 'new' && (
          <button
            type="button"
            onClick={() => run('done', () => api.patch(`/leads/${id}`, { status: 'followed_up' }), 'Marked as followed up')}
            className="self-start text-[12.5px] text-[#8E887E] hover:text-[#17171B]"
          >
            Already followed up? Mark it done
          </button>
        )}
      </div>
    </div>
  );
}

function CrmModal({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const { data } = useApi<any>(open ? '/settings' : null);
  const [f, setF] = useState({ provider: '', token: '', webhookUrl: '' });
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  useEffect(() => {
    if (data)
      setF({
        provider: data.settings.crm.provider || '',
        token: '',
        webhookUrl: data.settings.crm.webhookUrl || '',
      });
  }, [data]);

  const save = async () => {
    setBusy(true);
    try {
      await api.patch('/settings/crm', {
        provider: f.provider,
        token: f.token || undefined,
        webhookUrl: f.webhookUrl,
      });
      toast(f.provider ? 'CRM connected' : 'CRM disconnected');
      onSaved();
      onClose();
    } catch (e) {
      toast((e as Error).message, 'err');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Connect a CRM"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="ink" loading={busy} onClick={save}>
            Save
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="CRM">
          {(id) => (
            <Select id={id} value={f.provider} onChange={(e) => setF({ ...f, provider: e.target.value })}>
              <option value="">None</option>
              <option value="hubspot">HubSpot</option>
              <option value="salesforce">Salesforce (via Flow webhook)</option>
              <option value="webhook">Other (webhook: Zapier, Make, Pipedrive)</option>
            </Select>
          )}
        </Field>
        {f.provider === 'hubspot' && (
          <Field
            label="Private app token"
            hint={data?.settings.crm.hasToken ? 'A token is saved. Leave empty to keep it.' : 'HubSpot → Settings → Integrations → Private apps, with CRM contacts write access.'}
          >
            {(id) => <Input id={id} type="password" value={f.token} onChange={(e) => setF({ ...f, token: e.target.value })} />}
          </Field>
        )}
        {(f.provider === 'salesforce' || f.provider === 'webhook') && (
          <Field label="Webhook URL" hint="Each lead is sent as JSON when you press Push to CRM.">
            {(id) => <Input id={id} type="url" placeholder="https://" value={f.webhookUrl} onChange={(e) => setF({ ...f, webhookUrl: e.target.value })} />}
          </Field>
        )}
      </div>
    </Modal>
  );
}
