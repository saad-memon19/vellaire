'use client';

import Link from 'next/link';
import { forwardRef, useEffect, useId, useRef } from 'react';
import { Icon, IconName } from './icons';

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

/* ---------- Buttons ---------- */

type BtnVariant = 'ink' | 'outline' | 'ghost' | 'gold' | 'danger' | 'light';
const btnBase = 'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 whitespace-nowrap';
const btnVariant: Record<BtnVariant, string> = {
  ink: 'bg-ink font-semibold text-white hover:bg-[#2E2E35] [&>svg:first-child]:text-[#E6D3A3]',
  outline: 'border border-[#D9D2C4] bg-white text-ink hover:border-ink',
  ghost: 'text-stone hover:bg-sand hover:text-ink',
  gold: 'bg-gold-tint text-gold-text ring-1 ring-gold-line hover:bg-[#F1E6CF]',
  danger: 'border border-err/30 bg-white text-err hover:bg-err-bg',
  light: 'bg-white/10 text-white ring-1 ring-white/20 hover:bg-white/20',
};
const btnSize = {
  sm: 'h-9 px-3 text-[13px]',
  md: 'h-11 px-[18px] text-[14px]',
  lg: 'h-12 px-5 text-[15px]',
};

interface BtnProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: BtnVariant;
  size?: keyof typeof btnSize;
  icon?: IconName;
  iconRight?: IconName;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, BtnProps>(function Button(
  { variant = 'outline', size = 'md', icon, iconRight, loading, className, children, disabled, type = 'button', ...rest },
  ref,
) {
  return (
    <button ref={ref} type={type} disabled={disabled || loading} className={cx(btnBase, btnVariant[variant], btnSize[size], className)} {...rest}>
      {loading ? <Spinner size={16} /> : icon && <Icon name={icon} size={17} />}
      {children}
      {iconRight && <Icon name={iconRight} size={17} />}
    </button>
  );
});

export function LinkButton({
  href,
  variant = 'outline',
  size = 'md',
  icon,
  iconRight,
  className,
  children,
  ...rest
}: {
  href: string;
  variant?: BtnVariant;
  size?: keyof typeof btnSize;
  icon?: IconName;
  iconRight?: IconName;
  className?: string;
  children?: React.ReactNode;
} & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href'>) {
  const external = /^https?:|^\/api\//.test(href) || rest.download !== undefined;
  const cls = cx(btnBase, btnVariant[variant], btnSize[size], className);
  const inner = (
    <>
      {icon && <Icon name={icon} size={17} />}
      {children}
      {iconRight && <Icon name={iconRight} size={17} />}
    </>
  );
  return external ? (
    <a href={href} className={cls} {...rest}>
      {inner}
    </a>
  ) : (
    <Link href={href} className={cls} {...rest}>
      {inner}
    </Link>
  );
}

export function IconButton({
  icon,
  label,
  className,
  ...rest
}: {
  icon: IconName;
  label: string;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cx('inline-flex h-10 w-10 items-center justify-center rounded-md text-stone hover:bg-sand hover:text-ink', className)}
      {...rest}
    >
      <Icon name={icon} size={18} />
    </button>
  );
}

export function Spinner({ size = 20, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={cx('animate-spin', className)} aria-hidden="true">
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeOpacity="0.2" strokeWidth="2.5" />
      <path d="M21 12a9 9 0 0 0-9-9" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

/* ---------- Form ---------- */

const inputCls = 'vl-input h-[42px] w-full rounded-lg border border-linen bg-white px-3 text-[14px] text-ink placeholder:text-stone-2 disabled:bg-pearl';

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...rest }, ref) {
  return <input ref={ref} className={cx(inputCls, className)} {...rest} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...rest }, ref) {
  return <textarea ref={ref} className={cx(inputCls, 'h-auto min-h-[96px] py-3 leading-relaxed', className)} {...rest} />;
});

export function Select({ className, children, ...rest }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className={cx('relative', className)}>
      <select className={cx(inputCls, 'appearance-none pr-9')} {...rest}>
        {children}
      </select>
      <Icon name="down" size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-stone" />
    </div>
  );
}

export function Field({
  label,
  hint,
  tag,
  children,
  className,
}: {
  label: string;
  hint?: React.ReactNode;
  tag?: React.ReactNode;
  children: (id: string) => React.ReactNode;
  className?: string;
}) {
  const id = useId();
  return (
    <div className={cx('flex flex-col gap-2', className)}>
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={id} className="text-[13px] font-medium text-[#3A3A42]">
          {label}
        </label>
        {tag}
      </div>
      {children(id)}
      {hint && <div className="text-xs text-stone-2">{hint}</div>}
    </div>
  );
}

export function Toggle({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cx('relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50', checked ? 'bg-ink' : 'bg-line-strong')}
    >
      <span className={cx('absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all', checked ? 'left-[22px]' : 'left-0.5')} />
    </button>
  );
}

export function Checkbox({ checked, onChange, label, className }: { checked: boolean; onChange: (v: boolean) => void; label: string; className?: string }) {
  return (
    <input
      type="checkbox"
      aria-label={label}
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      className={cx('h-4 w-4 cursor-pointer rounded border-line-strong accent-ink', className)}
    />
  );
}

/* ---------- Surfaces ---------- */

export function Panel({
  children,
  className,
  pad = true,
  ...rest
}: {
  children: React.ReactNode;
  className?: string;
  pad?: boolean;
} & React.HTMLAttributes<HTMLElement>) {
  return (
    <section className={cx('rounded-[14px] border border-linen bg-white', pad && 'p-5 sm:p-6', className)} {...rest}>
      {children}
    </section>
  );
}

export function PanelHeader({ title, sub, action }: { title: React.ReactNode; sub?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className="text-[16px] font-semibold">{title}</h2>
        {sub && <p className="mt-0.5 text-[13px] text-stone-2">{sub}</p>}
      </div>
      {action}
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  desc,
  actions,
  back,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  desc?: React.ReactNode;
  actions?: React.ReactNode;
  back?: { href: string; label: string };
}) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-6">
      <div className="flex min-w-0 flex-col gap-1.5">
        {back && (
          <Link href={back.href} className="mb-2 inline-flex items-center gap-1 text-[13px] text-stone hover:text-ink">
            <Icon name="left" size={15} /> {back.label}
          </Link>
        )}
        {eyebrow && <div className="text-[12px] font-medium uppercase tracking-[0.2em] text-gold-text">{eyebrow}</div>}
        <h1 className="m-0 font-display text-[38px] font-normal leading-[1.05] sm:text-[46px]">{title}</h1>
        {desc && <p className="m-0 max-w-2xl text-[15px] text-stone">{desc}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2.5">{actions}</div>}
    </header>
  );
}

export function Stat({ label, value, delta, note, tone }: { label: string; value: React.ReactNode; delta?: string; note?: string; tone?: 'up' | 'down' }) {
  const t = tone || (delta?.startsWith('-') ? 'down' : delta?.startsWith('+') ? 'up' : undefined);
  return (
    <div className="flex flex-col gap-3 rounded-[14px] border border-linen bg-white p-[22px]">
      <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-stone-2">{label}</div>
      <div className="font-display text-[38px] font-medium leading-none">{value}</div>
      {(delta || note) && <div className={cx('text-[13px]', t === 'up' ? 'text-ok' : t === 'down' ? 'text-err' : 'text-stone-2')}>{delta || note}</div>}
    </div>
  );
}

/* ---------- Badges ---------- */

const TONES = {
  ok: 'bg-ok-bg text-ok',
  warn: 'bg-warn-bg text-warn',
  err: 'bg-err-bg text-err',
  info: 'bg-info-bg text-info',
  neutral: 'bg-sand text-stone',
  gold: 'bg-gold-tint text-gold-text',
} as const;
export type Tone = keyof typeof TONES;

export function Badge({ tone = 'neutral', children, className }: { tone?: Tone; children: React.ReactNode; className?: string }) {
  return <span className={cx('inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-[12px] font-medium', TONES[tone], className)}>{children}</span>;
}

const STATUS_TONE: Record<string, Tone> = {
  live: 'ok',
  Live: 'ok',
  'Card live': 'ok',
  Installed: 'ok',
  'In sync': 'ok',
  Deployed: 'ok',
  'Edited by hand': 'warn',
  active: 'ok',
  Active: 'ok',
  connected: 'ok',
  Healthy: 'ok',
  paid: 'ok',
  Delivered: 'ok',
  delivered: 'ok',
  Done: 'ok',
  done: 'ok',
  Ready: 'ok',
  Available: 'ok',
  in_crm: 'ok',
  'In CRM': 'ok',
  Received: 'neutral',
  Artwork: 'warn',
  'In production': 'warn',
  Encoded: 'warn',
  Shipped: 'info',
  draft: 'neutral',
  Draft: 'neutral',
  'No card': 'neutral',
  Off: 'neutral',
  disabled: 'neutral',
  closed: 'neutral',
  Never: 'neutral',
  not_connected: 'neutral',
  Churned: 'neutral',
  pending_approval: 'warn',
  'Waiting approval': 'warn',
  pending: 'warn',
  paused: 'warn',
  open: 'warn',
  new: 'warn',
  New: 'warn',
  Trial: 'info',
  trial: 'info',
  scheduled: 'info',
  Scheduled: 'info',
  followed_up: 'info',
  'Followed up': 'info',
  deactivated: 'err',
  Deactivated: 'err',
  lost: 'err',
  Lost: 'err',
  error: 'err',
  failed: 'err',
  'Past due': 'err',
  past_due: 'err',
  Leaver: 'err',
  Breached: 'err',
};
const STATUS_LABEL: Record<string, string> = {
  live: 'Live',
  draft: 'Draft',
  pending_approval: 'Waiting approval',
  scheduled: 'Scheduled',
  deactivated: 'Deactivated',
  active: 'Active',
  disabled: 'Off',
  lost: 'Lost',
  connected: 'Connected',
  paused: 'Paused',
  error: 'Error',
  not_connected: 'Not connected',
  in_crm: 'In CRM',
  followed_up: 'Followed up',
  new: 'New',
  paid: 'Paid',
  open: 'Open',
  failed: 'Failed',
  pending: 'Pending',
  closed: 'Closed',
  done: 'Done',
};
export function StatusBadge({ status }: { status: string }) {
  return <Badge tone={STATUS_TONE[status] || 'neutral'}>{STATUS_LABEL[status] || status}</Badge>;
}

/* ---------- Tabs ---------- */

type TabItem<T> = { id: T; name: string; count?: number | null };

/** Rounded chip tabs (console filters, mobile lists). Same contract as Tabs. */
export function PillTabs<T extends string>({ items, value, onChange, className }: { items: TabItem<T>[]; value: T; onChange: (id: T) => void; className?: string }) {
  return (
    <div role="tablist" className={cx('scrollbar-thin flex gap-2 overflow-x-auto', className)}>
      {items.map((t) => {
        const on = value === t.id;
        return (
          <button
            key={t.id}
            role="tab"
            aria-selected={on}
            onClick={() => onChange(t.id)}
            className={cx(
              'flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-[13px] transition-colors',
              on ? 'border-ink bg-ink text-white' : 'border-linen bg-white text-ink hover:border-[#D9D2C4]',
            )}
          >
            {t.name}
            {t.count !== undefined && t.count !== null && <span className={on ? 'text-white/70' : 'text-stone-2'}>{t.count.toLocaleString()}</span>}
          </button>
        );
      })}
    </div>
  );
}

export function Tabs<T extends string>({ items, value, onChange, className }: { items: TabItem<T>[]; value: T; onChange: (id: T) => void; className?: string }) {
  return (
    <div role="tablist" className={cx('scrollbar-thin flex gap-7 overflow-x-auto border-b border-linen', className)}>
      {items.map((t) => (
        <button
          key={t.id}
          role="tab"
          aria-selected={value === t.id}
          onClick={() => onChange(t.id)}
          className={cx(
            '-mb-px flex shrink-0 items-center gap-2 border-b-2 py-3 text-[14px] transition-colors',
            value === t.id ? 'border-gold font-semibold text-ink' : 'border-transparent text-stone-2 hover:text-ink',
          )}
        >
          {t.name}
          {t.count !== undefined && t.count !== null && (
            <span className={cx('rounded-full px-2 py-px text-[12px] font-normal text-[#4E4A44]', value === t.id ? 'bg-gold-tint' : 'bg-[#EFEBE3]')}>
              {t.count.toLocaleString()}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

export function Segmented<T extends string>({ items, value, onChange }: { items: { id: T; name: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="inline-flex rounded-md border border-line-strong bg-white p-0.5">
      {items.map((i) => (
        <button
          key={i.id}
          type="button"
          aria-pressed={value === i.id}
          onClick={() => onChange(i.id)}
          className={cx('h-8 rounded-[5px] px-3 text-[13px]', value === i.id ? 'bg-ink text-cream' : 'text-stone hover:text-ink')}
        >
          {i.name}
        </button>
      ))}
    </div>
  );
}

/* ---------- Avatar ---------- */

export function Avatar({ name, src, size = 36, className }: { name?: string; src?: string | null; size?: number; className?: string }) {
  const ini = (name || '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('');
  if (src) return <img src={src} alt="" width={size} height={size} className={cx('shrink-0 rounded-full object-cover', className)} style={{ width: size, height: size }} />;
  return (
    <span
      aria-hidden="true"
      className={cx('inline-flex shrink-0 items-center justify-center rounded-full bg-sand font-medium text-gold-text', className)}
      style={{ width: size, height: size, fontSize: size * 0.36 }}
    >
      {ini}
    </span>
  );
}

/* ---------- Modal ---------- */

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    ref.current?.querySelector<HTMLElement>('input,textarea,select,button')?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-0 sm:items-center sm:p-6" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cx('vl-fade flex max-h-[92vh] w-full flex-col rounded-t-2xl bg-white shadow-2xl sm:rounded-xl', wide ? 'sm:max-w-3xl' : 'sm:max-w-lg')}
      >
        <div className="flex items-center justify-between border-b border-line px-6 py-4">
          <h2 className="font-display text-[26px]">{title}</h2>
          <IconButton icon="x" label="Close" onClick={onClose} />
        </div>
        <div className="overflow-y-auto px-6 py-5">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-line px-6 py-4">{footer}</div>}
      </div>
    </div>
  );
}

/* ---------- Table ---------- */

export function Table({ head, children, className }: { head: (string | { label: React.ReactNode; className?: string })[]; children: React.ReactNode; className?: string }) {
  return (
    <div className={cx('scrollbar-thin overflow-x-auto', className)}>
      <table className="w-full min-w-[640px] border-collapse text-left text-[14px]">
        <thead>
          <tr className="border-b border-line">
            {head.map((h, i) => {
              const label = typeof h === 'string' ? h : h.label;
              return (
                <th
                  key={i}
                  scope="col"
                  className={cx('whitespace-nowrap px-4 py-3 text-[11px] font-medium uppercase tracking-[0.14em] text-stone-2', typeof h !== 'string' && h.className)}
                >
                  {label}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
export const Td = ({ children, className, ...rest }: React.TdHTMLAttributes<HTMLTableCellElement>) => (
  <td className={cx('border-b border-linen px-4 py-3 align-middle', className)} {...rest}>
    {children}
  </td>
);

export function Pagination({ page, limit, total, onPage }: { page: number; limit: number; total: number; onPage: (p: number) => void }) {
  const from = total ? (page - 1) * limit + 1 : 0;
  const to = Math.min(page * limit, total);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-[14px] text-stone">
      <span>
        Showing {from.toLocaleString()}–{to.toLocaleString()} of {total.toLocaleString()}
      </span>
      <div className="flex gap-2">
        <Button className="h-10 px-4" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          Previous
        </Button>
        <Button className="h-10 px-4" disabled={to >= total} onClick={() => onPage(page + 1)}>
          Next
        </Button>
      </div>
    </div>
  );
}

/* ---------- States ---------- */

export function Empty({ icon = 'info', title, desc, action }: { icon?: IconName; title: string; desc?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-sand text-gold-text">
        <Icon name={icon} size={22} />
      </span>
      <div className="font-display text-[24px]">{title}</div>
      {desc && <p className="mt-1 max-w-sm text-[14px] text-stone">{desc}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Loading({ className }: { className?: string }) {
  return (
    <div className={cx('flex items-center justify-center py-16 text-stone-2', className)}>
      <Spinner />
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx('animate-pulse rounded-md bg-sand', className)} />;
}

export function ErrorState({ error, retry }: { error: unknown; retry?: () => void }) {
  return (
    <Empty
      icon="alert"
      title="This did not load"
      desc={(error as Error)?.message || 'Please try again.'}
      action={
        retry && (
          <Button onClick={retry} icon="refresh">
            Try again
          </Button>
        )
      }
    />
  );
}

export function Callout({ tone = 'gold', icon = 'info', children, action }: { tone?: Tone; icon?: IconName; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className={cx('flex flex-wrap items-start gap-3 rounded-lg px-4 py-3 text-[14px]', TONES[tone])}>
      <Icon name={icon} size={18} className="mt-0.5" />
      <div className="min-w-0 flex-1">{children}</div>
      {action}
    </div>
  );
}

export function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="rounded border border-line bg-pearl px-1.5 py-0.5 font-mono text-[11px] text-stone">{children}</kbd>;
}

export function copyText(text: string) {
  return navigator.clipboard?.writeText(text);
}

/** A filter that looks like the design's dropdown chip but is a real select. */
export function FilterChip({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { id: string; name: string }[] }) {
  return (
    <label className={cx('relative flex h-[42px] items-center rounded-lg border bg-white text-[14px]', value ? 'border-gold text-ink' : 'border-linen text-ink')}>
      <span className="sr-only">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="h-full cursor-pointer appearance-none rounded-lg bg-transparent pl-3.5 pr-8 outline-none">
        <option value="">{label}</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
      <Icon name="down" size={14} className="pointer-events-none absolute right-3 text-[#8E887E]" />
    </label>
  );
}
