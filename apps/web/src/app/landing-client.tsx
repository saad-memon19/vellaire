'use client';

import { useState } from 'react';
import { Icon } from '@/components/icons';
import { Button, Field, Input, Modal, Select, Textarea } from '@/components/ui';

/* Themes exactly as in the landing page design (brand control demo). */
const THEMES = [
  { id: 'obsidian', name: 'Obsidian & Gold', bg: '#111114', fg: '#F6F1E7', accent: '#C9A96E', sub: '#A9A49A', line: 'rgba(201,169,110,0.45)' },
  { id: 'ivory', name: 'Ivory & Ink', bg: '#FFFFFF', fg: '#17171B', accent: '#876A33', sub: '#5E5952', line: '#E2DBCD' },
  { id: 'navy', name: 'Navy & Silver', bg: '#13203A', fg: '#EEF1F6', accent: '#C3CAD6', sub: '#9AA4B5', line: '#13203A' },
  { id: 'emerald', name: 'Emerald & Brass', bg: '#0F2E25', fg: '#F2EEE4', accent: '#C7A45A', sub: '#A7B3A9', line: '#0F2E25' },
  { id: 'burgundy', name: 'Burgundy & Cream', bg: '#3A1218', fg: '#F7EFE2', accent: '#E3C9A0', sub: '#C9AFA6', line: '#3A1218' },
  { id: 'mono', name: 'Pure Monochrome', bg: '#F4F4F2', fg: '#0B0B0D', accent: '#0B0B0D', sub: '#5C5C63', line: '#DADAD6' },
];

export function BrandControl({ eyebrowClass, h2Class }: { eyebrowClass: string; h2Class: string }) {
  const [sel, setSel] = useState('obsidian');
  const cur = THEMES.find((t) => t.id === sel)!;
  return (
    <section className="mx-auto grid max-w-[1304px] items-center gap-[72px] px-8 py-32" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(480px, 100%), 1fr))' }}>
      <div className="flex flex-col gap-[26px]">
        <div className={eyebrowClass}>BRAND CONTROL</div>
        <h2 className={h2Class}>Your brand, untouchable.</h2>
        <p className="m-0 max-w-[480px] text-[17px] leading-[1.7] text-stone">Set the brand kit once. Lock what must never change, let people personalise what they may, and approve the rest. Try a theme.</p>
        <div className="flex flex-wrap gap-2.5" role="radiogroup" aria-label="Card theme">
          {THEMES.map((t) => {
            const on = t.id === sel;
            return (
              <button
                key={t.id}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setSel(t.id)}
                className="inline-flex min-h-11 cursor-pointer items-center gap-2.5 rounded-full px-4 py-2.5 text-[14px]"
                style={{ background: on ? '#17171B' : '#FFFFFF', border: `1px solid ${on ? '#17171B' : '#E0D9CC'}`, color: on ? '#FFFFFF' : '#2A2A30', fontWeight: on ? 600 : 400 }}
              >
                <span className="h-3.5 w-3.5 rounded-full" style={{ background: t.bg, boxShadow: `0 0 0 1px rgba(23,23,27,0.15), inset 0 0 0 4px ${t.bg}, inset 0 0 0 7px ${t.accent}` }} />
                {t.name}
              </button>
            );
          })}
        </div>
      </div>
      <div className="flex justify-center rounded-3xl bg-sand p-12">
        <div
          className="flex aspect-[1.586] w-[440px] max-w-full flex-col justify-between rounded-[18px] p-8"
          style={{ background: cur.bg, color: cur.fg, border: `1px solid ${cur.line}`, boxShadow: '0 40px 80px rgba(23,23,27,0.22)', transition: 'background 400ms cubic-bezier(.22,1,.36,1), color 400ms' }}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] tracking-[0.28em]" style={{ color: cur.accent }}>
              MERIDIAN CAPITAL
            </span>
            <span className="text-[11px] tracking-[0.1em]" style={{ color: cur.sub }}>
              {cur.name}
            </span>
          </div>
          <div className="flex flex-col gap-2">
            <div className="font-display text-[36px]">Sara Khan</div>
            <div className="h-px w-14" style={{ background: cur.accent }} />
            <div className="text-[13px] tracking-[0.06em]" style={{ color: cur.sub }}>
              Head of Private Clients
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/** "Book a private demo": opens a short request form in a modal. */
export function DemoButton({ className, children }: { className?: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className}>
        {children}
      </button>
      <DemoModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}

function DemoModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const empty = { name: '', email: '', company: '', size: '100–500', hr: 'Workday', message: '' };
  const [f, setF] = useState(empty);
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'error'>('idle');
  const [err, setErr] = useState('');
  const close = () => {
    onClose();
    if (state === 'done') {
      setF(empty);
      setState('idle');
    }
  };
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setState('busy');
    try {
      const res = await fetch('/api/public/demo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(f) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Something went wrong');
      setState('done');
    } catch (e2) {
      setErr((e2 as Error).message);
      setState('error');
    }
  };
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });

  return (
    <Modal open={open} onClose={close} title={state === 'done' ? 'Thank you' : 'Book a private demo'}>
      {state === 'done' ? (
        <div className="flex flex-col items-start gap-3 py-2">
          <Icon name="checkCircle" size={28} className="text-ok" />
          <p className="text-[15px] text-stone">We will be in touch within one business day to arrange your 30-minute walkthrough.</p>
          <Button variant="ink" onClick={close}>
            Close
          </Button>
        </div>
      ) : (
        <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
          <Field label="Your name">{(id) => <Input id={id} required value={f.name} onChange={set('name')} autoComplete="name" />}</Field>
          <Field label="Work email">{(id) => <Input id={id} required type="email" value={f.email} onChange={set('email')} autoComplete="email" />}</Field>
          <Field label="Company" className="sm:col-span-2">{(id) => <Input id={id} required value={f.company} onChange={set('company')} autoComplete="organization" />}</Field>
          <Field label="People">
            {(id) => (
              <Select id={id} value={f.size} onChange={set('size')}>
                {['Under 100', '100–500', '500–2,000', '2,000+'].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="HR system">
            {(id) => (
              <Select id={id} value={f.hr} onChange={set('hr')}>
                {['Workday', 'SAP SuccessFactors', 'BambooHR', 'Microsoft Entra ID', 'Other', 'None'].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Anything we should know? (optional)" className="sm:col-span-2">
            {(id) => <Textarea id={id} rows={3} value={f.message} onChange={set('message')} />}
          </Field>
          {state === 'error' && <p className="text-[14px] text-err sm:col-span-2">{err}</p>}
          <Button type="submit" variant="ink" size="lg" loading={state === 'busy'} className="sm:col-span-2">
            Request my demo
          </Button>
        </form>
      )}
    </Modal>
  );
}
