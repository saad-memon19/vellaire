'use client';

import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

/* One series per chart, in ink; grid and axes recessive; hover tooltip on every chart. */
const INK = '#17171B';
const GOLD = '#B08D4F';
const GRID = '#ECE6DA';
const AXIS = { fontSize: 12, fill: '#6E685F' };

const fmtDay = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const fmtMonth = (m: string) => new Date(`${m}-15T12:00:00Z`).toLocaleDateString('en-GB', { month: 'short', timeZone: 'UTC' });

function TipBox({ active, payload, label, unit, labelFmt }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-line bg-white px-3 py-2 text-[13px] shadow-lg">
      <div className="text-stone-2">{labelFmt ? labelFmt(label) : label}</div>
      <div className="font-medium text-ink">
        {Number(payload[0].value).toLocaleString()} {unit}
      </div>
    </div>
  );
}

/** Daily trend as a thin line with a soft fill. */
export function TrendChart({
  data,
  dataKey,
  unit,
  height = 240,
  color = INK,
  ticks = 5,
  hideY = false,
}: {
  data: { date: string; [k: string]: any }[];
  dataKey: string;
  unit: string;
  height?: number;
  color?: string;
  ticks?: number;
  /** The dashboard designs draw trends without a value axis */
  hideY?: boolean;
}) {
  const id = `g-${dataKey}-${color.replace('#', '')}`;
  const every = Math.max(Math.floor(data.length / ticks), 1);
  // Design-style date row: evenly spaced labels under the plot, never clipped at the edges
  const labels = hideY && data.length > 1 ? Array.from({ length: ticks }, (_, i) => data[Math.round((i * (data.length - 1)) / (ticks - 1))]!.date) : [];
  return (
    <div>
    <div style={{ height }} role="img" aria-label={`${unit} per day`}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: hideY ? 0 : 8, left: hideY ? 0 : -12, bottom: 0 }}>
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.14} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke={GRID} />
          <XAxis hide={hideY} dataKey="date" padding={{ left: 0, right: 0 }} tickFormatter={fmtDay} tick={AXIS} tickLine={false} axisLine={false} interval={every - 1} minTickGap={16} />
          <YAxis hide={hideY} tick={AXIS} tickLine={false} axisLine={false} allowDecimals={false} width={44} tickCount={4} />
          <Tooltip content={<TipBox unit={unit} labelFmt={fmtDay} />} cursor={{ stroke: '#B9AE98', strokeWidth: 1 }} />
          <Area isAnimationActive={false} type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2.2} fill={`url(#${id})`} activeDot={{ r: 4, stroke: '#fff', strokeWidth: 2 }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
    {labels.length > 0 && (
      <div className="mt-3 flex justify-between text-[12px] text-stone-2">
        {labels.map((d, i) => (
          <span key={i}>{fmtDay(d)}</span>
        ))}
      </div>
    )}
    </div>
  );
}

/** Monthly columns (e.g. MRR). */
export function MonthColumns({ data, dataKey, unit, height = 260, money }: { data: { month: string; [k: string]: any }[]; dataKey: string; unit: string; height?: number; money?: boolean }) {
  const f = (v: number) => (money ? `$${v >= 1000 ? `${Math.round(v / 1000)}k` : v}` : v.toLocaleString());
  return (
    <div style={{ height }} role="img" aria-label={`${unit} by month`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -4, bottom: 0 }} barCategoryGap="28%">
          <CartesianGrid vertical={false} stroke={GRID} />
          <XAxis dataKey="month" tickFormatter={fmtMonth} tick={AXIS} tickLine={false} axisLine={false} />
          <YAxis tick={AXIS} tickLine={false} axisLine={false} tickFormatter={f} width={52} />
          <Tooltip
            content={({ active, payload, label }: any) =>
              active && payload?.length ? (
                <div className="rounded-md border border-line bg-white px-3 py-2 text-[13px] shadow-lg">
                  <div className="text-stone-2">{new Date(`${label}-15T12:00:00Z`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' })}</div>
                  <div className="font-medium">{money ? `$${Number(payload[0].value).toLocaleString()}` : Number(payload[0].value).toLocaleString()} {money ? '' : unit}</div>
                </div>
              ) : null
            }
            cursor={{ fill: '#F4EFE5' }}
          />
          <Bar dataKey={dataKey} fill={INK} radius={[4, 4, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * Ranked horizontal bars as drawn in the designs: name | bar | value on one row.
 * `fade` steps the bar opacity down by rank (used for channel shares in gold).
 */
export function BarList({
  items,
  color = INK,
  fade = false,
  scale = 'max',
}: {
  items: { name: string; value: number; label?: string }[];
  color?: string;
  fade?: boolean;
  /** 'max' sizes bars against the largest value; 'percent' treats values as 0–100 */
  scale?: 'max' | 'percent';
}) {
  if (!items.length) return <p className="py-6 text-center text-[14px] text-stone-2">No data yet</p>;
  const max = scale === 'percent' ? 100 : Math.max(...items.map((i) => i.value), 1);
  return (
    <ul className="flex flex-col gap-3">
      {items.map((i, rank) => {
        const label = i.label ?? i.value.toLocaleString();
        return (
          <li key={i.name} className="grid items-center gap-3 text-[14px]" style={{ gridTemplateColumns: 'minmax(80px, 120px) 1fr 52px' }} title={`${i.name}: ${label}`}>
            <span className="truncate">{i.name}</span>
            <span className="h-2.5 rounded-full bg-[#F2EEE6]">
              <span className="block h-2.5 rounded-full" style={{ width: `${(i.value / max) * 100}%`, background: color, opacity: fade ? Math.max(1 - rank * 0.18, 0.4) : 1 }} />
            </span>
            <span className="text-right tabular-nums text-[#4E4A44]">{label}</span>
          </li>
        );
      })}
    </ul>
  );
}

export const chartColors = { INK, GOLD };
