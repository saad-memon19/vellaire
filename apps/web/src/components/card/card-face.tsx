'use client';

import { useEffect } from 'react';
import { Brand, resolveTheme } from '@/lib/catalog';
import { Icon, Seal } from '../icons';

const DEFAULT_FONTS = ['Cormorant Garamond', 'Instrument Sans'];

/** Loads a brand's Google Fonts once, so card previews use the real typefaces. */
export function useBrandFonts(brand?: Brand) {
  const fams = [brand?.fonts?.display, brand?.fonts?.body].filter((f): f is string => !!f && !DEFAULT_FONTS.includes(f));
  const key = fams.join('|');
  useEffect(() => {
    if (!key) return;
    const id = `vl-font-${key.replace(/\W/g, '')}`;
    if (document.getElementById(id)) return;
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?${key
      .split('|')
      .map((f) => `family=${encodeURIComponent(f).replace(/%20/g, '+')}:wght@400;500;600`)
      .join('&')}&display=swap`;
    document.head.appendChild(link);
  }, [key]);
}

export const fontStack = (name: string | undefined, kind: 'display' | 'body') => {
  if (!name || name === 'Cormorant Garamond') return kind === 'display' ? 'var(--font-display)' : 'var(--font-sans)';
  if (name === 'Instrument Sans') return 'var(--font-sans)';
  return `'${name}', ${kind === 'display' ? 'Georgia, serif' : 'Helvetica, sans-serif'}`;
};

export interface CardFaceProps {
  layout?: string;
  theme?: string;
  fields: { name?: string; title?: string; department?: string; photoUrl?: string };
  translations?: Record<string, { name?: string; title?: string }>;
  brand?: Brand;
  side?: 'front' | 'back';
  url?: string;
  width?: number | string;
  className?: string;
  /** Material overrides the theme for physical NFC cards */
  material?: { bg: string; fg: string };
}

/** The physical / wallet-sized card (ISO ratio 1.586). */
export function CardFace({ layout = 'classic', theme = 'obsidian_gold', fields, translations, brand, side = 'front', url, width = 340, className = '', material }: CardFaceProps) {
  useBrandFonts(brand);
  const t = resolveTheme(theme, brand);
  // Obsidian carries the metal sheen from the designs; other themes are solid colour
  const bg = material
    ? material.bg
    : theme === 'obsidian_gold'
      ? 'linear-gradient(135deg,#1C1C20,#0E0E10 45%,#26262C 58%,#0C0C0E)'
      : t.bg === t.bg2
        ? t.bg
        : `linear-gradient(135deg, ${t.bg}, ${t.bg2})`;
  const lineColor = theme === 'obsidian_gold' ? 'rgba(201,169,110,0.45)' : t.dark ? t.bg : '#E2DBCD';
  const fg = material?.fg || t.fg;
  const accent = material?.fg || t.accent;
  const company = (brand?.companyName || 'Your company').toUpperCase();
  const display = fontStack(brand?.fonts?.display, 'display');
  const body = fontStack(brand?.fonts?.body, 'body');
  const logo = t.dark ? brand?.logos?.dark || brand?.logos?.light : brand?.logos?.light;
  const ar = translations?.ar;
  const w = typeof width === 'number' ? `${width}px` : width;
  // Scale everything from the card's own width (container query units), so any size looks the same
  const u = (n: number) => `${((n / 340) * 100).toFixed(3)}cqw`;

  const frame: React.CSSProperties = {
    width: '100%',
    aspectRatio: '1.586',
    background: bg,
    color: fg,
    borderRadius: u(14),
    border: `1px solid ${material ? 'rgba(201,169,110,0.35)' : lineColor}`,
    boxShadow: '0 10px 22px rgba(23,23,27,0.10)',
    padding: u(22),
    boxSizing: 'border-box',
    fontFamily: body,
    position: 'relative',
    overflow: 'hidden',
  };

  const wrap = (el: React.ReactNode) => (
    <div className={className} style={{ width: w, containerType: 'inline-size' }}>
      {el}
    </div>
  );

  const Logo = ({ size }: { size: number }) =>
    logo ? <img src={logo} alt="" style={{ height: u(size), maxWidth: u(size * 4), objectFit: 'contain' }} /> : <Seal size={size} className="" />;

  if (side === 'back') {
    return wrap(
      <div style={{ ...frame, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: u(10) }} aria-label="Card back">
        <span style={{ color: accent }}>
          <Logo size={36} />
        </span>
        <div style={{ fontSize: u(9), letterSpacing: '0.3em', color: accent }}>TAP OR SCAN</div>
        {url && <div style={{ fontSize: u(10), opacity: 0.75, fontFamily: 'var(--font-mono)' }}>{url}</div>}
      </div>
    );
  }

  if (layout === 'executive') {
    return wrap(
      <div style={{ ...frame, padding: u(23), display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: accent }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: u(9) }}>
            <Logo size={23} />
            {!logo && <span style={{ fontSize: u(8.5), letterSpacing: '0.28em' }}>{company}</span>}
          </span>
          <Icon name="nfc" size={20} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: u(5) }}>
          <div style={{ fontFamily: display, fontSize: u(26), lineHeight: 1.05 }}>{fields.name || 'Full name'}</div>
          <div style={{ height: 1, width: u(43), background: accent }} />
          <div style={{ fontSize: u(10), letterSpacing: '0.06em', color: material ? fg : t.muted }}>{fields.title || 'Job title'}</div>
        </div>
      </div>
    );
  }

  if (layout === 'modern') {
    return wrap(
      <div style={{ ...frame, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {fields.photoUrl ? (
            <img src={fields.photoUrl} alt="" style={{ width: u(44), height: u(44), borderRadius: '50%', objectFit: 'cover', border: `1.5px solid ${accent}` }} />
          ) : (
            <span style={{ width: u(44), height: u(44), borderRadius: '50%', border: `1.5px solid ${accent}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: u(15), color: accent }}>
              {(fields.name || '?').split(' ').map((p) => p[0]).slice(0, 2).join('')}
            </span>
          )}
          <span style={{ fontSize: u(8.5), letterSpacing: '0.24em', color: accent, fontWeight: 600 }}>{company}</span>
        </div>
        <div>
          <div style={{ fontSize: u(22), fontWeight: 600, lineHeight: 1.1, letterSpacing: '-0.01em' }}>{fields.name || 'Full name'}</div>
          <div style={{ fontSize: u(11), opacity: 0.75, marginTop: u(4) }}>
            {[fields.title, fields.department].filter(Boolean).join(' · ') || 'Job title'}
          </div>
        </div>
      </div>
    );
  }

  if (layout === 'minimal') {
    return wrap(
      <div style={{ ...frame, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: u(8) }}>
        <span style={{ color: accent, marginBottom: u(4) }}>
          <Logo size={24} />
        </span>
        <div style={{ fontFamily: display, fontSize: u(24), lineHeight: 1.05 }}>{fields.name || 'Full name'}</div>
        <div style={{ fontSize: u(10), letterSpacing: '0.12em', opacity: 0.7, textTransform: 'uppercase' }}>{fields.title || 'Job title'}</div>
      </div>
    );
  }

  if (layout === 'arabic') {
    return wrap(
      <div dir="rtl" style={{ ...frame, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: u(9), letterSpacing: '0.2em', color: accent }}>{company}</span>
          <span style={{ color: accent }}>
            <Logo size={22} />
          </span>
        </div>
        <div>
          <div style={{ fontSize: u(22), lineHeight: 1.2, fontWeight: 500 }}>{ar?.name || fields.name || 'الاسم'}</div>
          <div style={{ fontSize: u(11), opacity: 0.8, marginTop: u(3) }}>{ar?.title || fields.title}</div>
          <div dir="ltr" style={{ fontFamily: display, fontSize: u(13), opacity: 0.7, marginTop: u(8), textAlign: 'right' }}>
            {fields.name}
          </div>
        </div>
      </div>
    );
  }

  // classic
  return wrap(
    <div style={{ ...frame, padding: u(23), display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
      <div style={{ fontSize: u(9.5), letterSpacing: '0.28em', color: accent }}>{company}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: u(6) }}>
        <div style={{ fontFamily: display, fontSize: u(30), fontWeight: 400, lineHeight: 1.05 }}>{fields.name || 'Full name'}</div>
        <div style={{ height: 1, width: u(43), background: accent }} />
        <div style={{ fontSize: u(11), color: material ? fg : t.muted, letterSpacing: '0.06em' }}>{fields.title || 'Job title'}</div>
      </div>
    </div>
  );
}
