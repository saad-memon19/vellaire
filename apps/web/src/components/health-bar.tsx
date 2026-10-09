import { cx } from './ui';

const TONE = {
  ok: ['bg-ok', 'text-ok'],
  warn: ['bg-warn', 'text-warn'],
  err: ['bg-err', 'text-err'],
} as const;

/** 0–100 customer health as a short bar with its number. */
export function HealthBar({ h }: { h: number }) {
  const [bar, text] = TONE[h >= 75 ? 'ok' : h >= 55 ? 'warn' : 'err'];
  return (
    <span className="flex items-center gap-2" title={`Health ${h} of 100`}>
      <span className="h-1 w-24 rounded-full bg-[#EEE8DD]">
        <span className={cx('block h-1 rounded-full', bar)} style={{ width: `${h}%` }} />
      </span>
      <span className={cx('text-[13px] font-semibold tabular-nums', text)}>{h}</span>
    </span>
  );
}
