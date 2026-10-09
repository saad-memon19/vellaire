'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { Icon } from '@/components/icons';
import { useToast } from '@/components/toast';
import {
  Avatar,
  Button,
  Checkbox,
  cx,
  Empty,
  ErrorState,
  Field,
  FilterChip,
  Input,
  LinkButton,
  Loading,
  Modal,
  PageHeader,
  Pagination,
  Panel,
  StatusBadge,
  Table,
  Td,
  Toggle,
} from '@/components/ui';
import { api, isAdmin, isManager, qs, useApi, useMe } from '@/lib/api';
import { MATERIALS } from '@/lib/catalog';

export default function Page() {
  return (
    <Suspense fallback={<Loading />}>
      <Employees />
    </Suspense>
  );
}

function Employees() {
  const params = useSearchParams();
  const [filter, setFilter] = useState(params.get('filter') || 'all');
  const [q, setQ] = useState(params.get('q') || '');
  const [department, setDepartment] = useState(params.get('department') || '');
  const [office, setOffice] = useState('');
  const [cardStatus, setCardStatus] = useState('');
  const [source, setSource] = useState('');
  const [page, setPage] = useState(1);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [modal, setModal] = useState<null | 'import' | 'add' | 'nfc' | 'template'>(params.get('import') ? 'import' : null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const { data: me } = useMe();
  const manager = isManager(me?.user.role);
  const { data, error, mutate } = useApi<any>(`/employees${qs({ filter: filter === 'all' ? '' : filter, q, department, office, cardStatus, source, page })}`);

  useEffect(() => setSel(new Set()), [filter, q, department, office, cardStatus, source, page]);

  const reset = (fn: () => void) => {
    fn();
    setPage(1);
  };
  const toggle = (id: string) =>
    setSel((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  const bulk = async (action: string, extra: any = {}) => {
    setBusy(true);
    try {
      const r = await api.post('/employees/bulk', {
        ids: [...sel],
        action,
        ...extra,
      });
      toast(r.message);
      setSel(new Set());
      setModal(null);
      mutate();
    } catch (e) {
      toast((e as Error).message, 'err');
    } finally {
      setBusy(false);
    }
  };

  const syncNow = async () => {
    if (!data?.sync) return;
    setBusy(true);
    try {
      const r = await api.post(`/integrations/${data.sync.provider}/sync`, {});
      toast(
        r.status === 'paused' ? 'Sync paused by sync guard. Review it in HR integrations.' : `Sync done: ${r.created} created, ${r.updated} updated, ${r.deactivated} switched off`,
        r.status === 'paused' ? 'info' : 'ok',
      );
      mutate();
    } catch (e) {
      toast((e as Error).message, 'err');
    } finally {
      setBusy(false);
    }
  };

  const leave = async (r: any) => {
    if (!confirm(`Mark ${r.name} as a leaver? Their card turns off, wallet passes are voided and NFC is disabled. Leads stay with the company.`)) return;
    try {
      await api.post(`/employees/${r.id}/leave`);
      toast(`${r.name} marked as leaver`);
      mutate();
    } catch (e) {
      toast((e as Error).message, 'err');
    }
  };

  const allOnPage = data?.rows.length > 0 && data.rows.every((r: any) => sel.has(r.id));
  const providerName: Record<string, string> = {
    workday: 'Workday',
    sap: 'SAP SuccessFactors',
    bamboohr: 'BambooHR',
    entra: 'Entra ID',
  };
  const asOptions = (list: string[] = []) => list.map((x) => ({ id: x, name: x }));
  const bulkBtn = 'h-8 rounded-md px-2.5 text-[13px] hover:bg-white/10 disabled:opacity-50';

  return (
    <div>
      <PageHeader
        eyebrow="People"
        title="Employees"
        desc={
          data ? (
            <span className="flex flex-wrap items-center gap-2">
              {data.people.toLocaleString()} people
              {data.sync && (
                <>
                  <span>·</span>
                  <span className="flex items-center gap-1.5">
                    <span className={cx('h-2 w-2 rounded-full', data.sync.status === 'connected' ? 'bg-ok' : 'bg-warn')} />
                    Synced from {providerName[data.sync.provider] || data.sync.provider} {data.sync.when}
                  </span>
                </>
              )}
            </span>
          ) : (
            ' '
          )
        }
        actions={
          manager && (
            <>
              {data?.sync && isAdmin(me?.user.role) && (
                <Button icon="sync" onClick={syncNow} loading={busy}>
                  Sync now
                </Button>
              )}
              <Button icon="upload" onClick={() => setModal('import')}>
                Import CSV
              </Button>
              <Button variant="ink" icon="plus" onClick={() => setModal('add')}>
                Add person
              </Button>
            </>
          )
        }
      />

      {data && (
        <div className="mb-6 grid grid-cols-[repeat(auto-fit,minmax(min(200px,100%),1fr))] gap-3">
          {data.stats.map((s: any) => {
            const on = filter === s.id;
            return (
              <button
                key={s.id}
                type="button"
                aria-pressed={on}
                onClick={() => reset(() => setFilter(on ? 'all' : s.id))}
                className={cx(
                  'lift flex flex-col gap-2.5 rounded-[14px] p-4.5 text-left',
                  on ? 'border-2 border-gold bg-[#FBF6EC]' : 'border border-linen bg-white hover:border-gold',
                )}
              >
                <span className="flex items-center gap-2 text-[12.5px] text-stone">
                  <span className="h-2 w-2 rounded-full" style={{ background: s.dot }} />
                  {s.label}
                </span>
                <span className="font-display text-[34px] font-medium leading-none">{s.value}</span>
              </button>
            );
          })}
        </div>
      )}

      <Panel pad={false} className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-2.5 p-4">
          <label className="flex h-[42px] min-w-[220px] flex-[1_1_260px] items-center gap-2.5 rounded-lg border border-linen bg-pearl px-3.5 text-stone-2">
            <Icon name="dSearch" size={17} />
            <input
              type="search"
              aria-label="Search people"
              placeholder="Search name, title or email"
              value={q}
              onChange={(e) => reset(() => setQ(e.target.value))}
              className="min-w-0 flex-1 bg-transparent text-[14px] text-ink outline-none"
            />
          </label>
          <FilterChip label="Department" value={department} onChange={(v) => reset(() => setDepartment(v))} options={asOptions(data?.departments)} />
          <FilterChip label="Office" value={office} onChange={(v) => reset(() => setOffice(v))} options={asOptions(data?.offices)} />
          <FilterChip
            label="Card status"
            value={cardStatus}
            onChange={(v) => reset(() => setCardStatus(v))}
            options={[
              { id: 'live', name: 'Live' },
              { id: 'pending_approval', name: 'Pending' },
              { id: 'draft', name: 'Draft' },
              { id: 'deactivated', name: 'Deactivated' },
              { id: 'none', name: 'No card' },
            ]}
          />
          <FilterChip label="Source" value={source} onChange={(v) => reset(() => setSource(v))} options={data?.sources || []} />
        </div>

        {sel.size > 0 && manager && (
          <div className="flex flex-wrap items-center gap-1 bg-ink px-3 py-1.5 text-white">
            <span className="mr-3 px-1 text-[13px] font-semibold">{sel.size} selected</span>
            <button type="button" disabled={busy} onClick={() => bulk('create-cards')} className={cx(bulkBtn, 'text-[#E6D3A3]')}>
              Create cards
            </button>
            <button type="button" onClick={() => setModal('nfc')} className={bulkBtn}>
              Order NFC cards
            </button>
            <button type="button" onClick={() => setModal('template')} className={bulkBtn}>
              Assign template
            </button>
            <a href="/api/employees/export" className={cx(bulkBtn, 'flex items-center text-white hover:text-white')}>
              Export
            </a>
            <button type="button" onClick={() => setSel(new Set())} className={cx(bulkBtn, 'ml-auto text-white/70')}>
              Clear
            </button>
          </div>
        )}

        {error ? (
          <ErrorState error={error} retry={() => mutate()} />
        ) : !data ? (
          <Loading />
        ) : data.rows.length === 0 ? (
          <Empty
            icon="users"
            title="No one here"
            desc="Try another filter, import a CSV or connect your HR system."
            action={
              manager && (
                <Button icon="upload" onClick={() => setModal('import')}>
                  Import CSV
                </Button>
              )
            }
          />
        ) : (
          <>
            <Table
              head={[
                {
                  label: <Checkbox label="Select all on this page" checked={allOnPage} onChange={(v) => setSel(v ? new Set(data.rows.map((r: any) => r.id)) : new Set())} />,
                  className: 'w-10',
                },
                'Person',
                'Title',
                'Office',
                'Card',
                'Source',
                'Devices',
                { label: '', className: 'w-40' },
              ]}
            >
              {data.rows.map((r: any) => (
                <tr key={r.id} className={cx('hover:bg-pearl', sel.has(r.id) && 'bg-gold-tint/60')}>
                  <Td>
                    <Checkbox label={`Select ${r.name}`} checked={sel.has(r.id)} onChange={() => toggle(r.id)} />
                  </Td>
                  <Td>
                    <div className="flex items-center gap-3">
                      <Avatar name={r.name} src={r.photoUrl} size={34} />
                      <span className="min-w-0">
                        <span className="block font-medium">{r.name}</span>
                        <span className="block truncate text-[13px] text-stone-2">{r.email || 'No email'}</span>
                      </span>
                    </div>
                  </Td>
                  <Td>
                    <span className="block">{r.title}</span>
                    <span className="block text-[13px] text-stone-2">{r.dept}</span>
                  </Td>
                  <Td className="text-stone">{r.office}</Td>
                  <Td>
                    <StatusBadge status={r.status} />
                  </Td>
                  <Td className="text-stone">{r.source}</Td>
                  <Td>
                    <span className="flex items-center gap-2">
                      <Icon name="nfc" size={16} className={r.nfc ? 'text-gold' : 'text-[#D9D2C4]'} />
                      <Icon name="dWallet" size={16} className={r.wallet ? 'text-gold' : 'text-[#D9D2C4]'} />
                      <span className="sr-only">{[r.nfc && 'NFC card', r.wallet && 'Wallet pass'].filter(Boolean).join(', ') || 'No devices'}</span>
                    </span>
                  </Td>
                  <Td className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {r.cardId ? (
                        <LinkButton size="sm" variant="outline" href={`/app/cards/${r.cardId}`}>
                          View card
                        </LinkButton>
                      ) : r.status !== 'Leaver' && manager ? (
                        <LinkButton
                          size="sm"
                          variant="ink"
                          href={`/app/create?person=${r.id}`}
                          onClick={async (e) => {
                            e.preventDefault();
                            try {
                              const c = await api.post('/cards', {
                                employeeId: r.id,
                              });
                              window.location.href = `/app/create?card=${c.id}&step=2`;
                            } catch (err) {
                              toast((err as Error).message, 'err');
                            }
                          }}
                        >
                          Create card
                        </LinkButton>
                      ) : null}
                      {isAdmin(me?.user.role) && r.status !== 'Leaver' && (
                        <button
                          type="button"
                          onClick={() => leave(r)}
                          aria-label={`Mark ${r.name} as leaver`}
                          title="Mark as leaver"
                          className="flex h-9 w-9 items-center justify-center rounded-md text-stone-2 hover:bg-err-bg hover:text-err"
                        >
                          <Icon name="logout" size={16} />
                        </button>
                      )}
                    </div>
                  </Td>
                </tr>
              ))}
            </Table>
            <Pagination page={data.page} limit={data.limit} total={data.total} onPage={setPage} />
          </>
        )}
      </Panel>

      <ImportModal open={modal === 'import'} onClose={() => setModal(null)} onDone={() => mutate()} />
      <AddPersonModal open={modal === 'add'} onClose={() => setModal(null)} onDone={() => mutate()} departments={data?.departments || []} offices={data?.offices || []} />
      <NfcModal open={modal === 'nfc'} count={sel.size} busy={busy} onClose={() => setModal(null)} onOrder={(material) => bulk('order-nfc', { material })} />
      <TemplateModal open={modal === 'template'} count={sel.size} busy={busy} onClose={() => setModal(null)} onAssign={(templateId) => bulk('assign-template', { templateId })} />
    </div>
  );
}

function ImportModal({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [createCards, setCreateCards] = useState(true);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<any>(null);
  const toast = useToast();
  const run = async () => {
    if (!file) return;
    setBusy(true);
    try {
      const csv = await file.text();
      const r = await api.post('/employees/import', { csv, createCards });
      setResult(r);
      onDone();
    } catch (e) {
      toast((e as Error).message, 'err');
    } finally {
      setBusy(false);
    }
  };
  const close = () => {
    setFile(null);
    setResult(null);
    onClose();
  };
  return (
    <Modal
      open={open}
      onClose={close}
      title="Import employees"
      footer={
        result ? (
          <Button variant="ink" onClick={close}>
            Done
          </Button>
        ) : (
          <>
            <Button onClick={close}>Cancel</Button>
            <Button variant="ink" icon="upload" disabled={!file} loading={busy} onClick={run}>
              Import
            </Button>
          </>
        )
      }
    >
      {result ? (
        <div className="flex flex-col gap-3 text-[15px]">
          <p>
            <b>{result.created}</b> added and <b>{result.updated}</b> updated.
          </p>
          {result.skipped.length > 0 && (
            <div className="rounded-md bg-warn-bg p-3 text-[13px] text-warn">
              {result.skipped.length} rows skipped: {result.skipped.slice(0, 5).join('; ')}
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          <p className="text-[14px] text-stone">
            Use columns like <span className="font-mono text-[13px]">name, email, title, department, office, phone, start_date</span>. We recognise common column names from
            Workday, BambooHR and Excel exports. People with the same email are updated, not duplicated.
          </p>
          <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-line-strong bg-pearl px-6 py-10 text-center hover:border-gold-soft">
            <Icon name="upload" size={24} className="text-gold-text" />
            <span className="text-[15px] font-medium">{file ? file.name : 'Choose a CSV file'}</span>
            <span className="text-[13px] text-stone-2">{file ? `${Math.round(file.size / 1024)} KB` : 'Up to 5 MB'}</span>
            <input type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          </label>
          <label className="flex items-center justify-between gap-3 text-[14px]">
            Create and publish a card for each new person
            <Toggle checked={createCards} onChange={setCreateCards} label="Create cards" />
          </label>
          <a
            href={`data:text/csv;charset=utf-8,${encodeURIComponent('name,email,title,department,office,phone,start_date\nOmar Haddad,omar.haddad@company.com,Associate,Private Clients,Dubai,+971 4 000 0000,2026-11-03\n')}`}
            download="vellaire-template.csv"
            className="text-[13px] text-gold-text underline underline-offset-4"
          >
            Download a template
          </a>
        </div>
      )}
    </Modal>
  );
}

function AddPersonModal({ open, onClose, onDone, departments, offices }: { open: boolean; onClose: () => void; onDone: () => void; departments: string[]; offices: string[] }) {
  const empty = {
    name: '',
    email: '',
    title: '',
    department: '',
    office: '',
    phone: '',
    startDate: '',
  };
  const [f, setF] = useState(empty);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const save = async (andCard: boolean) => {
    setBusy(true);
    try {
      const r = await api.post('/employees', {
        ...f,
        startDate: f.startDate || undefined,
      });
      toast(`${f.name} added`);
      onDone();
      setF(empty);
      onClose();
      if (andCard) {
        const c = await api.post('/cards', { employeeId: r.id });
        window.location.href = `/app/create?card=${c.id}&step=2`;
      }
    } catch (e) {
      toast((e as Error).message, 'err');
    } finally {
      setBusy(false);
    }
  };
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add a person"
      footer={
        <>
          <Button onClick={() => save(false)} disabled={f.name.length < 2} loading={busy}>
            Add person
          </Button>
          <Button variant="ink" onClick={() => save(true)} disabled={f.name.length < 2} loading={busy}>
            Add and create card
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name" className="sm:col-span-2">
          {(id) => <Input id={id} value={f.name} onChange={set('name')} />}
        </Field>
        <Field label="Work email">{(id) => <Input id={id} type="email" value={f.email} onChange={set('email')} />}</Field>
        <Field label="Job title">{(id) => <Input id={id} value={f.title} onChange={set('title')} />}</Field>
        <Field label="Department">{(id) => <Input id={id} list="depts" value={f.department} onChange={set('department')} />}</Field>
        <Field label="Office">{(id) => <Input id={id} list="offices" value={f.office} onChange={set('office')} />}</Field>
        <Field label="Work phone">{(id) => <Input id={id} type="tel" value={f.phone} onChange={set('phone')} />}</Field>
        <Field label="Start date">{(id) => <Input id={id} type="date" value={f.startDate} onChange={set('startDate')} />}</Field>
        <datalist id="depts">
          {departments.map((d) => (
            <option key={d} value={d} />
          ))}
        </datalist>
        <datalist id="offices">
          {offices.map((d) => (
            <option key={d} value={d} />
          ))}
        </datalist>
      </div>
    </Modal>
  );
}

function NfcModal({ open, count, busy, onClose, onOrder }: { open: boolean; count: number; busy: boolean; onClose: () => void; onOrder: (m: string) => void }) {
  const [m, setM] = useState('metal_obsidian');
  const price = MATERIALS.find((x) => x.id === m)!.price;
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Order ${count} NFC ${count === 1 ? 'card' : 'cards'}`}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="ink" loading={busy} onClick={() => onOrder(m)}>
            Place order · ${(price * count).toLocaleString()}
          </Button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        {MATERIALS.map((x) => (
          <label key={x.id} className={cx('flex cursor-pointer items-center gap-3 rounded-lg border p-3', m === x.id ? 'border-ink ring-1 ring-ink' : 'border-line')}>
            <input type="radio" name="mat" className="sr-only" checked={m === x.id} onChange={() => setM(x.id)} />
            <span className="h-10 w-16 shrink-0 rounded" style={{ background: x.bg }} />
            <span>
              <span className="block text-[14px] font-medium">{x.name}</span>
              <span className="block text-[12px] text-stone-2">${x.price} each</span>
            </span>
          </label>
        ))}
      </div>
      <p className="mt-4 text-[13px] text-stone-2">Each card is engraved from your brand kit and shipped to the person&rsquo;s office.</p>
    </Modal>
  );
}

function TemplateModal({ open, count, busy, onClose, onAssign }: { open: boolean; count: number; busy: boolean; onClose: () => void; onAssign: (id: string) => void }) {
  const { data } = useApi<any[]>(open ? '/templates' : null);
  const [t, setT] = useState('');
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Assign a template"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="ink" loading={busy} disabled={!t} onClick={() => onAssign(t)}>
            Apply to {count} cards
          </Button>
        </>
      }
    >
      {!data ? (
        <Loading />
      ) : (
        <div className="flex flex-col gap-2">
          {data.map((x) => (
            <label
              key={x.id}
              className={cx('flex cursor-pointer items-center justify-between rounded-lg border px-4 py-3', t === x.id ? 'border-ink ring-1 ring-ink' : 'border-line')}
            >
              <input type="radio" name="tpl" className="sr-only" checked={t === x.id} onChange={() => setT(x.id)} />
              <span>
                <span className="block text-[14px] font-medium">{x.name}</span>
                <span className="block text-[12px] text-stone-2">
                  {x.layoutName} · {x.themeName}
                </span>
              </span>
              {x.isDefault && <span className="text-[12px] text-gold-text">Default</span>}
            </label>
          ))}
          <Link href="/app/templates" className="mt-2 text-[13px] text-gold-text underline underline-offset-4">
            Manage templates
          </Link>
        </div>
      )}
    </Modal>
  );
}
