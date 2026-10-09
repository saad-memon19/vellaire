'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { Icon } from '@/components/icons';
import { useToast } from '@/components/toast';
import {
  Avatar,
  Button,
  cx,
  Empty,
  ErrorState,
  Field,
  Input,
  LinkButton,
  Loading,
  Modal,
  PageHeader,
  Pagination,
  Panel,
  Select,
  Spinner,
  Table,
  Tabs,
  Td,
  Textarea,
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
  const [tab, setTab] = useState(params.get('tab') || 'all');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<string | null>(params.get('open'));
  const [crmModal, setCrmModal] = useState(false);
  const { data, error, mutate } = useApi<any>(`/leads${qs({ tab, q, page })}`);
  const { data: me } = useMe();

  useEffect(() => {
    if (!open && data?.rows?.[0] && typeof window !== 'undefined' && window.innerWidth >= 1280) setOpen(data.rows[0].id);
  }, [data, open]);

  return (
    <div>
      <PageHeader
        eyebrow="Insights"
        title="Leads"
        desc={
          data ? `People who shared their details back from a card. ${data.month.toLocaleString()} this month, ${data.tabs[1].count.toLocaleString()} without a follow-up.` : ' '
        }
        actions={
          <>
            <LinkButton href="/api/leads/export" icon="download">
              Export CSV
            </LinkButton>
            {isAdmin(me?.user.role) && (
              <Button variant="ink" icon="link" onClick={() => setCrmModal(true)}>
                {data?.crm ? `CRM · ${data.crm[0].toUpperCase()}${data.crm.slice(1)}` : 'Connect a CRM'}
              </Button>
            )}
          </>
        }
      />
      {data && (
        <Tabs
          items={data.tabs}
          value={tab}
          onChange={(v) => {
            setTab(v);
            setPage(1);
          }}
          className="mb-5"
        />
      )}
      <div className="grid gap-6 xl:grid-cols-[1fr_440px]">
        <Panel pad={false} className="min-w-0">
          <div className="border-b border-line p-4">
            <div className="relative">
              <Icon name="search" size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-2" />
              <Input
                aria-label="Search leads"
                placeholder="Search name, company or who met them"
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setPage(1);
                }}
                className="pl-10"
              />
            </div>
          </div>
          {error ? (
            <ErrorState error={error} retry={() => mutate()} />
          ) : !data ? (
            <Loading />
          ) : data.rows.length === 0 ? (
            <Empty icon="leads" title="No leads here" desc="When someone taps “Share your details” on a card, they appear here." />
          ) : (
            <>
              <Table head={['Lead', 'Met', 'Via', 'When', 'CRM']}>
                {data.rows.map((l: any) => (
                  <tr
                    key={l.id}
                    onClick={() => setOpen(l.id)}
                    className={cx('cursor-pointer', open === l.id ? 'bg-[#FBF6EC] shadow-[inset_3px_0_0_#B08D4F]' : 'hover:bg-[#FAF7F1]')}
                  >
                    <Td>
                      <button type="button" className="flex items-center gap-3 text-left" onClick={() => setOpen(l.id)}>
                        <Avatar name={l.name} size={32} />
                        <span>
                          <span className="block font-semibold">{l.name}</span>
                          <span className="block text-[12.5px] text-stone-2">{l.co}</span>
                        </span>
                      </button>
                    </Td>
                    <Td className="whitespace-nowrap text-[#4E4A44]">{l.owner}</Td>
                    <Td>
                      <span className="inline-block whitespace-nowrap rounded-full border border-[#E0D9CC] px-2.5 py-0.5 text-[12px] text-[#4E4A44]">{l.via}</span>
                    </Td>
                    <Td className="whitespace-nowrap text-stone">{l.when}</Td>
                    <Td className={cx('whitespace-nowrap text-[12.5px]', l.status === 'in_crm' ? 'text-ok' : 'text-gold-text')}>
                      {l.status === 'in_crm' ? 'In CRM' : 'Not synced'}
                    </Td>
                  </tr>
                ))}
              </Table>
              <Pagination page={data.page} limit={data.limit} total={data.total} onPage={setPage} />
            </>
          )}
        </Panel>
        {open && <LeadDetail id={open} ai={!!data?.aiEnabled} crm={data?.crm} onClose={() => setOpen(null)} onChange={() => mutate()} />}
      </div>
      <CrmModal open={crmModal} onClose={() => setCrmModal(false)} onSaved={() => mutate()} />
    </div>
  );
}

function LeadDetail({ id, ai, crm, onClose, onChange }: { id: string; ai: boolean; crm: string | null; onClose: () => void; onChange: () => void }) {
  const { data, mutate } = useApi<any>(`/leads/${id}`);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const toast = useToast();

  useEffect(() => setText(data?.draft || ''), [data]);

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

  if (!data)
    return (
      <Panel>
        <Loading />
      </Panel>
    );
  return (
    <Panel pad={false} className="overflow-hidden xl:sticky xl:top-24 xl:self-start">
      <div className="p-6">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3.5">
            <Avatar name={data.name} size={52} />
            <div>
              <div className="font-display text-[28px] leading-tight">{data.name}</div>
              <div className="text-[13px] text-stone">{[data.jobTitle, data.company].filter(Boolean).join(' · ')}</div>
            </div>
          </div>
          <button type="button" aria-label="Close" onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-md text-stone hover:bg-sand xl:hidden">
            <Icon name="x" />
          </button>
        </div>
        <dl className="flex flex-col gap-2 text-[14px]">
          {[
            [
              'Email',
              data.email ? (
                <a href={`mailto:${data.email}`} className="text-gold-text">
                  {data.email}
                </a>
              ) : (
                '—'
              ),
            ],
            ['Phone', data.phone ? <a href={`tel:${data.phone}`}>{data.phone}</a> : '—'],
            ['Met', data.met],
            ['Consent', data.consent ? 'Agreed to be contacted' : 'No consent'],
          ].map(([k, v]) => (
            <div key={k as string} className="grid grid-cols-[80px_1fr] gap-3 text-[13.5px]">
              <dt className="text-stone">{k}</dt>
              <dd className={cx('min-w-0 wrap-break-word', k === 'Consent' && data.consent && 'text-ok')}>{v}</dd>
            </div>
          ))}
        </dl>
        {data.note && (
          <div className="mt-5 rounded-[10px] bg-pearl p-3.5">
            <div className="mb-1.5 text-[11px] font-medium tracking-[0.16em] text-stone-2">THEIR NOTE</div>
            <p className="text-[13.5px] leading-relaxed text-ink-2">{data.note}</p>
          </div>
        )}
      </div>
      <div className="flex flex-col gap-3 border-t border-[#F0EBE2] p-6" style={{ background: 'linear-gradient(180deg, #FBF6EC, #FFFFFF 70%)' }}>
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.18em] text-gold-text">
            <Icon name={ai ? 'sparkle' : 'edit'} size={14} /> {ai ? 'AI FOLLOW-UP DRAFT' : 'FOLLOW-UP DRAFT'}
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
            className="flex items-center gap-1.5 text-[12.5px] text-gold-text hover:text-ink disabled:opacity-60"
          >
            {busy === 'draft' && <Spinner size={13} />}
            {text ? 'Rewrite' : 'Write draft'}
          </button>
        </div>
        <Textarea
          aria-label="Follow-up email"
          rows={8}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Write a short follow-up…"
          className="bg-white leading-relaxed"
        />
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="ink"
            icon="send"
            disabled={!text || !data.email || !data.consent}
            loading={busy === 'send'}
            onClick={() => run('send', () => api.post(`/leads/${id}/send`, { text }), 'Follow-up sent')}
          >
            Send as {data.ownerName?.split(' ')[0] || 'owner'}
          </Button>
          <Button
            icon="external"
            disabled={!crm || data.status === 'in_crm'}
            loading={busy === 'crm'}
            onClick={() => run('crm', () => api.post(`/leads/${id}/crm`), 'Pushed to CRM')}
            title={crm ? undefined : 'Connect a CRM first'}
          >
            {data.status === 'in_crm' ? `In ${data.crm?.provider || 'CRM'}` : `Push to ${crm ? crm[0].toUpperCase() + crm.slice(1) : 'CRM'}`}
          </Button>
        </div>
        {data.status === 'new' && (
          <button
            type="button"
            onClick={() => run('done', () => api.patch(`/leads/${id}`, { status: 'followed_up' }), 'Marked as followed up')}
            className="self-start text-[12.5px] text-stone hover:text-ink"
          >
            Already followed up? Mark it done
          </button>
        )}
      </div>
    </Panel>
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
