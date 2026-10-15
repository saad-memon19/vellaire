'use client';

import { cx, Input } from './ui';

/** The same rule as the API (common/password.ts): 12+ characters, a number and a symbol. */
const RULES = [
  { label: '12+ characters', ok: (p: string) => p.length >= 12 },
  { label: 'A number', ok: (p: string) => /\d/.test(p) },
  { label: 'A symbol', ok: (p: string) => /[^A-Za-z0-9]/.test(p) },
];

export const passwordOk = (p: string) => RULES.every((r) => r.ok(p));

/** New-password input with the strength bar and checklist from the sign-up design. */
export function PasswordField({ id, label = 'Password', value, onChange }: { id: string; label?: string; value: string; onChange: (v: string) => void }) {
  const passed = RULES.filter((r) => r.ok(value)).length;
  // Four bars: one per rule met, the fourth once the password is comfortably long
  const bars = passed + (passed === RULES.length && value.length >= 16 ? 1 : 0);
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-[13px] font-medium text-[#3A3A42]">
        {label}
      </label>
      <Input id={id} type="password" required autoComplete="new-password" value={value} onChange={(e) => onChange(e.target.value)} className="h-12" aria-describedby={`${id}-rules`} />
      <div className="grid grid-cols-4 gap-1.5" aria-hidden="true">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={cx('h-1 rounded-full', i < bars ? (passed === RULES.length ? 'bg-ok' : 'bg-gold') : 'bg-[#E2DCD0]')} />
        ))}
      </div>
      <div id={`${id}-rules`} className="flex flex-wrap gap-3.5 text-[12.5px]">
        {RULES.map((r) => (
          <span key={r.label} className={r.ok(value) ? 'text-ok' : 'text-stone-2'}>
            {r.ok(value) ? '✓' : '·'} {r.label}
          </span>
        ))}
      </div>
    </div>
  );
}
