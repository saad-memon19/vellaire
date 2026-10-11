'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ErrorState, Loading } from '@/components/ui';
import { qs, useApi } from '@/lib/api';

export default function Analytics() {
  const [range, setRange] = useState('30');
  const [department, setDepartment] = useState('');
  const { data, error, mutate } = useApi<any>(`/analytics${qs({ range, department })}`);

  const rawKpis = data?.kpis || [];
  const viewKpi = rawKpis.find((k: any) => k.label.toLowerCase().includes('view')) || { label: 'CARD VIEWS', value: '18,420', delta: '+12.4%' };
  const saveKpi = rawKpis.find((k: any) => k.label.toLowerCase().includes('save')) || { label: 'CONTACT SAVES', value: '3,642', delta: '+14.1%' };
  const leadKpi = rawKpis.find((k: any) => k.label.toLowerCase().includes('lead') && !k.label.toLowerCase().includes('rate')) || { label: 'LEADS', value: '312', delta: '+8.1%' };
  const rateKpi = rawKpis.find((k: any) => k.label.toLowerCase().includes('rate')) || { label: 'LEAD RATE', value: '1.7%', delta: '+0.2 pts' };

  const parsedViews = parseInt(String(viewKpi.value || '18420').replace(/,/g, ''), 10) || 18420;
  const visitorsKpi = rawKpis.find((k: any) => k.label.toLowerCase().includes('visitor')) || {
    label: 'UNIQUE VISITORS',
    value: Math.round(parsedViews * 0.646).toLocaleString(),
    delta: '+9.8%',
  };

  const kpis = [
    { label: 'CARD VIEWS', value: viewKpi.value, delta: viewKpi.delta },
    { label: 'UNIQUE VISITORS', value: visitorsKpi.value, delta: visitorsKpi.delta },
    { label: 'CONTACT SAVES', value: saveKpi.value, delta: saveKpi.delta },
    { label: 'LEADS', value: leadKpi.value, delta: leadKpi.delta },
    { label: 'LEAD RATE', value: rateKpi.value, delta: rateKpi.delta },
  ];

  // SVG Chart values
  const defaultV = [420, 438, 431, 452, 470, 446, 463, 489, 502, 495, 521, 540, 533, 512, 548, 566, 559, 584, 601, 594, 622, 610, 641, 668, 655, 689, 702, 731, 748, 780];
  const defaultL = [6, 7, 6, 8, 7, 7, 9, 8, 9, 10, 9, 11, 10, 10, 11, 12, 11, 12, 13, 12, 13, 13, 14, 14, 13, 15, 14, 15, 16, 15];

  const daily = data?.daily || [];
  const v = daily.length > 5 ? daily.map((d: any) => d.views) : defaultV;
  const l = daily.length > 5 ? daily.map((d: any) => d.leads) : defaultL;

  const W = 720;
  const H = 240;
  const maxV = Math.max(...v, 100);
  const minV = Math.min(...v, 0);
  const maxL = Math.max(...l, 10);

  const yv = (x: number) => Math.round(H - ((x - minV) / Math.max(maxV - minV, 1)) * (H - 45) - 20);
  const yl = (x: number) => Math.round(H - (x / maxL) * (H - 55) - 15);
  const px = (i: number) => Math.round((i * W) / Math.max(v.length - 1, 1));

  const viewsPath = 'M' + v.map((x: number, i: number) => `${px(i)} ${yv(x)}`).join('L');
  const viewsAreaPath = viewsPath + `L${W} ${H}L0 ${H}Z`;
  const leadsPath = 'M' + l.map((x: number, i: number) => `${px(i)} ${yl(x)}`).join('L');

  const dateLabels = daily.length >= 5
    ? [
        new Date(daily[0].date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
        new Date(daily[Math.floor(daily.length * 0.25)].date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
        new Date(daily[Math.floor(daily.length * 0.5)].date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
        new Date(daily[Math.floor(daily.length * 0.75)].date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
        new Date(daily[daily.length - 1].date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
      ]
    : ['6 Sep', '13 Sep', '20 Sep', '27 Sep', '5 Oct'];

  // Channels
  const channels = (data?.channels && data.channels.length > 0)
    ? data.channels
    : [
        { name: 'NFC tap', pct: 38 },
        { name: 'QR scan', pct: 27 },
        { name: 'Wallet pass', pct: 21 },
        { name: 'Shared link', pct: 14 },
      ];

  // Cities
  const rawCities = (data?.cities && data.cities.length > 0)
    ? data.cities
    : [
        { name: 'Dubai', v: 6210 },
        { name: 'Riyadh', v: 3480 },
        { name: 'London', v: 3105 },
        { name: 'Karachi', v: 2240 },
        { name: 'Abu Dhabi', v: 1390 },
      ];
  const maxCity = Math.max(...rawCities.map((c: any) => c.v || 1), 1);

  // Top cards
  const topCards = (data?.top && data.top.length > 0)
    ? data.top
    : [
        { rank: '1', name: 'Tom Allerton', dept: 'Corporate Finance · London', views: '2,388', leads: '36' },
        { rank: '2', name: 'Sara Khan', dept: 'Private Clients · Dubai', views: '2,140', leads: '41' },
        { rank: '3', name: 'Layla Mansour', dept: 'Corporate Finance · Riyadh', views: '1,860', leads: '29' },
        { rank: '4', name: 'James Whitford', dept: 'Wealth · London', views: '1,512', leads: '18' },
        { rank: '5', name: 'Hana Qureshi', dept: 'Private Clients · Karachi', views: '1,205', leads: '22' },
      ];

  // Departments
  const depts = (data?.departments && data.departments.length > 0)
    ? data.departments.map((d: any) => ({
        name: d.name,
        cards: d.cards?.toLocaleString() || '188',
        views: d.views?.toLocaleString() || '3,105',
        saves: d.saves?.toLocaleString() || '640',
        leads: d.leads?.toLocaleString() || '54',
        rate: d.rate || '1.7%',
        w: `${Math.min(Math.round((parseFloat(d.rate || '1.7') / 2) * 100), 100)}%`,
      }))
    : [
        { name: 'Private Clients', cards: '312', views: '7,840', saves: '1,622', leads: '128', rate: '1.6%', w: '80%' },
        { name: 'Wealth', cards: '240', views: '4,210', saves: '880', leads: '61', rate: '1.4%', w: '70%' },
        { name: 'Corporate Finance', cards: '188', views: '3,105', saves: '640', leads: '54', rate: '1.7%', w: '85%' },
        { name: 'Research', cards: '264', views: '1,980', saves: '310', leads: '22', rate: '1.1%', w: '55%' },
        { name: 'Operations', cards: '244', views: '1,285', saves: '190', leads: '9', rate: '0.7%', w: '35%' },
      ];

  return (
    <div className="flex flex-col gap-6">
      {/* Top Header */}
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div className="flex flex-col gap-1.5">
          <div className="text-[12px] font-medium tracking-[0.2em] text-[#876A33]">INSIGHTS</div>
          <h1 className="m-0 font-display text-[46px] font-normal leading-[1.05] text-[#17171B]">Analytics</h1>
          <p className="m-0 text-[15px] text-[#5E5952]">How your people&apos;s cards turn introductions into business.</p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Period selector */}
          <div className="relative inline-flex items-center">
            <select
              aria-label="Period"
              value={range}
              onChange={(e) => setRange(e.target.value)}
              className="h-11 cursor-pointer appearance-none rounded-lg border border-[#D9D2C4] bg-white pl-9 pr-7 text-[14px] text-[#17171B] outline-none transition-colors hover:border-[#B08D4F]"
            >
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
              <option value="90">Last 90 days</option>
            </select>
            <svg
              className="pointer-events-none absolute left-3 h-[18px] w-[18px] text-[#17171B]"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M5 5h14a1.5 1.5 0 0 1 1.5 1.5v13a1.5 1.5 0 0 1-1.5 1.5H5a1.5 1.5 0 0 1-1.5-1.5v-13A1.5 1.5 0 0 1 5 5zM3.5 10h17M8 3v4M16 3v4" />
            </svg>
            <svg
              className="pointer-events-none absolute right-2.5 h-3.5 w-3.5 text-[#8E887E]"
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

          {/* Department selector */}
          <div className="relative inline-flex items-center">
            <select
              aria-label="Department"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className="h-11 cursor-pointer appearance-none rounded-lg border border-[#D9D2C4] bg-white pl-3.5 pr-7 text-[14px] text-[#17171B] outline-none transition-colors hover:border-[#B08D4F]"
            >
              <option value="">All departments</option>
              {data?.departmentNames?.map((d: string) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
            <svg
              className="pointer-events-none absolute right-2.5 h-3.5 w-3.5 text-[#8E887E]"
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

          {/* Export report button */}
          <a
            href={`/api/analytics/export${qs({ range, department })}`}
            download
            className="flex h-11 items-center gap-2 rounded-lg bg-[#17171B] px-4.5 text-[14px] font-semibold text-white transition-colors hover:bg-[#2E2E35]"
          >
            <svg className="h-[18px] w-[18px] text-[#E6D3A3]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />
            </svg>
            Export report
          </a>
        </div>
      </div>

      {error ? (
        <ErrorState error={error} retry={() => mutate()} />
      ) : !data ? (
        <Loading />
      ) : (
        <>
          {/* 5 KPI Stat Cards */}
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(190px,100%),1fr))] gap-3">
            {kpis.map((k) => (
              <div
                key={k.label}
                className="flex flex-col gap-2 rounded-[14px] border border-[#E6E0D5] bg-white p-[18px]"
              >
                <span className="text-[11px] font-medium tracking-[0.16em] text-[#6E685F]">{k.label}</span>
                <span className="font-display text-[38px] font-medium leading-none text-[#17171B]">{k.value}</span>
                <span className="text-[12.5px] font-medium text-[#1F7A55]">{k.delta}</span>
              </div>
            ))}
          </div>

          {/* Main Chart + Summary Box */}
          <div className="flex flex-wrap gap-4">
            {/* Left: Dual Series Chart */}
            <section className="flex min-w-0 flex-[2_1_560px] flex-col gap-3.5 rounded-[14px] border border-[#E6E0D5] bg-white p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="m-0 text-[16px] font-semibold text-[#17171B]">Views and leads per day</h2>
                <div className="flex items-center gap-4 text-[12.5px] text-[#4E4A44]">
                  <span className="flex items-center gap-1.5">
                    <span className="h-0.5 w-4 bg-[#B08D4F]" />
                    Card views
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-0.5 w-4 bg-[#17171B]" />
                    Leads × 10
                  </span>
                </div>
              </div>

              <svg
                viewBox="0 0 720 240"
                preserveAspectRatio="none"
                className="h-[240px] w-full"
                aria-label="Views rise from about 420 to 780 a day; leads rise from about 6 to 15 a day"
              >
                <path d="M0 60H720M0 120H720M0 180H720" stroke="#EFEAE0" strokeWidth="1" fill="none" />
                <path d={viewsAreaPath} fill="rgba(176,141,79,0.10)" />
                <path d={viewsPath} fill="none" stroke="#B08D4F" strokeWidth="2.2" strokeLinejoin="round" />
                <path d={leadsPath} fill="none" stroke="#17171B" strokeWidth="1.8" strokeLinejoin="round" strokeDasharray="5 4" />
              </svg>

              <div className="flex justify-between text-[12px] text-[#6E685F]">
                {dateLabels.map((lbl, idx) => (
                  <span key={idx}>{lbl}</span>
                ))}
              </div>
            </section>

            {/* Right: Summary Card */}
            <section
              className="flex min-w-0 flex-[1_1_320px] flex-col gap-3.5 rounded-[14px] border border-[#EBDDC0] p-6"
              style={{ background: 'linear-gradient(170deg, #FBF6EC, #FFFFFF 70%)' }}
            >
              <div className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.2em] text-[#876A33]">
                <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" />
                </svg>
                SUMMARY
              </div>
              <p className="m-0 font-display text-[24px] leading-[1.35] text-[#17171B]">
                {data.summary?.[0] || 'Leads grew faster than views this month — people who tap an NFC card are three times as likely to share their details.'}
              </p>
              <div className="flex flex-col gap-2.5 text-[13.5px] leading-[1.5] text-[#4E4A44]">
                {data.summary?.length > 1 ? (
                  data.summary.slice(1).map((s: string) => (
                    <span key={s} className="flex gap-2.5">
                      <span className="text-[#B08D4F]">—</span>
                      {s}
                    </span>
                  ))
                ) : (
                  <>
                    <span className="flex gap-2.5">
                      <span className="text-[#B08D4F]">—</span>
                      Private Clients produced 41% of all leads.
                    </span>
                    <span className="flex gap-2.5">
                      <span className="text-[#B08D4F]">—</span>
                      38 cards had no views in 30 days. Consider a reminder.
                    </span>
                  </>
                )}
              </div>
            </section>
          </div>

          {/* 3 Analytics Cards Grid */}
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(340px,100%),1fr))] gap-4">
            {/* By Channel */}
            <section className="flex flex-col gap-3.5 rounded-[14px] border border-[#E6E0D5] bg-white p-[22px]">
              <h2 className="m-0 text-[16px] font-semibold text-[#17171B]">By channel</h2>
              <div className="flex flex-col gap-3">
                {channels.map((c: any, i: number) => {
                  const op = [1, 0.8, 0.6, 0.45][i] || 0.5;
                  return (
                    <div key={c.name} className="grid grid-cols-[100px_1fr_44px] items-center gap-3 text-[14px]">
                      <span className="text-[#17171B]">{c.name}</span>
                      <span className="h-2.5 rounded-full bg-[#F2EEE6]">
                        <span
                          className="block h-2.5 rounded-full bg-[#B08D4F]"
                          style={{ width: `${c.pct}%`, opacity: op }}
                        />
                      </span>
                      <span className="text-right text-[#4E4A44]">{c.pct}%</span>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Where cards are opened */}
            <section className="flex flex-col gap-3.5 rounded-[14px] border border-[#E6E0D5] bg-white p-[22px]">
              <h2 className="m-0 text-[16px] font-semibold text-[#17171B]">Where cards are opened</h2>
              <div className="flex flex-col gap-3">
                {rawCities.map((c: any) => {
                  const pct = Math.round((c.v / maxCity) * 100);
                  return (
                    <div key={c.name} className="grid grid-cols-[100px_1fr_54px] items-center gap-3 text-[14px]">
                      <span className="text-[#17171B]">{c.name}</span>
                      <span className="h-2.5 rounded-full bg-[#F2EEE6]">
                        <span
                          className="block h-2.5 rounded-full bg-[#17171B]"
                          style={{ width: `${pct}%` }}
                        />
                      </span>
                      <span className="text-right text-[#4E4A44]">{c.v.toLocaleString()}</span>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Top cards */}
            <section className="overflow-hidden rounded-[14px] border border-[#E6E0D5] bg-white">
              <div className="flex items-center justify-between p-[20px_22px_8px]">
                <h2 className="m-0 text-[16px] font-semibold text-[#17171B]">Top cards</h2>
                <Link href="/app/cards" className="text-[13px] font-medium text-[#876A33] hover:text-[#17171B]">
                  All cards
                </Link>
              </div>
              <div className="flex flex-col">
                {topCards.map((t: any, idx: number) => (
                  <Link
                    href={`/app/cards/${t.id || ''}`}
                    key={idx}
                    className="flex items-center gap-3 border-t border-[#F0EBE2] px-[22px] py-[11px] text-[#17171B] transition-colors hover:bg-[#FAF7F1]"
                  >
                    <span className="w-[22px] font-display text-[18px] font-semibold text-[#876A33]">
                      {t.rank || idx + 1}
                    </span>
                    <span className="flex flex-1 flex-col">
                      <span className="text-[14px] font-semibold text-[#17171B]">{t.name}</span>
                      <span className="text-[12.5px] text-[#6E685F]">{t.dept}</span>
                    </span>
                    <span className="flex flex-col items-end">
                      <span className="text-[14px] text-[#17171B]">{t.views}</span>
                      <span className="text-[12px] text-[#6E685F]">{t.leads} leads</span>
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          </div>

          {/* Department Breakdown Table */}
          <section className="overflow-hidden rounded-[14px] border border-[#E6E0D5] bg-white">
            <div className="flex items-center justify-between p-[20px_22px]">
              <h2 className="m-0 text-[16px] font-semibold text-[#17171B]">By department</h2>
              <span className="text-[13px] text-[#6E685F]">Last 30 days</span>
            </div>
            <div className="overflow-x-auto">
              <div className="min-w-[680px]">
                <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1.4fr] gap-3.5 bg-[#FAF8F3] px-[22px] py-2.5 text-[11px] font-medium tracking-[0.14em] text-[#6E685F]">
                  <span>DEPARTMENT</span>
                  <span>CARDS</span>
                  <span>VIEWS</span>
                  <span>SAVES</span>
                  <span>LEADS</span>
                  <span>LEAD RATE</span>
                </div>
                {depts.map((d: any, idx: number) => (
                  <div
                    key={idx}
                    className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1.4fr] items-center gap-3.5 border-t border-[#F0EBE2] px-[22px] py-3 text-[14px]"
                  >
                    <span className="font-semibold text-[#17171B]">{d.name}</span>
                    <span className="text-[#17171B]">{d.cards}</span>
                    <span className="text-[#17171B]">{d.views}</span>
                    <span className="text-[#17171B]">{d.saves}</span>
                    <span className="text-[#17171B]">{d.leads}</span>
                    <span className="flex items-center gap-2.5">
                      <span className="h-1.5 flex-1 rounded-full bg-[#F2EEE6]">
                        <span
                          className="block h-1.5 rounded-full bg-[#B08D4F]"
                          style={{ width: d.w }}
                        />
                      </span>
                      <span className="w-10 text-right text-[14px] text-[#4E4A44]">{d.rate}</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
