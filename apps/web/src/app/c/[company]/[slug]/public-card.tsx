'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { OnlineCard, OnlineCardData } from '@/components/card/online-card';
import { Seal } from '@/components/icons';
import { Button, Field, Input, Modal, Textarea } from '@/components/ui';
import { useToast } from '@/components/toast';

export interface PublicCard extends OnlineCardData {
  status: string;
  id: string;
  companyName: string;
  url: string;
}

const track = (cardId: string, type: string, channel: string) =>
  fetch('/api/public/track', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cardId, type, channel }),
    keepalive: true,
  }).catch(() => {});

export function PublicCardView({ card }: { card: PublicCard }) {
  const params = useSearchParams();
  const channel = params.get('src') || 'link';
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', phone: '', company: '', jobTitle: '', note: '', consent: false, website: '' });
  const tracked = useRef(false);

  useEffect(() => {
    if (tracked.current) return;
    tracked.current = true;
    track(card.id, 'view', channel);
    // Clean the ?src= marker from the address bar so shared links stay tidy
    if (params.get('src')) window.history.replaceState(null, '', window.location.pathname);
  }, [card.id, channel, params]);

  const first = (card.fields.name || '').split(' ')[0];

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.consent) return toast('Please agree to be contacted', 'err');
    setBusy(true);
    try {
      const res = await fetch(`/api/public/cards/${card.id}/lead`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, consent: true, channel, website: form.website || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Could not send');
      setSent(true);
    } catch (err) {
      toast((err as Error).message, 'err');
    } finally {
      setBusy(false);
    }
  }

  async function wallet(kind: 'apple' | 'google') {
    const url = `/api/public/cards/${card.id}/wallet/${kind}`;
    if (!card.wallet?.[kind]) return toast(`${kind === 'apple' ? 'Apple' : 'Google'} Wallet is not set up for ${card.companyName} yet`, 'info');
    window.location.href = url;
  }

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm({ ...form, [k]: e.target.value });

  return (
    <main className="min-h-screen bg-pearl sm:py-10">
      <div className="mx-auto max-w-[440px] overflow-hidden bg-pearl sm:rounded-2xl sm:border sm:border-line sm:shadow-xl">
        <OnlineCard
          card={card}
          onSave={() => {
            window.location.href = `/api/public/cards/${card.id}/vcf?src=${channel}`;
          }}
          onShare={() => setOpen(true)}
          onLink={() => track(card.id, 'click', channel)}
          onWallet={wallet}
        />
      </div>

      <Modal open={open} onClose={() => { setOpen(false); setSent(false); }} title={sent ? 'Thank you' : `Share your details with ${first}`}>
        {sent ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <Seal size={40} className="text-gold" />
            <p className="text-[15px] text-stone">{first} has your details and will be in touch.</p>
            <Button variant="ink" onClick={() => { setOpen(false); setSent(false); }}>Close</Button>
          </div>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-4">
            <Field label="Your name">{(id) => <Input id={id} required value={form.name} onChange={set('name')} autoComplete="name" />}</Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Email">{(id) => <Input id={id} type="email" value={form.email} onChange={set('email')} autoComplete="email" />}</Field>
              <Field label="Phone">{(id) => <Input id={id} type="tel" value={form.phone} onChange={set('phone')} autoComplete="tel" />}</Field>
              <Field label="Company">{(id) => <Input id={id} value={form.company} onChange={set('company')} autoComplete="organization" />}</Field>
              <Field label="Job title">{(id) => <Input id={id} value={form.jobTitle} onChange={set('jobTitle')} autoComplete="organization-title" />}</Field>
            </div>
            <Field label="A note (optional)">{(id) => <Textarea id={id} rows={3} value={form.note} onChange={set('note')} placeholder={`What would you like to talk to ${first} about?`} />}</Field>
            {/* Honeypot for bots */}
            <input type="text" tabIndex={-1} autoComplete="off" value={form.website} onChange={set('website')} className="hidden" aria-hidden="true" />
            <label className="flex items-start gap-3 text-[13px] text-stone">
              <input type="checkbox" checked={form.consent} onChange={(e) => setForm({ ...form, consent: e.target.checked })} className="mt-0.5 h-4 w-4 accent-ink" />
              I agree that {card.companyName} may contact me about this conversation. My details are not shared with anyone else.
            </label>
            <Button type="submit" variant="ink" size="lg" loading={busy}>Send my details</Button>
          </form>
        )}
      </Modal>
    </main>
  );
}

export function InactiveCard({ companyName }: { companyName?: string }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-pearl px-6 text-center">
      <Seal size={48} className="text-gold" />
      <h1 className="mt-6 font-display text-[36px]">This card is no longer active</h1>
      <p className="mt-2 max-w-sm text-[15px] text-stone">
        {companyName ? `Please contact ${companyName} directly to reach the right person.` : 'Please contact the company directly.'}
      </p>
    </main>
  );
}
