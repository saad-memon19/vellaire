'use client';

import { useState } from 'react';
import { useToast } from '@/components/toast';
import { Badge, cx, Tone } from '@/components/ui';

/* Building blocks shared by the owner console's platform pages, drawn to the console artboards. */

const NOTE_TONE: Record<string, string> = { ok: 'text-ok', warn: 'text-warn', err: 'text-err' };

export interface Kpi {
  label: string;
  value: string;
  note?: string;
  tone?: 'ok' | 'warn' | 'err';
}

export function Kpis({ items }: { items: Kpi[] }) {
  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(min(190px,100%),1fr))] gap-3">
      {items.map((k) => (
        <div key={k.label} className="flex flex-col gap-2 rounded-[14px] border border-linen bg-white p-4.5">
          <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-stone-2">{k.label}</span>
          <span className="font-display text-[34px] font-medium leading-none">{k.value}</span>
          {k.note && <span className={cx('text-[12.5px]', NOTE_TONE[k.tone || ''] || 'text-stone-2')}>{k.note}</span>}
        </div>
      ))}
    </div>
  );
}

/** White panel with an optional header row. */
export function Section({
  title,
  sub,
  action,
  children,
  className,
}: {
  title?: React.ReactNode;
  sub?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cx('overflow-hidden rounded-[14px] border border-linen bg-white', className)}>
      {(title || action) && (
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4.5">
          <div>
            {title && <h2 className="text-[16px] font-semibold">{title}</h2>}
            {sub && <p className="mt-0.5 text-[13px] text-stone-2">{sub}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

/** Grid-based table with the console's sand header row. `cols` is a grid-template-columns value. */
export function GridTable({ cols, head, minWidth = 760, children }: { cols: string; head: React.ReactNode[]; minWidth?: number; children: React.ReactNode }) {
  return (
    <div className="scrollbar-thin overflow-x-auto">
      <div style={{ minWidth }} role="table">
        <div role="row" className="grid gap-3.5 bg-[#FAF8F3] px-5 py-2.5 text-[11px] font-medium uppercase tracking-[0.14em] text-stone-2" style={{ gridTemplateColumns: cols }}>
          {head.map((h, i) => (
            <span key={i} role="columnheader">
              {h}
            </span>
          ))}
        </div>
        {children}
      </div>
    </div>
  );
}

export function GridRow({ cols, children, className }: { cols: string; children: React.ReactNode; className?: string }) {
  return (
    <div role="row" className={cx('grid items-center gap-3.5 border-t border-[#F0EBE2] px-5 py-3 text-[14px] hover:bg-[#FAF7F1]', className)} style={{ gridTemplateColumns: cols }}>
      {children}
    </div>
  );
}

export const EmptyRow = ({ children }: { children: React.ReactNode }) => <p className="border-t border-[#F0EBE2] px-5 py-8 text-center text-[14px] text-stone-2">{children}</p>;

const STATUS: Record<string, [string, Tone]> = {
  active: ['Active', 'ok'],
  live: ['Live', 'ok'],
  healthy: ['Healthy', 'ok'],
  done: ['Done', 'ok'],
  on: ['On', 'ok'],
  trial: ['Trial', 'info'],
  scheduled: ['Scheduled', 'info'],
  draft: ['Draft', 'neutral'],
  off: ['Off', 'neutral'],
  archived: ['Archived', 'neutral'],
  retired: ['Retired', 'neutral'],
  invited: ['Invited', 'neutral'],
  unused: ['Not used', 'neutral'],
  none: ['Not set up', 'neutral'],
  pending: ['Pending', 'warn'],
  degraded: ['Degraded', 'warn'],
  review: ['Review', 'warn'],
  used_up: ['Used up', 'warn'],
  expired: ['Expired', 'neutral'],
  suspended: ['Suspended', 'err'],
  disabled: ['Suspended', 'err'],
  down: ['Down', 'err'],
  error: ['Error', 'err'],
  open: ['Open', 'err'],
  resolved: ['Resolved', 'ok'],
};

export function Pill({ status, label }: { status: string; label?: string }) {
  const [text, tone] = STATUS[status] || [status, 'neutral'];
  return <Badge tone={tone}>{label || text}</Badge>;
}

export type Level = 'ok' | 'warn' | 'err';
const LEVEL_COLOR: Record<Level, string> = { ok: '#1F7A55', warn: '#8A5A12', err: '#A3283A' };

/** Thin progress bar with its number. Gold by default; a `level` colours both bar and number. */
export function Meter({ pct, label, level }: { pct: number; label?: string; level?: Level }) {
  const color = level ? LEVEL_COLOR[level] : '#B08D4F';
  return (
    <span className="flex items-center gap-2.5">
      <span className="h-1.5 flex-1 rounded-full bg-[#F2EEE6]">
        <span className="block h-1.5 rounded-full" style={{ width: `${Math.min(Math.max(pct, 0), 100)}%`, background: color }} />
      </span>
      <span className="min-w-12 text-[13px] font-semibold tabular-nums" style={{ color: level ? color : undefined }}>
        {label ?? `${pct}%`}
      </span>
    </span>
  );
}

export function RowButton({ children, className, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" className={cx('h-8 shrink-0 rounded-lg border border-[#E0D9CC] bg-white px-2.5 text-[12.5px] hover:border-ink disabled:opacity-50', className)} {...rest}>
      {children}
    </button>
  );
}

/** Runs a console action with a busy flag, a toast and a refresh. */
export function useAction(refresh?: () => unknown) {
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const run = async <T,>(key: string, fn: () => Promise<T>, ok?: string | ((r: T) => string)) => {
    setBusy(key);
    try {
      const r = await fn();
      if (ok) toast(typeof ok === 'function' ? ok(r) : ok);
      await refresh?.();
      return r;
    } catch (e) {
      toast((e as Error).message, 'err');
      return undefined;
    } finally {
      setBusy(null);
    }
  };
  return { busy, run };
}
