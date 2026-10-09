'use client';

import Link from 'next/link';
import { use, useState } from 'react';
import { Icon } from '@/components/icons';
import { useToast } from '@/components/toast';
import {
  Avatar,
  Badge,
  Button,
  copyText,
  cx,
  ErrorState,
  Field,
  Input,
  Loading,
  Modal,
  Panel,
  PanelHeader,
  Select,
  Stat,
  StatusBadge,
  Table,
  Tabs,
  Td,
  Textarea,
} from '@/components/ui';
import { api, useApi } from '@/lib/api';

type Tab = 'overview' | 'users' | 'billing' | 'tickets';

export default function CompanyDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data, error, mutate } = useApi<any>(`/console/companies/${id}`);
  const [tab, setTab] = useState<Tab>('overview');
  const [planOpen, setPlanOpen] = useState(false);
  const [note, setNote] = useState('');
  const [email, setEmail] = useState<{ draft: string; to?: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const toast = useToast();

  if (error) return <ErrorState error={error} retry={() => mutate()} />;
  if (!data) return <Loading />;

  const viewAs = async () => {
    setBusy('view');
    const r = await api.post<{ redirect: string }>(`/auth/impersonate/${id}`);
    window.location.href = r.redirect;
  };
  const addNote = async () => {
    setBusy('note');
    await api.post(`/console/companies/${id}/notes`, { body: note });
    setNote('');
    setBusy(null);
    mutate();
  };
  const draftEmail = async () => {
    setBusy('email');
    try {
      setEmail(await api.post(`/console/companies/${id}/upgrade-email`));
    } catch (e) {
      toast((e as Error).message, 'err');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div>
      <nav aria-label="Breadcrumb" className="mb-4 flex items-center gap-2 text-[13px] text-stone">
        <Link href="/console/companies" className="hover:text-ink">
          Companies
        </Link>
        <span>/</span>
        <span className="text-ink">{data.name}</span>
      </nav>
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <span className="flex h-14 w-14 items-center justify-center rounded-xl bg-ink font-display text-[26px] text-gold-soft">{data.ini[0]}</span>
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-display text-[36px] leading-none">{data.name}</h1>
              <StatusBadge status={data.status} />
              <Badge tone="gold">{data.plan}</Badge>
            </div>
            <p className="mt-1.5 text-[14px] text-stone">{data.sub}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setPlanOpen(true)}>Change plan</Button>
          <Button variant="ink" icon="eye" loading={busy === 'view'} onClick={viewAs}>
            View as customer
          </Button>
        </div>
      </header>

      <Tabs
        items={[
          { id: 'overview', name: 'Overview' },
          { id: 'users', name: 'Users', count: data.users.length },
          { id: 'billing', name: 'Billing', count: data.invoices.length },
          { id: 'tickets', name: 'Tickets', count: data.tickets.length },
        ]}
        value={tab}
        onChange={setTab}
        className="mb-6"
      />

      {tab === 'overview' && (
        <div className="flex flex-col gap-6">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {data.stats.map((s: any) => (
              <Stat key={s.label} label={s.label} value={s.value} note={s.note} />
            ))}
          </div>
          <div className="grid gap-6 xl:grid-cols-[1fr_1fr_380px]">
            <Panel>
              <PanelHeader title="Health score" />
              <div className={cx('font-display text-[56px] leading-none', data.health.score >= 75 ? 'text-ok' : data.health.score >= 55 ? 'text-warn' : 'text-err')}>
                {data.health.score}
              </div>
              <ul className="mt-5 flex flex-col gap-3">
                {data.health.parts.map((p: any) => (
                  <li key={p.name}>
                    <div className="mb-1 flex justify-between text-[13px]">
                      <span>{p.name}</span>
                      <span className="tabular-nums text-stone">{p.v}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-linen">
                      <div className="h-1.5 rounded-full bg-ink" style={{ width: `${p.v}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            </Panel>
            <Panel>
              <PanelHeader title="Recent activity" />
              <ul className="flex flex-col gap-3">
                {data.activity.map((a: any, i: number) => (
                  <li key={i} className="text-[14px]">
                    <span className={a.platform ? 'text-gold-text' : ''}>{a.t}</span>
                    <div className="text-[12px] text-stone-2">{a.when}</div>
                  </li>
                ))}
              </ul>
            </Panel>
            <div className="flex flex-col gap-6">
              <Panel>
                <PanelHeader title="Account" />
                <dl className="flex flex-col gap-2 text-[14px]">
                  {data.account.map((r: any) => (
                    <div key={r.k} className="grid grid-cols-[96px_1fr] gap-3 border-b border-linen pb-2">
                      <dt className="text-stone-2">{r.k}</dt>
                      <dd className="min-w-0 break-words">{r.v}</dd>
                    </div>
                  ))}
                </dl>
              </Panel>
              {data.opportunity && (
                <Panel className="bg-gold-tint">
                  <div className="eyebrow mb-2 !text-gold-text">Opportunity</div>
                  <p className="text-[14px]">{data.opportunity}</p>
                  <Button size="sm" variant="ink" className="mt-3" icon="mail" loading={busy === 'email'} onClick={draftEmail}>
                    Draft seat upgrade email
                  </Button>
                </Panel>
              )}
              <Panel>
                <PanelHeader title="Internal notes" />
                <ul className="mb-3 flex flex-col gap-3">
                  {data.notes.map((n: any) => (
                    <li key={n.id} className="text-[14px]">
                      {n.body}
                      <div className="text-[12px] text-stone-2">
                        — {n.author}, {n.when}
                      </div>
                    </li>
                  ))}
                </ul>
                <Textarea aria-label="Add a note" rows={2} placeholder="Add a note for the team" value={note} onChange={(e) => setNote(e.target.value)} />
                <Button size="sm" className="mt-2" disabled={!note} loading={busy === 'note'} onClick={addNote}>
                  Add note
                </Button>
              </Panel>
            </div>
          </div>
        </div>
      )}

      {tab === 'users' && (
        <Panel pad={false}>
          <Table head={['Person', 'Role', 'Last sign-in']}>
            {data.users.map((u: any) => (
              <tr key={u.id}>
                <Td>
                  <div className="flex items-center gap-3">
                    <Avatar name={u.name} size={32} />
                    <span>
                      <span className="block font-medium">{u.name}</span>
                      <span className="block text-[13px] text-stone-2">{u.email}</span>
                    </span>
                  </div>
                </Td>
                <Td className="capitalize">{u.role.replace('_', ' ')}</Td>
                <Td className="text-stone">{u.lastLogin}</Td>
              </tr>
            ))}
          </Table>
        </Panel>
      )}

      {tab === 'billing' && (
        <Panel pad={false}>
          <Table head={['Invoice', 'Period', 'Amount', 'Status', '']}>
            {data.invoices.map((i: any) => (
              <tr key={i.id}>
                <Td className="font-mono text-[13px]">{i.number}</Td>
                <Td>{i.period}</Td>
                <Td className="tabular-nums">{i.amount}</Td>
                <Td>
                  <StatusBadge status={i.status} />
                </Td>
                <Td className="text-right">
                  <Select
                    aria-label="Set invoice status"
                    value={i.status}
                    onChange={async (e) => {
                      await api.patch(`/console/invoices/${i.id}`, { status: e.target.value });
                      mutate();
                    }}
                    className="ml-auto w-32"
                  >
                    <option value="paid">Paid</option>
                    <option value="open">Open</option>
                    <option value="failed">Failed</option>
                  </Select>
                </Td>
              </tr>
            ))}
          </Table>
        </Panel>
      )}

      {tab === 'tickets' && (
        <Panel pad={false}>
          {data.tickets.length === 0 ? (
            <p className="p-6 text-[14px] text-stone-2">No tickets</p>
          ) : (
            <ul className="divide-y divide-linen">
              {data.tickets.map((t: any) => (
                <li key={t.id}>
                  <Link href={`/console/support?open=${t.id}`} className="flex items-center justify-between gap-3 px-5 py-4 hover:bg-pearl">
                    <span className="text-[14px] font-medium">{t.subject}</span>
                    <span className="flex items-center gap-3 text-[13px] text-stone-2">
                      {t.when} <StatusBadge status={t.status} />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      )}

      <PlanModal open={planOpen} data={data} onClose={() => setPlanOpen(false)} onSaved={() => mutate()} />
      <Modal
        open={!!email}
        onClose={() => setEmail(null)}
        title="Seat upgrade email"
        footer={
          <>
            {email?.to && (
              <a
                href={`mailto:${email.to}?subject=${encodeURIComponent('Your Vellaire seats')}&body=${encodeURIComponent(email.draft)}`}
                className="inline-flex h-11 items-center gap-2 rounded-md border border-line-strong px-4 text-[14px] font-medium"
              >
                <Icon name="mail" size={17} /> Open in mail
              </a>
            )}
            <Button variant="ink" icon="copy" onClick={() => copyText(email!.draft)?.then(() => toast('Copied'))}>
              Copy
            </Button>
          </>
        }
      >
        {email && (
          <>
            {email.to && <p className="mb-2 text-[13px] text-stone-2">To {email.to}</p>}
            <Textarea aria-label="Email" rows={10} value={email.draft} onChange={(e) => setEmail({ ...email, draft: e.target.value })} />
          </>
        )}
      </Modal>
    </div>
  );
}

function PlanModal({ open, data, onClose, onSaved }: { open: boolean; data: any; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ plan: data.planId, seats: data.seatsTotal, status: data.statusId });
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const save = async () => {
    setBusy(true);
    try {
      await api.patch(`/console/companies/${data.id}`, f);
      toast('Account updated');
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
      title="Change plan"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="ink" loading={busy} onClick={save}>
            Save
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Plan">
          {(id) => (
            <Select id={id} value={f.plan} onChange={(e) => setF({ ...f, plan: e.target.value })}>
              <option value="starter">Starter</option>
              <option value="professional">Professional</option>
              <option value="enterprise">Enterprise</option>
            </Select>
          )}
        </Field>
        <Field label="Seats">{(id) => <Input id={id} type="number" min={1} value={f.seats} onChange={(e) => setF({ ...f, seats: Number(e.target.value) })} />}</Field>
        <Field label="Status">
          {(id) => (
            <Select id={id} value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>
              <option value="trial">Trial</option>
              <option value="active">Active</option>
              <option value="past_due">Past due</option>
              <option value="suspended">Suspended</option>
              <option value="churned">Churned</option>
            </Select>
          )}
        </Field>
      </div>
      <p className="mt-4 text-[13px] text-stone-2">Suspended and churned companies’ public cards stop loading. Changes are logged on the account.</p>
    </Modal>
  );
}
