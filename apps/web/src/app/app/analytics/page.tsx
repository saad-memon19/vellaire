'use client';

import Link from 'next/link';
import { useState } from 'react';
import { BarList, chartColors, TrendChart } from '@/components/charts';
import { Icon } from '@/components/icons';
import { ErrorState, LinkButton, Loading, PageHeader, Panel, PanelHeader, Select, Stat, Table, Td } from '@/components/ui';
import { qs, useApi } from '@/lib/api';

export default function Analytics() {
  const [range, setRange] = useState('30');
  const [department, setDepartment] = useState('');
  const { data, error, mutate } = useApi<any>(`/analytics${qs({ range, department })}`);

  return (
    <div>
      <PageHeader
        eyebrow="Insights"
        title="Analytics"
        desc="How your people's cards turn introductions into business."
        actions={
          <>
            <Select aria-label="Period" value={range} onChange={(e) => setRange(e.target.value)} className="w-40">
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
              <option value="90">Last 90 days</option>
            </Select>
            <Select aria-label="Department" value={department} onChange={(e) => setDepartment(e.target.value)} className="w-48">
              <option value="">All departments</option>
              {data?.departmentNames?.map((d: string) => (
                <option key={d}>{d}</option>
              ))}
            </Select>
            <LinkButton href={`/api/analytics/export${qs({ range, department })}`} icon="download">
              Export report
            </LinkButton>
          </>
        }
      />
      {error ? (
        <ErrorState error={error} retry={() => mutate()} />
      ) : !data ? (
        <Loading />
      ) : (
        <div className="flex flex-col gap-6">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {data.kpis.map((k: any) => (
              <Stat key={k.label} {...k} />
            ))}
          </div>

          <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
            <Panel>
              <PanelHeader title="Views and leads per day" sub={`Last ${data.days} days`} />
              <div className="mb-1 text-[13px] font-medium">Card views</div>
              <TrendChart data={data.daily} dataKey="views" unit="views" height={200} color={chartColors.GOLD} hideY />
              <div className="mb-1 mt-6 text-[13px] font-medium">Leads</div>
              <TrendChart data={data.daily} dataKey="leads" unit="leads" height={120} hideY />
            </Panel>
            <section className="flex flex-col gap-3.5 rounded-[14px] border border-gold-line p-6" style={{ background: 'linear-gradient(170deg, #FBF6EC, #FFFFFF 70%)' }}>
              <div className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.2em] text-gold-text">
                <Icon name="sparkle" size={18} /> SUMMARY
              </div>
              {data.summary.length === 0 ? (
                <p className="m-0 text-[14px] text-stone">Not enough activity yet to summarise.</p>
              ) : (
                <>
                  <p className="m-0 font-display text-[24px] leading-[1.35]">{data.summary[0]}</p>
                  <div className="flex flex-col gap-2.5 text-[13.5px] leading-[1.5] text-[#4E4A44]">
                    {data.summary.slice(1).map((s: string) => (
                      <span key={s} className="flex gap-2.5">
                        <span className="text-gold">—</span>
                        {s}
                      </span>
                    ))}
                  </div>
                </>
              )}
            </section>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <Panel>
              <PanelHeader title="By channel" sub="Share of card views" />
              <BarList items={data.channels.map((c: any) => ({ name: c.name, value: c.pct, label: `${c.pct}%` }))} color={chartColors.GOLD} fade scale="percent" />
            </Panel>
            <Panel>
              <PanelHeader title="Where cards are opened" sub="Views by city" />
              <BarList items={data.cities.map((c: any) => ({ name: c.name, value: c.v }))} />
            </Panel>
            <Panel>
              <PanelHeader title="Top cards" action={<Link href="/app/cards" className="text-[14px] text-gold-text hover:text-ink">All cards</Link>} />
              <ol className="flex flex-col divide-y divide-linen">
                {data.top.map((t: any) => (
                  <li key={t.id}>
                    <Link href={`/app/cards/${t.id}`} className="flex items-center gap-3 py-2.5 hover:opacity-80">
                      <span className="w-5 font-display text-[18px] text-gold-text">{t.rank}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14px] font-medium">{t.name}</span>
                        <span className="block truncate text-[12px] text-stone-2">{t.dept}</span>
                      </span>
                      <span className="text-right text-[12px] text-stone">
                        {t.views} views
                        <br />
                        {t.leads} leads
                      </span>
                    </Link>
                  </li>
                ))}
              </ol>
            </Panel>
          </div>

          <Panel pad={false}>
            <div className="p-5">
              <PanelHeader title="By department" sub={`Last ${data.days} days`} />
            </div>
            <Table head={['Department', 'Cards', 'Views', 'Saves', 'Leads', 'Lead rate']}>
              {data.departments.map((d: any) => (
                <tr key={d.name} className="hover:bg-pearl">
                  <Td className="font-medium">{d.name}</Td>
                  <Td className="tabular-nums">{d.cards}</Td>
                  <Td className="tabular-nums">{d.views}</Td>
                  <Td className="tabular-nums">{d.saves}</Td>
                  <Td className="tabular-nums">{d.leads}</Td>
                  <Td>
                    <span className="flex items-center gap-2.5">
                      <span className="h-1.5 flex-1 rounded-full bg-[#F2EEE6]">
                        <span className="block h-1.5 rounded-full bg-gold" style={{ width: `${Math.min(parseFloat(d.rate) * 10, 100)}%` }} />
                      </span>
                      <span className="w-10 text-right tabular-nums text-[#4E4A44]">{d.rate}</span>
                    </span>
                  </Td>
                </tr>
              ))}
            </Table>
          </Panel>
          <p className="flex items-center gap-2 text-[13px] text-stone-2">
            <Icon name="info" size={15} /> A view is counted when the online card opens. Saves are contact downloads; leads are people who shared their details.
          </p>
        </div>
      )}
    </div>
  );
}
