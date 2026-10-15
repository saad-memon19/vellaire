'use client';

import { useState } from 'react';
import { Icon } from '@/components/icons';
import { usePasswordLink } from '@/components/password-link';
import { ErrorState, FilterChip, LinkButton, Loading, PageHeader, Pagination } from '@/components/ui';
import { api, qs, useApi } from '@/lib/api';
import { EmptyRow, GridRow, GridTable, Kpis, Pill, RowButton, Section, useAction } from '../parts';

const COLS = '2.2fr 1.4fr 1.2fr 1fr 1fr 0.9fr 130px';
const ROLES = [
  { id: 'owner', name: 'Company Owner' },
  { id: 'admin', name: 'Company Admin' },
  { id: 'brand_manager', name: 'Brand Manager' },
  { id: 'member', name: 'Card holder' },
];
const STATUSES = [
  { id: 'active', name: 'Active' },
  { id: 'invited', name: 'Invited' },
  { id: 'disabled', name: 'Suspended' },
];

export default function UsersDirectory() {
  const [q, setQ] = useState('');
  const [company, setCompany] = useState('');
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const query = qs({ q, company, role, status });
  const { data, error, mutate } = useApi<any>(`/console/users${qs({ q, company, role, status, page })}`);
  const { busy, run } = useAction(mutate);
  const passwordLink = usePasswordLink();
  const filter = (set: (v: string) => void) => (v: string) => {
    set(v);
    setPage(1);
  };

  if (error) return <ErrorState error={error} retry={() => mutate()} />;
  return (
    <div className="flex flex-col gap-5.5 [&>header]:mb-0">
      <PageHeader
        eyebrow="Customers"
        title="Users directory"
        desc="Every person with access, across all companies. Personal details stay masked."
        actions={
          <LinkButton href={`/api/console/users/export${query}`} icon="dDownload">
            Export
          </LinkButton>
        }
      />
      <div className="flex flex-wrap items-center gap-2.5">
        <label className="flex h-10.5 max-w-105 flex-[1_1_300px] items-center gap-2.5 rounded-lg border border-linen bg-white px-3 text-stone-2">
          <Icon name="dSearch" size={17} />
          <input
            type="search"
            aria-label="Search users"
            placeholder="Search name or email"
            value={q}
            onChange={(e) => filter(setQ)(e.target.value)}
            className="min-w-0 flex-1 bg-transparent text-[14px] text-ink outline-none"
          />
        </label>
        <FilterChip label="Company" value={company} onChange={filter(setCompany)} options={data?.companies || []} />
        <FilterChip label="Role" value={role} onChange={filter(setRole)} options={ROLES} />
        <FilterChip label="Status" value={status} onChange={filter(setStatus)} options={STATUSES} />
      </div>
      {!data ? (
        <Loading />
      ) : (
        <>
          <Kpis items={data.kpis} />
          <Section>
            <GridTable cols={COLS} minWidth={1000} head={['Person', 'Company', 'Role', 'Sign-in', 'Last active', 'Status', '']}>
              {data.rows.length === 0 && <EmptyRow>No one matches these filters</EmptyRow>}
              {data.rows.map((r: any) => (
                <GridRow key={r.id} cols={COLS}>
                  <span className="flex min-w-0 items-center gap-3">
                    <span className="flex h-8.5 w-8.5 shrink-0 items-center justify-center rounded-full bg-[#F2EEE6] text-[12.5px] font-semibold text-gold-text">{r.ini}</span>
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate font-semibold">{r.name}</span>
                      <span className="truncate font-mono text-[12.5px] text-stone-2">{r.email}</span>
                    </span>
                  </span>
                  <span className="truncate">{r.company}</span>
                  <span className="text-[#4E4A44]">{r.role}</span>
                  <span className="text-[13px] text-[#4E4A44]">{r.signin}</span>
                  <span className="text-[13px] text-stone-2">{r.last}</span>
                  <span>
                    <Pill status={r.statusId} />
                  </span>
                  <span className="flex justify-end gap-1.5">
                    {r.statusId !== 'disabled' && <RowButton onClick={() => passwordLink.make(`/auth/reset-link/${r.id}`, r.name)}>Password link</RowButton>}
                    {r.statusId === 'invited' && (
                      <RowButton disabled={busy === r.id} onClick={() => run(r.id, () => api.post(`/console/users/${r.id}/resend-invite`), 'Invite sent again')}>
                        Resend
                      </RowButton>
                    )}
                    {r.statusId === 'disabled' ? (
                      <RowButton disabled={busy === r.id} onClick={() => run(r.id, () => api.post(`/console/users/${r.id}/reactivate`), `${r.name} can sign in again`)}>
                        Reactivate
                      </RowButton>
                    ) : (
                      <RowButton
                        className="text-err"
                        disabled={busy === r.id}
                        onClick={() =>
                          confirm(`Suspend ${r.name}? They are signed out and cannot sign in until reactivated.`) &&
                          run(r.id, () => api.post(`/console/users/${r.id}/suspend`), `${r.name} suspended`)
                        }
                      >
                        Suspend
                      </RowButton>
                    )}
                  </span>
                </GridRow>
              ))}
            </GridTable>
            <Pagination page={data.page} limit={data.limit} total={data.total} onPage={setPage} />
          </Section>
        </>
      )}
      {passwordLink.modal}
    </div>
  );
}
