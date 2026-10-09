'use client';

import { useState } from 'react';
import { BarList, chartColors, TrendChart } from '@/components/charts';
import { cx, Loading } from '@/components/ui';
import { useApi } from '@/lib/api';
import { NoCard } from '../no-card';

export default function MobileInsights() {
  const [range, setRange] = useState('30');
  const { data, error } = useApi<any>(`/me/insights?range=${range}`, { shouldRetryOnError: false });
  if (error) return <NoCard />;
  if (!data) return <Loading />;
  const [views, ...rest] = data.kpis;
  return (
    <div className="flex flex-col gap-5">
      <header className="flex items-center justify-between">
        <h1 className="font-display text-[34px]">Insights</h1>
        <div className="flex rounded-md border border-line bg-white p-0.5">
          {[
            ['7', 'Week'],
            ['30', 'Month'],
            ['90', '3 months'],
          ].map(([id, l]) => (
            <button key={id} type="button" aria-pressed={range === id} onClick={() => setRange(id)} className={cx('h-8 rounded-[5px] px-2.5 text-[12px]', range === id ? 'bg-ink text-cream' : 'text-stone')}>
              {l}
            </button>
          ))}
        </div>
      </header>
      <div className="rounded-xl border border-line bg-white p-4">
        <div className="flex items-baseline justify-between">
          <span className="text-[13px] text-stone-2">{views.label}</span>
          <span className={cx('text-[13px]', views.delta.startsWith('-') ? 'text-err' : 'text-ok')}>{views.delta}</span>
        </div>
        <div className="font-display text-[44px] leading-none">{views.value}</div>
        <div className="mt-3">
          <TrendChart data={data.daily} dataKey="views" unit="views" height={140} color={chartColors.GOLD} hideY />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {rest.map((t: any) => (
          <div key={t.label} className="rounded-xl border border-line bg-white p-3">
            <div className="text-[11px] leading-tight text-stone-2">{t.label}</div>
            <div className="mt-1 font-display text-[26px] leading-none">{t.value}</div>
            <div className={cx('mt-1 text-[11px]', t.delta.startsWith('-') ? 'text-err' : 'text-ok')}>{t.delta}</div>
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-line bg-white p-4">
        <div className="mb-4 text-[15px] font-medium">How people open your card</div>
        <BarList items={data.channels.map((c: any) => ({ name: c.name, value: c.pct, label: `${c.pct}%` }))} color={chartColors.GOLD} fade scale="percent" />
      </div>
      {data.cities.length > 0 && (
        <div className="rounded-xl border border-line bg-white p-4">
          <div className="mb-4 text-[15px] font-medium">Where</div>
          <BarList items={data.cities.map((c: any) => ({ name: c.name, value: c.v }))} color={chartColors.GOLD} fade />
        </div>
      )}
    </div>
  );
}
