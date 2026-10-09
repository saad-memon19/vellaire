'use client';

import { useState } from 'react';
import { Button, cx, ErrorState, Field, Input, Loading, Modal, PageHeader, Select } from '@/components/ui';
import { api, useApi } from '@/lib/api';
import { Kpis, Pill, RowButton, Section, useAction } from '../parts';

const BAR: Record<string, string> = { healthy: '#7FC3A0', degraded: '#C88A2E', down: '#D9A5AC', none: '#EEE8DD' };
const BANNER = {
  ok: { box: 'border-[#BFE0CE] bg-ok-bg', dot: 'bg-ok shadow-[0_0_0_6px_rgba(31,122,85,0.15)]', title: 'text-[#155C40]', text: 'text-[#2F6B52]' },
  warn: { box: 'border-[#EBD3A8] bg-warn-bg', dot: 'bg-warn shadow-[0_0_0_6px_rgba(138,90,18,0.15)]', title: 'text-[#6B4510]', text: 'text-[#7A5A22]' },
  err: { box: 'border-[#E8C0C6] bg-err-bg', dot: 'bg-err shadow-[0_0_0_6px_rgba(163,40,58,0.15)]', title: 'text-err', text: 'text-[#8A2E3B]' },
} as const;

export default function SystemHealth() {
  const { data, error, mutate } = useApi<any>('/console/health', { refreshInterval: 60_000 });
  const { busy, run } = useAction(mutate);
  const [declare, setDeclare] = useState(false);

  if (error) return <ErrorState error={error} retry={() => mutate()} />;
  const b = data && BANNER[data.banner.tone as keyof typeof BANNER];
  const open = data?.incidents.filter((i: any) => i.status === 'open') || [];
  return (
    <div className="flex flex-col gap-5.5 [&>header]:mb-0">
      <PageHeader
        eyebrow="Platform"
        title="System health"
        desc="Live status of the services that keep every card online. Checked every five minutes."
        actions={
          <>
            <Button loading={busy === 'check'} onClick={() => run('check', () => api.post('/console/health/check'), 'Checked every service now')}>
              Check now
            </Button>
            <Button variant="ink" onClick={() => setDeclare(true)}>
              Declare incident
            </Button>
          </>
        }
      />
      {!data ? (
        <Loading />
      ) : (
        <>
          <section className={cx('flex flex-wrap items-center gap-3.5 rounded-[14px] border px-5 py-4.5', b!.box)}>
            <span className={cx('h-3 w-3 shrink-0 rounded-full', b!.dot)} />
            <span className="flex flex-[1_1_300px] flex-col gap-0.5">
              <span className={cx('font-semibold', b!.title)}>{data.banner.title}</span>
              <span className={cx('text-[13px]', b!.text)}>{data.banner.text}</span>
            </span>
            <span className={cx('text-[13px]', b!.text)}>{data.banner.uptime}</span>
          </section>
          <Kpis items={data.kpis} />
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(300px,100%),1fr))] gap-3">
            {data.services.map((s: any) => (
              <div key={s.id} className="flex flex-col gap-3 rounded-[14px] border border-linen bg-white px-4.5 py-4">
                <div className="flex items-start justify-between gap-3">
                  <span className="flex flex-col gap-0.5">
                    <span className="font-semibold">{s.name}</span>
                    <span className="text-[12.5px] text-stone-2">{s.note}</span>
                  </span>
                  <Pill status={s.status === 'off' ? 'none' : s.status} />
                </div>
                <div className="grid grid-cols-[repeat(30,minmax(0,1fr))] gap-0.5" aria-label={`${s.name}, last 30 days`}>
                  {s.days.map((d: string, i: number) => (
                    <span key={i} className="h-5.5 rounded-[2px]" style={{ background: BAR[d] }} title={d === 'none' ? 'No data' : d} />
                  ))}
                </div>
                <span className="text-[11.5px] text-stone-2">Last 30 days · {s.desc}</span>
              </div>
            ))}
          </div>
          {data.incidents.length > 0 && (
            <Section title="Incidents" sub={open.length ? `${open.length} open` : 'All resolved'}>
              {data.incidents.map((i: any) => (
                <div key={i.id} className="flex flex-wrap items-center gap-3.5 border-t border-[#F0EBE2] px-5 py-3">
                  <span className="flex min-w-0 flex-[1_1_260px] flex-col gap-0.5">
                    <span className="font-semibold">{i.title}</span>
                    <span className="text-[12.5px] text-stone-2">
                      {i.service} · {i.impact === 'outage' ? 'Outage' : 'Degraded'} · declared {i.when}
                      {i.resolved && ` · resolved ${i.resolved}`}
                    </span>
                  </span>
                  <Pill status={i.status} />
                  {i.status === 'open' && (
                    <RowButton className="h-8.5" disabled={busy === i.id} onClick={() => run(i.id, () => api.post(`/console/incidents/${i.id}/resolve`), 'Incident resolved')}>
                      Mark resolved
                    </RowButton>
                  )}
                </div>
              ))}
            </Section>
          )}
        </>
      )}
      {declare && data && <IncidentModal services={data.services} onClose={() => setDeclare(false)} onSaved={mutate} />}
    </div>
  );
}

function IncidentModal({ services, onClose, onSaved }: { services: any[]; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ title: '', service: services[0]?.name || '', impact: 'degraded' });
  const { busy, run } = useAction(onSaved);
  const save = () => run('save', () => api.post('/console/incidents', f), 'Incident declared').then((r) => r && onClose());
  return (
    <Modal
      open
      onClose={onClose}
      title="Declare an incident"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="ink" loading={busy === 'save'} disabled={f.title.length < 4} onClick={save}>
            Declare
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="What is happening">
          {(id) => <Input id={id} placeholder="Wallet passes are not updating" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />}
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Service">
            {(id) => (
              <Select id={id} value={f.service} onChange={(e) => setF({ ...f, service: e.target.value })}>
                {services.map((s) => (
                  <option key={s.id}>{s.name}</option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Impact">
            {(id) => (
              <Select id={id} value={f.impact} onChange={(e) => setF({ ...f, impact: e.target.value })}>
                <option value="degraded">Degraded · slower or partly failing</option>
                <option value="outage">Outage · not working</option>
              </Select>
            )}
          </Field>
        </div>
      </div>
    </Modal>
  );
}
