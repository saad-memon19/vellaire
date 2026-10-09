'use client';

import { useState } from 'react';
import { Brand, LANGS, LINK_TYPES, radiusFor, resolveTheme, RTL } from '@/lib/catalog';
import { Icon, IconName, Seal } from '../icons';
import { fontStack, useBrandFonts } from './card-face';

export interface OnlineCardData {
  id?: string;
  layout?: string;
  theme?: string;
  fields: Record<string, string | undefined>;
  translations?: Record<string, { name?: string; title?: string; bio?: string }>;
  links?: { type: string; label: string; url: string; sub?: string }[];
  brand?: Brand;
  displayUrl?: string;
  companyName?: string;
  wallet?: { apple: boolean; google: boolean };
}

interface Props {
  card: OnlineCardData;
  /** Preview inside the dashboard: no clicks, no tracking */
  preview?: boolean;
  onSave?: () => void;
  onShare?: () => void;
  onLink?: () => void;
  onWallet?: (kind: 'apple' | 'google') => void;
  className?: string;
}

const tel = (s?: string) => (s ? `tel:${s.replace(/[^\d+]/g, '')}` : undefined);
const wa = (s?: string) => (s ? `https://wa.me/${s.replace(/\D/g, '')}` : undefined);
const hexA = (hex: string, a: number) => {
  const n = parseInt(hex.replace('#', '').slice(0, 6), 16);
  return Number.isNaN(n) ? `rgba(176,141,79,${a})` : `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};

/** The online card a client sees after a tap, scan or link (built to the "Public card" artboard). */
export function OnlineCard({ card, preview, onSave, onShare, onLink, onWallet, className = '' }: Props) {
  useBrandFonts(card.brand);
  const langs = ['en', ...Object.keys(card.translations || {}).filter((l) => card.translations?.[l]?.name || card.translations?.[l]?.bio)];
  const [lang, setLang] = useState('en');
  const t = resolveTheme(card.theme || 'obsidian_gold', card.brand);
  // Light themes use their own accent; dark themes keep the brand gold so the cover stays soft
  const accent = t.accent.startsWith('#') && !t.dark ? t.accent : card.brand?.colors?.[1]?.hex || '#B08D4F';
  const f = card.fields;
  const tr = lang !== 'en' ? card.translations?.[lang] : undefined;
  const name = tr?.name || f.name || 'Full name';
  const company = card.brand?.companyName || card.companyName || '';
  const city = f.office?.split('·')[0]?.trim();
  const radius = radiusFor(card.brand?.buttonStyle);
  const display = fontStack(card.brand?.fonts?.display, 'display');
  const body = fontStack(card.brand?.fonts?.body, 'body');
  const rtl = RTL.includes(lang);
  const first = (f.name || '').split(' ')[0];
  const initials = (f.name || '?').split(' ').map((p) => p[0]).slice(0, 2).join('');
  const tab = preview ? -1 : 0;

  // Anchor in a live card, plain block in a preview
  const A = ({ href, children, className: c }: { href?: string; children: React.ReactNode; className?: string }) =>
    preview || !href ? (
      <div className={c}>{children}</div>
    ) : (
      <a href={href} className={c} onClick={onLink} target={href.startsWith('http') ? '_blank' : undefined} rel="noreferrer">
        {children}
      </a>
    );

  const actions: { icon: IconName; label: string; href?: string }[] = [
    { icon: 'phone', label: 'Call', href: tel(f.phone || f.mobile) },
    { icon: 'mail', label: 'Email', href: f.email ? `mailto:${f.email}` : undefined },
    { icon: 'whatsapp', label: 'WhatsApp', href: wa(f.whatsapp || f.mobile) },
    { icon: 'dGlobe', label: 'Website', href: f.website },
  ];
  const shownActions = actions.filter((a) => a.href);

  return (
    <div dir={rtl ? 'rtl' : 'ltr'} className={`bg-pearl text-ink ${className}`} style={{ fontFamily: body }} aria-hidden={preview || undefined}>
      {/* Cover */}
      <div
        className="relative h-[250px]"
        style={{ background: `radial-gradient(70% 90% at 85% 0%, ${hexA(accent, 0.35)}, rgba(239,233,221,0) 70%), repeating-linear-gradient(135deg, ${hexA(accent, 0.14)} 0 1px, rgba(0,0,0,0) 1px 14px), #EFE9DD` }}
      >
        <div className="absolute inset-x-6 top-7 flex items-center justify-between">
          {card.brand?.logos?.light ? (
            <img src={card.brand.logos.light} alt={company} className="h-6 max-w-[150px] object-contain" />
          ) : (
            <span className="flex items-center gap-2 text-[11px] font-medium tracking-[0.26em]" style={{ color: accent }}>
              <Seal size={22} /> {company.toUpperCase()}
            </span>
          )}
          {langs.length > 1 && (
            <button
              type="button"
              tabIndex={tab}
              onClick={() => setLang(langs[(langs.indexOf(lang) + 1) % langs.length]!)}
              className="h-9 rounded-full border border-line-strong bg-white/70 px-3 text-[12px] text-ink"
              aria-label="Change language"
            >
              {langs.map((l) => LANGS[l] || l).join(' · ')}
            </button>
          )}
        </div>
      </div>

      <div className="relative -mt-16 flex flex-col gap-6 px-6">
        <div className="h-[120px] w-[120px] rounded-full p-[3px] shadow-[0_14px_30px_rgba(23,23,27,0.14)]" style={{ background: 'linear-gradient(140deg, #E6D3A3, #9C7A44)' }}>
          {f.photoUrl ? (
            <img src={f.photoUrl} alt="" className="h-full w-full rounded-full border-4 border-white object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center rounded-full border-4 border-white bg-[#F2EEE6] text-[40px] font-semibold text-gold-text" style={{ fontFamily: display }}>
              {initials}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <h1 className="m-0 text-[44px] font-medium leading-none" style={{ fontFamily: rtl ? body : display }}>
            {name}
          </h1>
          {(tr?.title || f.title) && <div className="text-[15px] text-ink-2">{tr?.title || f.title}</div>}
          <div className="text-[13px] tracking-[0.04em] text-stone">{[company, city].filter(Boolean).join(' · ')}</div>
        </div>

        {shownActions.length > 0 && (
          <div className="grid gap-2.5" style={{ gridTemplateColumns: `repeat(${shownActions.length}, minmax(0, 1fr))` }}>
            {shownActions.map((a) => (
              <A key={a.label} href={a.href} className="flex flex-col items-center gap-1.5 rounded-[14px] border border-linen bg-white py-3.5 text-[12px] text-stone">
                <Icon name={a.icon} size={20} className="text-ink" />
                {a.label}
              </A>
            ))}
          </div>
        )}

        <div className="flex flex-col gap-3">
          <button
            type="button"
            tabIndex={tab}
            onClick={preview ? undefined : onSave}
            className="flex h-14 items-center justify-center gap-2.5 bg-ink text-[16px] font-semibold text-white shadow-[0_14px_28px_rgba(23,23,27,0.2)]"
            style={{ borderRadius: radius }}
          >
            <Icon name="dDownload" size={20} className="text-[#E6D3A3]" /> Save contact
          </button>
          <button type="button" tabIndex={tab} onClick={preview ? undefined : onShare} className="flex h-[52px] items-center justify-center gap-2.5 border border-line-strong bg-white text-[15px]" style={{ borderRadius: radius }}>
            <Icon name="file" size={19} /> Share your details{first ? ` with ${first}` : ''}
          </button>
        </div>

        {(tr?.bio || f.bio) && (
          <section className="flex flex-col gap-2.5 rounded-2xl border border-linen bg-white p-5">
            <div className="text-[11px] font-semibold tracking-[0.22em] text-gold-text">ABOUT</div>
            <p className="m-0 text-[21px] leading-[1.45]" style={{ fontFamily: rtl ? body : display }}>
              {tr?.bio || f.bio}
            </p>
          </section>
        )}

        {!!card.links?.length && (
          <section className="flex flex-col overflow-hidden rounded-2xl border border-linen bg-white">
            {card.links.map((l, i) => (
              <A key={i} href={l.url} className={`flex min-h-11 items-center gap-4 px-[18px] py-4 text-ink ${i ? 'border-t border-[#F0EBE2]' : ''}`}>
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gold-tint text-gold-text">
                  <Icon name={LINK_TYPES.find((x) => x.id === l.type)?.icon || 'link'} size={18} />
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="font-medium">{l.label}</span>
                  {l.sub && <span className="truncate text-[12px] text-stone">{l.sub}</span>}
                </span>
                <Icon name={rtl ? 'left' : 'dRight'} size={18} className="text-[#A39B8E]" />
              </A>
            ))}
          </section>
        )}

        {f.address && (
          <section className="flex flex-col gap-3">
            <div className="text-[11px] font-semibold tracking-[0.22em] text-gold-text">OFFICE</div>
            <A
              href={`https://maps.google.com/?q=${encodeURIComponent(f.address)}`}
              className="flex h-[150px] items-center justify-center rounded-2xl border border-linen bg-white text-gold"
            >
              <span
                className="flex h-full w-full items-center justify-center rounded-2xl"
                style={{ backgroundImage: 'linear-gradient(#F0EBE2 1px, transparent 1px), linear-gradient(90deg, #F0EBE2 1px, transparent 1px)', backgroundSize: '28px 28px' }}
              >
                <Icon name="pin" size={28} />
              </span>
            </A>
            <div className="text-[14px] leading-[1.5] text-ink-2">{f.address}</div>
          </section>
        )}

        {(card.wallet?.apple || card.wallet?.google || preview) && (
          <div className="grid grid-cols-2 gap-2.5">
            {(['apple', 'google'] as const).map((k) =>
              card.wallet?.[k] || preview ? (
                <button key={k} type="button" tabIndex={tab} onClick={() => onWallet?.(k)} className="flex h-12 items-center justify-center gap-2 rounded-xl bg-black text-[14px] text-white">
                  <Icon name="dWallet" size={18} /> {k === 'apple' ? 'Apple Wallet' : 'Google Wallet'}
                </button>
              ) : null,
            )}
          </div>
        )}

        <footer className="flex flex-col items-center gap-2.5 border-t border-linen pb-8 pt-5">
          <div className="text-[12px] text-stone">
            {company}
            {company && ' · '}
            <a href="/" tabIndex={tab} className="text-gold-text">
              Privacy
            </a>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] tracking-[0.24em] text-[#8E887E]">
            <Seal size={14} className="text-gold" /> VELLAIRE
          </div>
        </footer>
      </div>
    </div>
  );
}

/** Phone frame used for previews. */
export function PhoneFrame({ children, height = 640, className = '' }: { children: React.ReactNode; height?: number; className?: string }) {
  return (
    <div className={`mx-auto w-full max-w-[340px] rounded-[36px] border-[10px] border-ink bg-ink shadow-2xl ${className}`}>
      <div className="scrollbar-thin overflow-y-auto overflow-x-hidden rounded-[26px] bg-pearl" style={{ height }}>
        {children}
      </div>
    </div>
  );
}
