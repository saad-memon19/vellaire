'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useToast } from '@/components/toast';
import { api, useApi, useMe } from '@/lib/api';
import { qrMatrix, qrSvg, svgToPng, toDataUri, type QrStyle } from '@/lib/qr';

interface DotShape {
  id: string;
  name: string;
  r: string;
}

interface ColorOption {
  name: string;
  fg: string;
  bg: string;
}

const DOT_SHAPES: DotShape[] = [
  { id: 'rounded', name: 'Rounded', r: '30%' },
  { id: 'square', name: 'Square', r: '0' },
  { id: 'dots', name: 'Dots', r: '50%' },
];

const COLORS: ColorOption[] = [
  { name: 'Ink on white', fg: '#17171B', bg: '#FFFFFF' },
  { name: 'Gold on white', fg: '#876A33', bg: '#FFFFFF' },
  { name: 'White on ink', fg: '#FFFFFF', bg: '#17171B' },
  { name: 'Navy', fg: '#13203A', bg: '#FFFFFF' },
];

const USES = [
  {
    n: 'Name badges',
    s: 'Events and conferences',
    d: 'M7 3h10v18H7zM10 7h4',
  },
  {
    n: 'Office signage',
    s: 'Reception and meeting rooms',
    d: 'M4 21V5l8-2v18M12 8h8v13',
  },
  {
    n: 'Printed brochures',
    s: 'Print PDF with bleed',
    d: 'M7 3h8l4 4v14H7z',
  },
  {
    n: 'Video call backgrounds',
    s: 'Built into each background',
    d: 'M3 6h12v12H3zM15 10l6-3v10l-6-3',
  },
];

export default function QrStudio() {
  const [dotShape, setDotShape] = useState<string>('rounded');
  const [colorIdx, setColorIdx] = useState<number>(0);
  const [centerLogo, setCenterLogo] = useState<'logo' | 'seal' | 'none'>('logo');
  const [frameText, setFrameText] = useState<string>('Scan to connect');
  const [saving, setSaving] = useState(false);
  const toast = useToast();
  const cardRef = useRef<HTMLDivElement>(null);
  const { data: me } = useMe();
  const { data: studio, mutate } = useApi<any>('/cards/qr-studio');

  // Start from the style the company saved
  useEffect(() => {
    const s = studio?.style as QrStyle | undefined;
    if (!s) return;
    setDotShape(s.shape);
    const i = COLORS.findIndex((c) => c.fg.toLowerCase() === s.fg.toLowerCase() && c.bg.toLowerCase() === s.bg.toLowerCase());
    setColorIdx(i < 0 ? 0 : i);
    setCenterLogo(s.centre);
    setFrameText(s.frameText);
  }, [studio?.style]);

  const selectedShape = DOT_SHAPES.find((s) => s.id === dotShape) || DOT_SHAPES[0];
  const selectedColor = COLORS[colorIdx] || COLORS[0];
  const style: QrStyle = { shape: dotShape as QrStyle['shape'], fg: selectedColor.fg, bg: selectedColor.bg, centre: centerLogo, frameText };
  // A real, scannable code: one of the company's live cards
  const link = studio?.sampleUrl || 'https://vellaire.app';
  const qr = useMemo(() => qrMatrix(link, centerLogo !== 'none'), [link, centerLogo]);
  const cells = qr.cells;
  const fileName = `${me?.company?.slug || 'vellaire'}-qr`;

  const handleSaveCompanyStyle = async () => {
    setSaving(true);
    try {
      await api.patch('/cards/qr-style', style);
      mutate();
      toast('Saved as company QR style. Every card QR now uses it', 'ok');
    } catch (e) {
      toast((e as Error).message, 'err');
    } finally {
      setSaving(false);
    }
  };

  const svgFile = async () => qrSvg(link, style, centerLogo === 'logo' ? await toDataUri(me?.company?.logo) : undefined);

  const download = (href: string, name: string) => {
    const a = document.createElement('a');
    a.download = name;
    a.href = href;
    a.click();
  };

  const handleDownloadPng = async () => {
    download(await svgToPng(await svgFile(), 1000), `${fileName}.png`);
    toast('Downloaded QR code PNG', 'ok');
  };

  const handleDownloadSvg = async () => {
    const url = URL.createObjectURL(new Blob([await svgFile()], { type: 'image/svg+xml' }));
    download(url, `${fileName}.svg`);
    URL.revokeObjectURL(url);
    toast('Downloaded QR code SVG', 'ok');
  };

  // Prints just the code and its frame text; "Save as PDF" in the print dialog gives the file
  const handleDownloadPdf = async () => {
    const w = window.open('', '_blank');
    if (!w) return toast('Allow pop-ups to print the QR code', 'err');
    const label = frameText ? `<p style="font:600 14px sans-serif;letter-spacing:.22em;color:#876A33">${frameText.toUpperCase().replace(/</g, '&lt;')}</p>` : '';
    w.document.write(
      `<title>${fileName}</title><body style="margin:0;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;background:${style.bg}"><div style="width:9cm">${await svgFile()}</div>${label}</body>`,
    );
    w.document.querySelector('svg')?.setAttribute('width', '100%');
    w.document.querySelector('svg')?.removeAttribute('height');
    w.document.close();
    setTimeout(() => w.print(), 300);
  };

  return (
    <div className="flex w-full max-w-[1320px] flex-col gap-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div className="flex flex-col gap-1.5">
          <div className="text-[12px] font-medium tracking-[0.2em] text-[#876A33]">SHARING</div>
          <h1 className="m-0 font-display text-[46px] font-normal leading-[1.05] text-[#17171B]">QR codes</h1>
          <p className="m-0 text-[15px] text-[#5E5952]">
            Design one QR style for the whole company. Links never change, so printed codes keep working.
          </p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <a
            href="/api/cards/qr-codes.zip"
            download
            className="flex h-11 items-center rounded-lg border border-[#D9D2C4] bg-white px-4 text-[14px] text-[#17171B] hover:border-[#17171B]"
          >
            Download all · {(studio?.liveCards ?? 0).toLocaleString()}
          </a>
          <button
            type="button"
            disabled={saving || !studio}
            onClick={handleSaveCompanyStyle}
            className="h-11 cursor-pointer rounded-lg bg-[#17171B] px-5 text-[14px] font-semibold text-white hover:bg-[#2E2E35]"
          >
            Save as company style
          </button>
        </div>
      </div>

      {/* 2-Row Studio Layout matching Claude design */}
      <div className="flex flex-wrap items-start gap-5">
        {/* Top-Left: Controls */}
        <section
          className="flex min-w-0 flex-col gap-[22px] rounded-[16px] border border-[#E6E0D5] bg-white p-[22px]"
          style={{ flex: '1 1 460px' }}
        >
          {/* Dot Shape */}
          <div className="flex flex-col gap-2.5">
            <span className="text-[14px] font-semibold text-[#17171B]">Dot shape</span>
            <div className="grid grid-cols-3 gap-2">
              {DOT_SHAPES.map((d) => {
                const active = dotShape === d.id;
                return (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => setDotShape(d.id)}
                    className="flex h-[70px] cursor-pointer flex-col items-center justify-center gap-1.5 rounded-[10px] text-[#17171B] transition-colors"
                    style={{
                      background: active ? '#FBF6EC' : '#FFFFFF',
                      border: active ? '2px solid #B08D4F' : '1px solid #E6E0D5',
                    }}
                  >
                    <span className="flex gap-[3px]">
                      <span className="h-2.5 w-2.5 bg-[#17171B]" style={{ borderRadius: d.r }} />
                      <span className="h-2.5 w-2.5 bg-[#17171B]" style={{ borderRadius: d.r }} />
                      <span className="h-2.5 w-2.5 bg-[#17171B]" style={{ borderRadius: d.r }} />
                    </span>
                    <span className="text-[12px]">{d.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Colours */}
          <div className="flex flex-col gap-2.5">
            <span className="text-[14px] font-semibold text-[#17171B]">Colours</span>
            <div className="flex flex-wrap gap-2.5">
              {COLORS.map((c, i) => {
                const active = colorIdx === i;
                return (
                  <button
                    key={c.name}
                    type="button"
                    aria-label={c.name}
                    onClick={() => setColorIdx(i)}
                    className="h-11 w-11 cursor-pointer rounded-full transition-transform hover:scale-105"
                    style={{
                      backgroundColor: c.fg,
                      border: `3px solid ${active ? '#B08D4F' : '#E6E0D5'}`,
                      boxShadow: `inset 0 0 0 3px #FFFFFF, inset 0 0 0 22px ${c.bg}`,
                    }}
                  />
                );
              })}
            </div>
          </div>

          {/* Centre */}
          <div className="flex flex-col gap-2.5">
            <span className="text-[14px] font-semibold text-[#17171B]">Centre</span>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setCenterLogo('logo')}
                className="h-11 cursor-pointer rounded-lg text-[13px] transition-colors"
                style={{
                  border: centerLogo === 'logo' ? '2px solid #B08D4F' : '1px solid #E6E0D5',
                  backgroundColor: centerLogo === 'logo' ? '#FBF6EC' : '#FFFFFF',
                  color: '#17171B',
                }}
              >
                Company logo
              </button>
              <button
                type="button"
                onClick={() => setCenterLogo('seal')}
                className="h-11 cursor-pointer rounded-lg text-[13px] transition-colors"
                style={{
                  border: centerLogo === 'seal' ? '2px solid #B08D4F' : '1px solid #E6E0D5',
                  backgroundColor: centerLogo === 'seal' ? '#FBF6EC' : '#FFFFFF',
                  color: '#17171B',
                }}
              >
                Vellaire seal
              </button>
              <button
                type="button"
                onClick={() => setCenterLogo('none')}
                className="h-11 cursor-pointer rounded-lg text-[13px] transition-colors"
                style={{
                  border: centerLogo === 'none' ? '2px solid #B08D4F' : '1px solid #E6E0D5',
                  backgroundColor: centerLogo === 'none' ? '#FBF6EC' : '#FFFFFF',
                  color: '#17171B',
                }}
              >
                None
              </button>
            </div>
          </div>

          {/* Frame Text */}
          <div className="flex flex-col gap-2">
            <label htmlFor="cta" className="text-[14px] font-semibold text-[#17171B]">
              Frame text
            </label>
            <input
              id="cta"
              type="text"
              value={frameText}
              onChange={(e) => setFrameText(e.target.value)}
              className="h-11 rounded-lg border border-[#E0D9CC] px-3 text-[14px] text-[#17171B] outline-none focus:border-[#B08D4F]"
            />
          </div>

          {/* High Contrast Indicator */}
          <div className="flex items-center gap-3 rounded-[10px] bg-[#E5F2EB] p-3.5 text-[13.5px] text-[#1F7A55]">
            <svg className="h-[18px] w-[18px] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12.5l4.5 4.5L19 7.5" />
            </svg>
            <span className="whitespace-nowrap">High contrast · easy to scan, even printed small</span>
          </div>
        </section>

        {/* Top-Right: Live Preview Card */}
        <section
          className="flex min-w-0 flex-col items-center gap-[22px] rounded-[16px] bg-[#EFE9DD] p-8"
          style={{ flex: '1 1 460px' }}
        >
          <div
            ref={cardRef}
            className="flex flex-col items-center gap-3.5 rounded-[22px] px-[26px] pb-[18px] pt-[26px] shadow-[0_24px_48px_rgba(23,23,27,0.14)]"
            style={{ backgroundColor: selectedColor.bg }}
          >
            <div className="relative h-[250px] w-[250px]">
              {/* Real QR grid; its size depends on the link length */}
              <div className="grid h-[250px] w-[250px]" style={{ gridTemplateColumns: `repeat(${qr.n},minmax(0,1fr))` }}>
                {cells.map((on, idx) => (
                  <span
                    key={idx}
                    style={{
                      backgroundColor: on ? selectedColor.fg : 'transparent',
                      borderRadius: qr.finder(idx) ? 0 : selectedShape.r,
                    }}
                  />
                ))}
              </div>

              {/* Centre Logo Overlay */}
              {centerLogo === 'logo' && (
                <div className="absolute left-1/2 top-1/2 -ml-[29px] -mt-[29px] flex h-[58px] w-[58px] items-center justify-center rounded-[12px] bg-white shadow-sm">
                  {me?.company?.logo ? (
                    <img src={me.company.logo} alt="" className="h-11 w-11 rounded-[10px] object-contain" />
                  ) : (
                    <span className="flex h-11 w-11 items-center justify-center rounded-[10px] bg-[#17171B] font-display text-[22px] text-[#C9A96E]">
                      {(me?.company?.name || 'V').charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
              )}
              {centerLogo === 'seal' && (
                <div className="absolute left-1/2 top-1/2 -ml-[29px] -mt-[29px] flex h-[58px] w-[58px] items-center justify-center rounded-[12px] bg-white shadow-sm">
                  <svg className="h-9 w-9" viewBox="0 0 40 40" fill="none" stroke="#B08D4F" strokeWidth="1.2">
                    <circle cx="20" cy="20" r="18.5" />
                    <rect x="17.6" y="8" width="4.8" height="21" rx="0.8" transform="rotate(-20 20 29)" />
                    <rect x="17.6" y="8" width="4.8" height="21" rx="0.8" transform="rotate(20 20 29)" />
                  </svg>
                </div>
              )}
            </div>

            {/* Bottom Frame Label */}
            {frameText && (
              <span className="text-[12px] font-semibold tracking-[0.22em] text-[#876A33]">
                {frameText.toUpperCase()}
              </span>
            )}
          </div>

          {/* Download Buttons */}
          <div className="flex flex-wrap justify-center gap-2">
            <button
              type="button"
              onClick={handleDownloadPng}
              className="h-10 cursor-pointer rounded-lg border border-[#D9D2C4] bg-white px-4 text-[13.5px] text-[#17171B] hover:border-[#17171B]"
            >
              PNG
            </button>
            <button
              type="button"
              onClick={handleDownloadSvg}
              className="h-10 cursor-pointer rounded-lg border border-[#D9D2C4] bg-white px-4 text-[13.5px] text-[#17171B] hover:border-[#17171B]"
            >
              SVG
            </button>
            <button
              type="button"
              onClick={handleDownloadPdf}
              className="h-10 cursor-pointer rounded-lg border border-[#D9D2C4] bg-white px-4 text-[13.5px] text-[#17171B] hover:border-[#17171B]"
            >
              Print PDF · 300 dpi
            </button>
          </div>
        </section>

        {/* Bottom: Where to use it & Stats */}
        <section
          className="flex min-w-0 flex-col gap-3.5 rounded-[16px] border border-[#E6E0D5] bg-white p-[22px]"
          style={{ flex: '1 1 100%' }}
        >
          <span className="text-[14px] font-semibold text-[#17171B]">Where to use it</span>
          {USES.map((u, i) => (
            <div key={i} className="flex items-center gap-3 border-t border-[#F0EBE2] py-2.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[9px] bg-[#F6EFE1] text-[#876A33]">
                <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d={u.d} />
                </svg>
              </span>
              <span className="flex flex-col">
                <span className="text-[14px] font-medium text-[#17171B]">{u.n}</span>
                <span className="text-[12.5px] text-[#6E685F]">{u.s}</span>
              </span>
            </div>
          ))}

          {/* Stats Box */}
          <div className="flex flex-col gap-1 border-t border-[#F0EBE2] pt-2.5">
            <span className="font-display text-[32px] font-semibold leading-tight text-[#17171B]">{(studio?.scans ?? 0).toLocaleString()}</span>
            <span className="text-[12.5px] text-[#5E5952]">
              QR scans in the last 30 days
              {studio?.scansChange != null && ` · ${studio.scansChange >= 0 ? '+' : ''}${studio.scansChange}%`}
            </span>
          </div>
        </section>
      </div>
    </div>
  );
}
