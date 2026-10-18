'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { OnlineCard, OnlineCardData } from '@/components/card/online-card';
import { Seal } from '@/components/icons';
import { Button, Field, Input, Modal, Textarea } from '@/components/ui';
import { useToast } from '@/components/toast';

export interface PublicCard extends OnlineCardData {
  status: string;
  id: string;
  defaultLang?: string;
  companyName: string;
  companySlug?: string;
  website?: string | null;
  logo?: string | null;
  teamPage?: boolean;
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
          initialLang={params.get('lang') || card.defaultLang}
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

export function InactiveCard({
  companyName,
  companySlug,
  website,
  logo,
  teamPage,
}: {
  companyName?: string;
  companySlug?: string;
  website?: string | null;
  logo?: string | null;
  teamPage?: boolean;
}) {
  const cleanWebsite = website ? website.replace(/^https?:\/\//, '').replace(/\/$/, '') : null;
  const webHref = website ? (website.startsWith('http') ? website : `https://${website}`) : undefined;
  const contactHref = webHref || (companySlug ? `/c/${companySlug}` : '#');

  return (
    <main className="relative min-h-screen w-full bg-[#F7F5F0] text-[#17171B] font-sans flex items-center justify-center">
      <div
        className="mx-auto flex min-h-screen w-full max-w-[390px] flex-col items-center justify-center gap-6 px-7 py-10 text-center box-border"
        style={{
          background: 'radial-gradient(60% 40% at 50% 30%, rgba(176,141,79,0.16), rgba(247,245,240,0) 70%), #F7F5F0',
        }}
      >
        <span className="flex h-[88px] w-[88px] shrink-0 items-center justify-center overflow-hidden rounded-[22px] bg-[#17171B] font-display text-[40px] text-[#C9A96E] shadow-[0_18px_36px_rgba(23,23,27,0.2)]">
          {logo ? <img src={logo} alt="" className="max-h-14 max-w-14 object-contain" /> : (companyName || 'V')[0]}
        </span>
        <span className="text-[11px] font-semibold tracking-[0.3em] text-[#876A33]">
          {companyName ? companyName.toUpperCase() : 'VELLAIRE'}
        </span>
        <h1 className="m-0 font-display text-[36px] font-medium leading-[1.1] text-[#17171B]">
          This card is no longer active
        </h1>
        <p className="m-0 text-[15px] leading-[1.6] text-[#5E5952]">
          The person you are looking for has moved on. Our team will be glad to help you.
        </p>
        <div className="flex w-full flex-col gap-2.5 pt-2">
          <a
            href={contactHref}
            className="flex h-[54px] items-center justify-center rounded-[14px] bg-[#17171B] text-[15px] font-semibold text-white transition-opacity hover:opacity-90"
          >
            {companyName ? `Contact ${companyName}` : 'Contact us'}
          </a>
          {teamPage && companySlug && (
            <Link
              href={`/c/${companySlug}`}
              className="flex h-[52px] items-center justify-center rounded-[14px] border border-[#D9D2C4] bg-white text-[15px] text-[#17171B] transition-colors hover:bg-[#FAF8F5]"
            >
              Find someone in our team
            </Link>
          )}
          {cleanWebsite && webHref && (
            <a
              href={webHref}
              target="_blank"
              rel="noreferrer"
              className="flex h-[52px] items-center justify-center rounded-[14px] text-[15px] text-[#876A33] hover:underline"
            >
              {cleanWebsite}
            </a>
          )}
        </div>
        <span className="mt-5 flex items-center gap-1.5 text-[10px] tracking-[0.24em] text-[#8E887E]">
          <Seal size={14} className="text-[#B08D4F]" />
          VELLAIRE
        </span>
      </div>
    </main>
  );
}
