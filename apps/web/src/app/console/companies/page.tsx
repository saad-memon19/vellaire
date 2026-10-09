'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { HealthBar } from '@/components/health-bar';
import { Icon } from '@/components/icons';
import { useToast } from '@/components/toast';
import { Button, cx, ErrorState, Field, Input, Loading, Modal, PageHeader, Panel, Select, StatusBadge, Table, PillTabs, Td } from '@/components/ui';
import { api, qs, useApi } from '@/lib/api';
import { toCsvDownload } from './csv';

export default function Page() {
  return (
    <Suspense fallback={<Loading />}>
      <Companies />
    </Suspense>
  );
}

function Companies() {
  const params = useSearchParams();
  const [group, setGroup] = useState('all');
  const [q, setQ] = useState(params.get('q') || '');
  const [open, setOpen] = useState(false);
  const { data, error, mutate } = useApi<any>(`/console/companies${qs({ group, q })}`);

  if (error) return <ErrorState error={error} retry={() => mutate()} />;
  return (
    <div>
      <PageHeader
        eyebrow="Customers"
        title="Companies"
        desc={data ? `${data.summary.active} active companies · ${data.summary.trials} on trial · ${data.summary.cards.toLocaleString()} active cards` : ' '}
        actions={
          <>
            <Button icon="download" disabled={!data} onClick={() => toCsvDownload(data.rows, 'companies.csv')}>
              Export
            </Button>
            <Button variant="ink" icon="plus" onClick={() => setOpen(true)}>
              Create trial workspace
            </Button>
          </>
        }
      />
      {data && (
        <PillTabs
          items={data.groups.map((g: any) => ({
            id: g.id,
            name: g.name,
            count: g.n,
          }))}
          value={group}
          onChange={setGroup}
          className="mb-5"
        />
      )}
      <Panel pad={false}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line p-4">
          <div className="relative w-full max-w-sm">
            <Icon name="search" size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-2" />
            <Input aria-label="Search companies" placeholder="Search company" value={q} onChange={(e) => setQ(e.target.value)} className="pl-10" />
          </div>
          <span className="text-[13px] text-stone-2">Sorted by health, lowest first</span>
        </div>
        {!data ? (
          <Loading />
        ) : (
          <Table head={['Company', 'Plan', 'Seats', 'HR link', 'Health', 'Account manager', 'MRR', 'Status']}>
            {data.rows.map((c: any) => (
              <tr key={c.id} className="hover:bg-pearl">
                <Td>
                  <Link href={`/console/companies/${c.id}`} className="flex items-center gap-3">
                    <span aria-hidden className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-ink font-display text-[16px] text-[#E6D3A3]">
                      {c.name[0]}
                    </span>
                    <span>
                      <span className="block font-medium">{c.name}</span>
                      <span className="block text-[13px] text-stone-2">
                        {c.country} · since {c.since}
                      </span>
                    </span>
                  </Link>
                </Td>
                <Td>{c.plan}</Td>
                <Td className="tabular-nums">{c.seats}</Td>
                <Td className={cx('text-[13px]', c.hrOk ? 'text-stone' : 'text-err')}>{c.hr}</Td>
                <Td>
                  <HealthBar h={c.h} />
                </Td>
                <Td className="text-stone">{c.am}</Td>
                <Td className="tabular-nums">${c.mrr.toLocaleString()}</Td>
                <Td>
                  <StatusBadge status={c.status} />
                </Td>
              </tr>
            ))}
          </Table>
        )}
      </Panel>
      <TrialModal open={open} onClose={() => setOpen(false)} />
    </div>
  );
}

function TrialModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [f, setF] = useState({
    name: '',
    ownerName: '',
    ownerEmail: '',
    country: '',
    plan: 'professional',
    seats: 25,
    trialDays: 14,
  });
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const router = useRouter();
  const create = async () => {
    setBusy(true);
    try {
      const r = await api.post('/console/companies', f);
      toast(`Workspace created. ${f.ownerName} has a sign-in email.`);
      router.push(`/console/companies/${r.id}`);
    } catch (e) {
      toast((e as Error).message, 'err');
    } finally {
      setBusy(false);
    }
  };
  const set =
    (k: keyof typeof f, num = false) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setF({ ...f, [k]: num ? Number(e.target.value) : e.target.value });
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Create trial workspace"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="ink" loading={busy} disabled={!f.name || !f.ownerEmail || !f.ownerName} onClick={create}>
            Create and invite
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Company" className="sm:col-span-2">
          {(id) => <Input id={id} value={f.name} onChange={set('name')} />}
        </Field>
        <Field label="Owner name">{(id) => <Input id={id} value={f.ownerName} onChange={set('ownerName')} />}</Field>
        <Field label="Owner email">{(id) => <Input id={id} type="email" value={f.ownerEmail} onChange={set('ownerEmail')} />}</Field>
        <Field label="Country">{(id) => <Input id={id} value={f.country} onChange={set('country')} />}</Field>
        <Field label="Plan">
          {(id) => (
            <Select id={id} value={f.plan} onChange={set('plan')}>
              <option value="starter">Starter</option>
              <option value="professional">Professional</option>
              <option value="enterprise">Enterprise</option>
            </Select>
          )}
        </Field>
        <Field label="Seats">{(id) => <Input id={id} type="number" min={1} value={f.seats} onChange={set('seats', true)} />}</Field>
        <Field label="Trial days">{(id) => <Input id={id} type="number" min={1} max={90} value={f.trialDays} onChange={set('trialDays', true)} />}</Field>
      </div>
    </Modal>
  );
}
