'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { Icon } from '@/components/icons';
import { usePasswordLink } from '@/components/password-link';
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

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (val: string) => void;
  options: { id: string; name: string }[];
}) {
  return (
    <div className="relative inline-flex items-center">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 cursor-pointer appearance-none rounded-lg border border-[#E6E0D5] bg-white pl-3 pr-7 text-[13.5px] text-[#17171B] outline-none transition-colors hover:border-[#B08D4F] focus:border-[#B08D4F]"
      >
        <option value="">{label}</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
      <svg
        className="pointer-events-none absolute right-2 h-3.5 w-3.5 text-[#8E887E]"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M7 10l5 5 5-5" />
      </svg>
    </div>
  );
}

function getStatusStyle(status: string) {
  const s = (status || '').toLowerCase();
  if (s === 'live' || s === 'card live' || s === 'active') {
    return { bg: '#E5F2EB', fg: '#1F7A55', label: 'Live' };
  }
  if (s === 'pending' || s === 'pending_approval' || s === 'waiting approval') {
    return { bg: '#FBF0DC', fg: '#8A5A12', label: 'Pending' };
  }
  if (s === 'deactivated' || s === 'leaver' || s === 'lost') {
    return { bg: '#F8E4E7', fg: '#A3283A', label: 'Deactivated' };
  }
  return { bg: '#EFEBE3', fg: '#4E4A44', label: 'No card' };
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
  const passwordLink = usePasswordLink();
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

  const allOnPage = (data?.rows?.length || 0) > 0 && data.rows.every((r: any) => sel.has(r.id));
  const providerName: Record<string, string> = {
    workday: 'Workday',
    sap: 'SAP SuccessFactors',
    bamboohr: 'BambooHR',
    entra: 'Entra ID',
  };
  const asOptions = (list: string[] = []) => list.map((x) => ({ id: x, name: x }));

  const from = data?.total ? (data.page - 1) * data.limit + 1 : 0;
  const to = data?.total ? Math.min(data.page * data.limit, data.total) : 0;

  return (
    <div className="flex flex-col gap-6">
      {/* Page Header */}
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div className="flex flex-col gap-1.5">
          <div className="text-[12px] font-medium tracking-[0.2em] text-[#876A33]">PEOPLE</div>
          <h1 className="m-0 font-display text-[46px] font-normal leading-[1.05] text-[#17171B]">Employees</h1>
          <p className="m-0 flex flex-wrap items-center gap-2 text-[15px] text-[#5E5952]">
            {data ? (
              <>
                <span>{data.people?.toLocaleString() || data.total?.toLocaleString() || '1,320'} people</span>
                <span className="text-[#C9BFAD]">·</span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-[7px] w-[7px] rounded-full bg-[#1F7A55]" />
                  Synced from {providerName[data.sync?.provider] || 'Workday'} {data.sync?.when || '4 min ago'}
                </span>
              </>
            ) : (
              <span>1,320 people</span>
            )}
          </p>
        </div>

        {manager && (
          <div className="flex flex-wrap items-center gap-2.5">
            {data?.sync && isAdmin(me?.user.role) && (
              <button
                type="button"
                onClick={syncNow}
                disabled={busy}
                className="flex h-11 items-center gap-2 rounded-lg border border-[#D9D2C4] bg-white px-4 text-[14px] text-[#17171B] transition-colors hover:bg-[#FAF7F1] disabled:opacity-50"
              >
                <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M20 11a8 8 0 0 0-14.5-4.5L4 8M4 4v4h4M4 13a8 8 0 0 0 14.5 4.5L20 16M20 20v-4h-4" />
                </svg>
                Sync now
              </button>
            )}
            <button
              type="button"
              onClick={() => setModal('import')}
              className="flex h-11 items-center gap-2 rounded-lg border border-[#D9D2C4] bg-white px-4 text-[14px] text-[#17171B] transition-colors hover:bg-[#FAF7F1]"
            >
              <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />
              </svg>
              Import CSV
            </button>
            <button
              type="button"
              onClick={() => setModal('add')}
              className="flex h-11 items-center gap-2 rounded-lg bg-[#17171B] px-5 text-[14px] font-semibold text-white transition-colors hover:bg-[#2E2E35]"
            >
              <svg className="h-[18px] w-[18px] text-[#E6D3A3]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 5v14M5 12h14" />
              </svg>
              Add person
            </button>
          </div>
        )}
      </div>

      {/* Summary Stat Cards */}
      {data && (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(200px,100%),1fr))] gap-3">
          {data.stats.map((s: any) => {
            const on = filter === s.id;
            return (
              <button
                key={s.id}
                type="button"
                aria-pressed={on}
                onClick={() => reset(() => setFilter(on ? 'all' : s.id))}
                className={cx(
                  'flex flex-col gap-2 rounded-[14px] p-[18px] text-left transition-all',
                  on ? 'border-2 border-[#B08D4F] bg-[#FBF6EC]' : 'border border-[#E6E0D5] bg-white hover:border-[#B08D4F]'
                )}
              >
                <span className="flex items-center gap-2 text-[13px] text-[#4E4A44]">
                  <span className="h-2 w-2 rounded-full" style={{ background: s.dot }} />
                  {s.label}
                </span>
                <span className="font-display text-[34px] font-medium leading-none text-[#17171B]">{s.value}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Main Table Container */}
      <section className="overflow-hidden rounded-[14px] border border-[#E6E0D5] bg-white">
        {/* Search & Filter Bar */}
        <div className="flex flex-wrap items-center gap-2.5 border-b border-[#EEE8DD] p-[14px_18px]">
          <label htmlFor="es" className="flex h-10 min-w-[220px] max-w-[360px] flex-[1_1_260px] items-center gap-2.5 rounded-lg border border-[#E6E0D5] bg-[#F7F5F0] px-3 text-[#6E685F]">
            <svg className="h-[18px] w-[18px] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-3.5-3.5" />
            </svg>
            <input
              id="es"
              type="search"
              aria-label="Search people"
              placeholder="Search name, title or email"
              value={q}
              onChange={(e) => reset(() => setQ(e.target.value))}
              className="min-w-0 flex-1 bg-transparent text-[14px] text-[#17171B] outline-none placeholder:text-[#6E685F]"
            />
          </label>
          <FilterSelect label="Department" value={department} onChange={(v) => reset(() => setDepartment(v))} options={asOptions(data?.departments)} />
          <FilterSelect label="Office" value={office} onChange={(v) => reset(() => setOffice(v))} options={asOptions(data?.offices)} />
          <FilterSelect
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
          <FilterSelect label="Source" value={source} onChange={(v) => reset(() => setSource(v))} options={data?.sources || []} />
        </div>

        {/* Selected Banner */}
        {sel.size > 0 && manager && (
          <div className="flex flex-wrap items-center gap-3 bg-[#17171B] px-4.5 py-2.5 text-white">
            <span className="text-[13.5px] font-semibold">{sel.size} selected</span>
            <span className="h-4.5 w-px bg-[#3A3A42]" />
            <button
              type="button"
              disabled={busy}
              onClick={() => bulk('create-cards')}
              className="text-[13.5px] font-medium text-[#E6D3A3] hover:underline"
            >
              Create cards
            </button>
            <button
              type="button"
              onClick={() => setModal('nfc')}
              className="text-[13.5px] text-white hover:underline"
            >
              Order NFC cards
            </button>
            <button
              type="button"
              onClick={() => setModal('template')}
              className="text-[13.5px] text-white hover:underline"
            >
              Assign template
            </button>
            {sel.size === 1 && ['owner', 'admin', 'hr_manager'].includes(me?.user.role || '') && (
              <button
                type="button"
                onClick={() => {
                  const r = data?.rows.find((x: any) => sel.has(x.id));
                  if (r) passwordLink.make(`/auth/reset-link/employee/${r.id}`, r.name);
                }}
                className="text-[13.5px] text-white hover:underline"
              >
                Password link
              </button>
            )}
            <a
              href="/api/employees/export"
              className="text-[13.5px] text-white hover:underline"
            >
              Export
            </a>
            <button
              type="button"
              onClick={() => setSel(new Set())}
              className="ml-auto text-[13.5px] text-[#B9B4AA] hover:text-white"
            >
              Clear
            </button>
          </div>
        )}

        {/* Content Area */}
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
            <div className="overflow-x-auto">
              <div className="min-w-[980px]">
                {/* Table Header */}
                <div className="grid grid-cols-[36px_2.2fr_1.6fr_1fr_1fr_0.9fr_0.9fr_120px] items-center gap-3.5 bg-[#FAF8F3] px-4.5 py-2.5 text-[11px] font-medium tracking-[0.14em] text-[#6E685F]">
                  <span>
                    <input
                      type="checkbox"
                      checked={allOnPage}
                      onChange={(e) => setSel(e.target.checked ? new Set(data.rows.map((r: any) => r.id)) : new Set())}
                      aria-label="Select all on this page"
                      className="h-[17px] w-[17px] cursor-pointer accent-[#17171B]"
                    />
                  </span>
                  <span>PERSON</span>
                  <span>TITLE</span>
                  <span>OFFICE</span>
                  <span>CARD</span>
                  <span>SOURCE</span>
                  <span>DEVICES</span>
                  <span></span>
                </div>

                {/* Table Rows */}
                {data.rows.map((r: any) => {
                  const isSelected = sel.has(r.id);
                  const st = getStatusStyle(r.status);
                  const hasCard = !!r.cardId && st.label !== 'No card';
                  const ini = (r.name || '?')
                    .split(/\s+/)
                    .filter(Boolean)
                    .slice(0, 2)
                    .map((p: string) => p[0]!.toUpperCase())
                    .join('');

                  return (
                    <div
                      key={r.id}
                      className={cx(
                        'grid grid-cols-[36px_2.2fr_1.6fr_1fr_1fr_0.9fr_0.9fr_120px] items-center gap-3.5 border-t border-[#F0EBE2] px-4.5 py-3 transition-colors hover:bg-[#FAF7F1]',
                        isSelected ? 'bg-[#FBF6EC]' : 'bg-white'
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggle(r.id)}
                        aria-label={`Select ${r.name}`}
                        className="h-[17px] w-[17px] cursor-pointer accent-[#17171B]"
                      />
                      <span className="flex min-w-0 items-center gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#F2EEE6] font-display text-[15px] font-semibold text-[#876A33]">
                          {ini}
                        </span>
                        <span className="flex min-w-0 flex-col">
                          <span className="truncate text-[14px] font-semibold text-[#17171B]">{r.name}</span>
                          <span className="truncate text-[12.5px] text-[#6E685F]">{r.email || 'No email'}</span>
                        </span>
                      </span>
                      <span className="flex flex-col">
                        <span className="text-[14px] text-[#17171B]">{r.title}</span>
                        <span className="text-[12.5px] text-[#6E685F]">{r.dept}</span>
                      </span>
                      <span className="text-[14px] text-[#2A2A30]">{r.office}</span>
                      <span>
                        <span
                          className="inline-block rounded-full px-2.5 py-0.5 text-[12px] font-medium"
                          style={{ background: st.bg, color: st.fg }}
                        >
                          {st.label}
                        </span>
                      </span>
                      <span className="text-[13px] text-[#4E4A44]">{r.source}</span>
                      <span className="flex items-center gap-1.5 text-[#B08D4F]">
                        <svg
                          className="h-[18px] w-[18px]"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-label="NFC card"
                          style={{ opacity: r.nfc ? 1 : 0.2 }}
                        >
                          <path d="M8 8.5a5 5 0 0 1 0 7M11.5 6a8.5 8.5 0 0 1 0 12M15 3.5a12 12 0 0 1 0 17" />
                        </svg>
                        <svg
                          className="h-[18px] w-[18px]"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-label="Wallet pass"
                          style={{ opacity: r.wallet ? 1 : 0.2 }}
                        >
                          <path d="M5 6h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2zM3 10h18" />
                        </svg>
                      </span>
                      <div className="flex items-center justify-end">
                        {hasCard ? (
                          <Link
                            href={`/app/cards/${r.cardId}`}
                            className="inline-flex h-[34px] items-center rounded-lg border border-[#E0D9CC] bg-white px-3 text-[13px] font-medium text-[#17171B] transition-colors hover:bg-[#FAF7F1]"
                          >
                            View card
                          </Link>
                        ) : manager ? (
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                const c = await api.post('/cards', { employeeId: r.id });
                                window.location.href = `/app/create?card=${c.id}&step=2`;
                              } catch (err) {
                                toast((err as Error).message, 'err');
                              }
                            }}
                            className="inline-flex h-[34px] items-center rounded-lg border border-[#17171B] bg-[#17171B] px-3 text-[13px] font-medium text-white transition-colors hover:bg-[#2E2E35]"
                          >
                            Create card
                          </button>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Bottom Pagination */}
            <div className="flex flex-wrap items-center justify-between gap-2.5 border-t border-[#EEE8DD] p-[12px_18px] text-[13.5px] text-[#5E5952]">
              <span>
                Showing {from.toLocaleString()}–{to.toLocaleString()} of {data.total.toLocaleString()}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={data.page <= 1}
                  onClick={() => setPage(data.page - 1)}
                  className="h-9 rounded-lg border border-[#E6E0D5] bg-white px-3.5 text-[13.5px] font-medium text-[#8E887E] disabled:cursor-not-allowed disabled:opacity-50 enabled:text-[#17171B] enabled:cursor-pointer"
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={to >= data.total}
                  onClick={() => setPage(data.page + 1)}
                  className="h-9 rounded-lg border border-[#D9D2C4] bg-white px-3.5 text-[13.5px] font-medium text-[#17171B] disabled:cursor-not-allowed disabled:opacity-50 enabled:cursor-pointer"
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </section>

      {/* Modals */}
      {passwordLink.modal}
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
        <Field label="Job title">{(id) => <Input id={id} value={f.title} onChange={set('title')} />}
        </Field>
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
