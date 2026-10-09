'use client';

import Link from 'next/link';
import { useState } from 'react';
import { MonthColumns } from '@/components/charts';
import { Icon } from '@/components/icons';
import { Avatar, cx, ErrorState, Loading, PageHeader, Panel, PanelHeader, Segmented, Stat, StatusBadge, Table, Td } from '@/components/ui';
import { api, useApi } from '@/lib/api';
import { HealthBar } from '@/components/health-bar';

export default function CommandCenter() {
  const [period, setPeriod] = useState<'week' | 'month' | 'quarter'>('month');
  const { data, error, mutate } = useApi<any>(`/console/overview?period=${period}`);
  const { data: demos, mutate: reDemos } = useApi<any[]>('/console/demos');
  if (error) return <ErrorState error={error} retry={() => mutate()} />;
  return (
    <div>
      <PageHeader
        eyebrow="Command center"
        title="The business at a glance"
        actions={
          <Segmented
            items={[
              { id: 'week', name: 'Week' },
              { id: 'month', name: 'Month' },
              { id: 'quarter', name: 'Quarter' },
            ]}
            value={period}
            onChange={setPeriod}
          />
        }
      />
      {!data ? (
        <Loading />
      ) : (
        <div className="flex flex-col gap-6">
          <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
            {data.kpis.map((k: any) => (
              <Stat key={k.label} label={k.label} value={k.value} delta={k.delta} tone={k.label === 'Churned' ? (k.value === '0' ? 'up' : 'down') : undefined} />
            ))}
          </div>
          <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
            <Panel>
              <PanelHeader title="Monthly recurring revenue" sub="Last 12 months · USD, from invoices" />
              <MonthColumns data={data.months} dataKey="mrr" unit="MRR" money />
            </Panel>
            <Panel>
              <PanelHeader title="Alerts" sub={`${data.alerts.length} open`} />
              {data.alerts.length === 0 ? (
                <p className="py-6 text-center text-[14px] text-stone-2">Nothing needs you</p>
              ) : (
                <ul className="flex flex-col divide-y divide-linen">
                  {data.alerts.map((a: any) => (
                    <li key={a.t}>
                      <Link href={a.href} className="flex items-start gap-3 py-3 hover:opacity-80">
                        <Icon
                          name={a.tone === 'info' ? 'info' : 'alert'}
                          size={17}
                          className={cx('mt-0.5', a.tone === 'error' ? 'text-err' : a.tone === 'warning' ? 'text-warn' : 'text-info')}
                        />
                        <span>
                          <span className="block text-[14px] font-medium">{a.t}</span>
                          <span className="block text-[13px] text-stone-2">{a.s}</span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>
          <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
            <Panel pad={false}>
              <div className="p-5 pb-0">
                <PanelHeader
                  title="Companies needing attention"
                  action={
                    <Link href="/console/companies" className="text-[14px] text-gold-text hover:text-ink">
                      All companies
                    </Link>
                  }
                />
              </div>
              <Table head={['Company', 'Plan', 'Seats', 'Health', 'Status']}>
                {data.attention.map((c: any) => (
                  <tr key={c.id} className="hover:bg-pearl">
                    <Td>
                      <Link href={`/console/companies/${c.id}`} className="flex items-center gap-3">
                        <Avatar name={c.name} size={32} />
                        <span>
                          <span className="block font-medium">{c.name}</span>
                          <span className="block text-[13px] text-stone-2">{c.country}</span>
                        </span>
                      </Link>
                    </Td>
                    <Td>{c.plan}</Td>
                    <Td className="tabular-nums">{c.seats}</Td>
                    <Td>
                      <HealthBar h={c.h} />
                    </Td>
                    <Td>
                      <StatusBadge status={c.status} />
                    </Td>
                  </tr>
                ))}
              </Table>
            </Panel>
            <Panel>
              <PanelHeader
                title="NFC fulfilment"
                action={
                  <Link href="/console/nfc" className="text-[14px] text-gold-text hover:text-ink">
                    Open board
                  </Link>
                }
              />
              <ul className="grid grid-cols-2 gap-3">
                {data.nfc.map((n: any) => (
                  <li key={n.stage} className="rounded-lg bg-pearl p-3">
                    <div className="text-[12px] text-stone-2">{n.name}</div>
                    <div className="font-display text-[28px] leading-none">{n.count.toLocaleString()}</div>
                    <div className="text-[11px] text-stone-2">cards</div>
                  </li>
                ))}
              </ul>
              {data.nfcPastDue > 0 && (
                <p className="mt-4 flex items-center gap-2 text-[13px] text-err">
                  <Icon name="alert" size={15} /> {data.nfcPastDue} orders past their due date
                </p>
              )}
            </Panel>
          </div>
          <Panel pad={false}>
            <div className="p-5 pb-0">
              <PanelHeader title="Demo requests" sub="From the website" />
            </div>
            {!demos?.length ? (
              <p className="px-5 pb-6 text-[14px] text-stone-2">No requests yet</p>
            ) : (
              <Table head={['Person', 'Company', 'Size · HR', 'When', 'Status']}>
                {demos.map((d) => (
                  <tr key={d.id}>
                    <Td>
                      <span className="block font-medium">{d.name}</span>
                      <a href={`mailto:${d.email}`} className="text-[13px] text-gold-text">
                        {d.email}
                      </a>
                    </Td>
                    <Td>{d.company}</Td>
                    <Td className="text-stone">{[d.size, d.hr].filter(Boolean).join(' · ')}</Td>
                    <Td className="text-stone">{d.when}</Td>
                    <Td>
                      <select
                        aria-label="Status"
                        value={d.status}
                        onChange={async (e) => {
                          await api.patch(`/console/demos/${d.id}`, { status: e.target.value });
                          reDemos();
                        }}
                        className="h-9 rounded-md border border-line-strong bg-white px-2 text-[13px]"
                      >
                        {['new', 'contacted', 'won', 'lost'].map((s) => (
                          <option key={s}>{s}</option>
                        ))}
                      </select>
                    </Td>
                  </tr>
                ))}
              </Table>
            )}
          </Panel>
        </div>
      )}
    </div>
  );
}
