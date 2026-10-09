'use client';

import { ErrorState, Loading, PageHeader } from '@/components/ui';
import { useApi } from '@/lib/api';
import { Kpis, Section } from '../parts';

const SERIES = [
  { key: 'expansion', name: 'Expansion', color: '#17171B' },
  { key: 'new', name: 'New', color: '#B08D4F' },
  { key: 'lost', name: 'Lost', color: '#C98A92' },
] as const;
const CHART_H = 200;
const usd = (n: number) => `$${n.toLocaleString()}`;

/** Cohort cell: deeper gold the more customers are still paying. */
const cohortStyle = (v: number) => ({ background: `rgba(176,141,79,${(0.12 + (Math.max(v, 70) - 70) / 50).toFixed(2)})`, color: v > 92 ? '#FFFFFF' : '#17171B' });

export default function RevenueAnalytics() {
  const { data, error, mutate } = useApi<any>('/console/revenue/analytics');
  if (error) return <ErrorState error={error} retry={() => mutate()} />;
  const peak = data ? Math.max(1, ...data.movement.map((m: any) => m.new + m.expansion), ...data.movement.map((m: any) => m.lost)) : 1;
  const hasMovement = data?.movement.some((m: any) => m.new || m.expansion || m.lost);

  return (
    <div className="flex flex-col gap-5.5 [&>header]:mb-0">
      <PageHeader eyebrow="Revenue" title="Revenue analytics" desc="Where revenue comes from and where it is lost, from invoices and live subscriptions." />
      {!data ? (
        <Loading />
      ) : (
        <>
          <Kpis items={data.kpis} />
          <div className="flex flex-wrap gap-4">
            <Section className="min-w-0 flex-[2_1_560px]">
              <div className="flex flex-col gap-3.5 px-5.5 pb-5.5">
                <div className="flex flex-wrap items-center justify-between gap-3 pt-5">
                  <h2 className="text-[16px] font-semibold">Monthly revenue movement</h2>
                  <div className="flex gap-3.5 text-[12.5px] text-[#4E4A44]">
                    {SERIES.map((s) => (
                      <span key={s.key} className="flex items-center gap-1.5">
                        <span className="h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} />
                        {s.name}
                      </span>
                    ))}
                  </div>
                </div>
                {hasMovement ? (
                  <>
                    <div className="grid grid-cols-12 items-end gap-2 border-b border-linen pt-2.5" style={{ height: CHART_H + 40 }}>
                      {data.movement.map((m: any) => (
                        <span key={m.m} className="flex h-full flex-col justify-end" title={`${m.m}: new ${usd(m.new)}, expansion ${usd(m.expansion)}, lost ${usd(m.lost)}`}>
                          <span className="block rounded-t-[3px] bg-ink" style={{ height: (m.expansion / peak) * CHART_H }} />
                          <span className="block bg-gold" style={{ height: (m.new / peak) * CHART_H }} />
                          <span className="mt-0.5 block rounded-b-[3px]" style={{ height: (m.lost / peak) * (CHART_H / 3), background: '#C98A92' }} />
                        </span>
                      ))}
                    </div>
                    <div className="grid grid-cols-12 gap-2 text-center text-[11.5px] text-stone-2">
                      {data.movement.map((m: any) => (
                        <span key={m.m}>{m.m}</span>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="py-16 text-center text-[14px] text-stone-2">No invoices in the last 12 months yet</p>
                )}
              </div>
            </Section>
            <Section className="min-w-0 flex-[1_1_320px]">
              <div className="flex flex-col gap-3.5 p-5.5">
                <ShareBars title="Share by region" rows={data.regions} color="#B08D4F" />
                <ShareBars title="Share by plan" rows={data.plans} color="#17171B" />
              </div>
            </Section>
          </div>
          <Section title="Customers still with us, by start month" action={<span className="text-[13px] text-stone-2">% of companies still paying</span>}>
            <div className="scrollbar-thin overflow-x-auto px-5 pb-5">
              <div className="flex min-w-160 flex-col gap-1.5">
                <div className="grid grid-cols-[110px_repeat(6,minmax(0,1fr))] gap-1.5 text-center text-[11px] uppercase tracking-[0.12em] text-stone-2">
                  <span className="text-left">Cohort</span>
                  {Array.from({ length: 6 }, (_, k) => (
                    <span key={k}>Month {k + 1}</span>
                  ))}
                </div>
                {data.cohorts.map((c: any) => (
                  <div key={c.m} className="grid grid-cols-[110px_repeat(6,minmax(0,1fr))] gap-1.5 text-[12.5px]">
                    <span className="self-center text-[#4E4A44]">
                      {c.m} <span className="text-stone-2">· {c.size}</span>
                    </span>
                    {c.v.map((v: number | null, k: number) => (
                      <span key={k} className="flex h-8.5 items-center justify-center rounded-md" style={v === null ? undefined : cohortStyle(v)}>
                        {v === null ? '' : `${v}%`}
                      </span>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </Section>
        </>
      )}
    </div>
  );
}

function ShareBars({ title, rows, color }: { title: string; rows: { n: string; p: number }[]; color: string }) {
  return (
    <>
      <h2 className="text-[16px] font-semibold [&:not(:first-child)]:mt-2">{title}</h2>
      {rows.length === 0 && <p className="text-[13px] text-stone-2">No paying companies yet</p>}
      {rows.map((g) => (
        <div key={g.n} className="grid grid-cols-[110px_1fr_44px] items-center gap-3 text-[14px]">
          <span className="truncate">{g.n}</span>
          <span className="h-2.5 rounded-full bg-[#F2EEE6]">
            <span className="block h-2.5 rounded-full" style={{ width: `${g.p}%`, background: color }} />
          </span>
          <span className="text-right tabular-nums text-[#4E4A44]">{g.p}%</span>
        </div>
      ))}
    </>
  );
}
