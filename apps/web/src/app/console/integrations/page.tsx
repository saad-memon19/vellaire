'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Icon } from '@/components/icons';
import { Button, ErrorState, Loading, Modal, PageHeader, Segmented } from '@/components/ui';
import { api, useApi } from '@/lib/api';
import { GridRow, GridTable, Kpis, Meter, Pill, RowButton, Section, useAction } from '../parts';

const COLS = '1.8fr 0.8fr 0.9fr 1.5fr 1.7fr 1fr 100px';

export default function IntegrationHealth() {
  const [days, setDays] = useState<'7' | '30'>('7');
  const { data, error, mutate } = useApi<any>(`/console/integration-health?days=${days}`);
  const { busy, run } = useAction(mutate);
  const [open, setOpen] = useState<any>(null);

  if (error) return <ErrorState error={error} retry={() => mutate()} />;
  return (
    <div className="flex flex-col gap-5.5 [&>header]:mb-0">
      <PageHeader
        eyebrow="Operations"
        title="Integration health"
        desc="How each HR, identity and CRM connector is performing across all customers."
        actions={
          <Segmented
            items={[
              { id: '7', name: 'Last 7 days' },
              { id: '30', name: 'Last 30 days' },
            ]}
            value={days}
            onChange={setDays}
          />
        }
      />
      {!data ? (
        <Loading />
      ) : (
        <>
          <Kpis items={data.kpis} />
          <Section>
            <GridTable cols={COLS} minWidth={1040} head={['Connector', 'Type', 'Companies', 'Success rate', 'Last error', 'Status', '']}>
              {data.rows.map((r: any) => (
                <GridRow key={r.id} cols={COLS}>
                  <span className="flex items-center gap-3">
                    <span className="flex h-8.5 w-8.5 shrink-0 items-center justify-center rounded-[9px] bg-gold-tint text-[13px] font-semibold text-gold-text">{r.name[0]}</span>
                    <span className="flex flex-col">
                      <span className="font-semibold">{r.name}</span>
                      <span className="text-[12px] text-stone-2">{r.runs ? `${r.runs} syncs` : 'No syncs in this period'}</span>
                    </span>
                  </span>
                  <span className="text-[#4E4A44]">{r.kind}</span>
                  <span className="tabular-nums">{r.companies}</span>
                  {r.rate === null ? (
                    <span className="text-[13px] text-stone-2">{r.kind === 'CRM' ? 'Pushes not tracked' : '—'}</span>
                  ) : (
                    <Meter pct={r.rate} level={r.rate >= 99 ? 'ok' : r.rate >= 95 ? 'warn' : 'err'} />
                  )}
                  <span className="text-[13px] text-[#4E4A44]">{r.lastError}</span>
                  <span>
                    <Pill status={r.status} />
                  </span>
                  <span className="flex justify-end">{r.companies > 0 && r.kind !== 'CRM' && <RowButton onClick={() => setOpen(r)}>Details</RowButton>}</span>
                </GridRow>
              ))}
            </GridTable>
          </Section>
          {data.alerts.map((a: any) => (
            <section key={a.id} className="flex flex-wrap items-start gap-3.5 rounded-[14px] border border-[#EBD3A8] bg-warn-bg px-5 py-4.5">
              <Icon name="alert" className="mt-0.5 text-warn" />
              <span className="flex flex-[1_1_320px] flex-col gap-1">
                <span className="font-semibold">{a.title}</span>
                <span className="text-[13.5px] leading-normal text-[#4E4A44]">{a.text}</span>
              </span>
              <Button
                size="sm"
                loading={busy === a.id}
                onClick={() =>
                  run(
                    a.id,
                    () => api.post<{ notified: number }>(`/console/integration-health/${a.id}/notify`),
                    (r) => `Banner shown to admins of ${r.notified} companies`,
                  )
                }
              >
                Notify affected admins
              </Button>
            </section>
          ))}
        </>
      )}
      {open && <Details connector={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

function Details({ connector, onClose }: { connector: any; onClose: () => void }) {
  const { data } = useApi<any[]>(`/console/integration-health/${connector.id}`);
  return (
    <Modal open onClose={onClose} title={connector.name} wide>
      {!data ? (
        <Loading />
      ) : (
        <ul className="flex flex-col divide-y divide-linen">
          {data.map((c) => (
            <li key={c.companyId} className="flex flex-wrap items-center gap-3 py-3">
              <Link href={`/console/companies/${c.companyId}`} className="min-w-0 flex-1 font-medium hover:underline">
                {c.company}
              </Link>
              <span className="text-[13px] text-stone-2">Last sync {c.lastSync}</span>
              <Pill status={c.status === 'connected' ? 'healthy' : c.status === 'paused' ? 'review' : 'error'} />
              {c.error && <p className="basis-full text-[13px] text-err">{c.error}</p>}
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
