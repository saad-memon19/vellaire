'use client';

import Link from 'next/link';
import { Icon, Seal } from '@/components/icons';
import { useToast } from '@/components/toast';
import { copyText, Loading, StatusBadge } from '@/components/ui';
import { MATERIALS } from '@/lib/catalog';
import { NoCard } from '../no-card';
import { useMyCard } from '../use-my-card';

export default function Share() {
  const { data, error } = useMyCard();
  const toast = useToast();
  if (error) return <NoCard />;
  if (!data) return <Loading />;
  const c = data.card;
  const text = `${c.fields.name} · ${c.fields.title || ''}`.trim();
  const url = `${c.url}?src=link`;
  const channels = [
    {
      label: 'WhatsApp',
      icon: 'whatsapp',
      href: `https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`,
    },
    {
      label: 'Email',
      icon: 'mail',
      href: `mailto:?subject=${encodeURIComponent(text)}&body=${encodeURIComponent(url)}`,
    },
    {
      label: 'Message',
      icon: 'send',
      href: `sms:?&body=${encodeURIComponent(url)}`,
    },
  ];
  const more = async () => {
    if (navigator.share) await navigator.share({ title: text, url }).catch(() => {});
    else copyText(url)?.then(() => toast('Link copied'));
  };
  const wallet = (kind: 'apple' | 'google') => {
    if (!data.wallet[kind]) return toast(`${kind === 'apple' ? 'Apple' : 'Google'} Wallet is not set up by your company yet`, 'info');
    window.location.href = `/m/wallet?kind=${kind}`;
  };

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center justify-between">
        <h1 className="font-display text-[34px]">Share</h1>
        <StatusBadge status={c.status === 'live' ? 'Card live' : c.status} />
      </header>
      <div className="rounded-[20px] border border-linen bg-white p-5 text-center shadow-[0_12px_30px_rgba(23,23,27,0.06)]">
        {/* QR is generated with high error correction, so the centre mark never blocks a scan */}
        <div className="relative mx-auto w-full max-w-60">
          <img src="/api/me/qr" alt="QR code for my card" className="w-full" />
          <span className="absolute left-1/2 top-1/2 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white">
            {c.brand.logos?.icon ? <img src={c.brand.logos.icon} alt="" className="h-8 w-8 rounded-full object-contain" /> : <Seal size={34} className="text-ink" />}
          </span>
        </div>
        <div className="mt-3 font-display text-[24px] leading-tight">{c.fields.name}</div>
        <div className="mt-0.5 text-[12.5px] text-stone">
          {c.fields.title} · {c.brand.companyName}
        </div>
      </div>
      <div className="flex items-center gap-3 rounded-2xl border border-linen bg-white px-4 py-3">
        <span className="min-w-0 flex-1 truncate font-mono text-[13px]">{c.displayUrl}</span>
        <button type="button" onClick={() => copyText(c.url)?.then(() => toast('Link copied'))} className="text-[13px] font-semibold text-gold-text hover:text-ink">
          Copy
        </button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <button type="button" onClick={() => wallet('apple')} className="flex h-12 items-center justify-center gap-2 rounded-xl bg-black text-[14px] text-white">
          <Icon name="wallet" size={18} /> Apple Wallet
        </button>
        <button type="button" onClick={() => wallet('google')} className="flex h-12 items-center justify-center gap-2 rounded-xl bg-black text-[14px] text-white">
          <Icon name="wallet" size={18} /> Google Wallet
        </button>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {channels.map((ch) => (
          <a
            key={ch.label}
            href={ch.href}
            target="_blank"
            rel="noreferrer"
            className="flex flex-col items-center gap-1.5 rounded-xl border border-line bg-white py-3 text-[12px] text-stone"
          >
            <Icon name={ch.icon} size={20} className="text-ink" />
            {ch.label}
          </a>
        ))}
        <button type="button" onClick={more} className="flex flex-col items-center gap-1.5 rounded-xl border border-line bg-white py-3 text-[12px] text-stone">
          <Icon name="more" size={20} className="text-ink" />
          More
        </button>
      </div>
      {data.devices.map((d: any) => (
        <Link key={d.id} href="/m/nfc" className="flex items-center gap-3.5 rounded-2xl border border-linen bg-white p-4">
          <span
            className="h-9.5 w-15 shrink-0 rounded-md shadow-[0_4px_10px_rgba(23,23,27,0.18)]"
            style={{
              background: MATERIALS.find((m) => m.id === d.material)?.bg || '#17171B',
            }}
          />
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-medium">{d.name}</span>
            <span className="block text-[13px] text-stone">
              {d.status === 'active' ? 'Active' : d.status === 'lost' ? 'Reported lost' : 'Switched off'}
              {d.lastTap ? ` · last tap ${d.lastTap}` : ''}
            </span>
          </span>
          <Icon name="nfc" className="text-gold" />
        </Link>
      ))}
    </div>
  );
}
