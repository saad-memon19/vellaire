'use client';

import { useMemo, useRef, useState } from 'react';
import { useToast } from '@/components/toast';

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
  const toast = useToast();
  const cardRef = useRef<HTMLDivElement>(null);

  const selectedShape = DOT_SHAPES.find((s) => s.id === dotShape) || DOT_SHAPES[0];
  const selectedColor = COLORS[colorIdx] || COLORS[0];

  // Deterministic QR cell pattern matching Claude design (25x25)
  const cells = useMemo(() => {
    const N = 25;
    let seed = 11;
    const rnd = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };
    const finder = (r: number, c: number, r0: number, c0: number) => {
      const y = r - r0;
      const x = c - c0;
      if (y < 0 || x < 0 || y > 6 || x > 6) return null;
      if (y === 0 || y === 6 || x === 0 || x === 6) return true;
      return y >= 2 && y <= 4 && x >= 2 && x <= 4;
    };

    const res: boolean[] = [];
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        let on = finder(r, c, 0, 0);
        if (on === null) on = finder(r, c, 0, N - 7);
        if (on === null) on = finder(r, c, N - 7, 0);
        const near = (r <= 7 && c <= 7) || (r <= 7 && c >= N - 8) || (r >= N - 8 && c <= 7);
        // Clear center area if a logo is chosen
        const isCenter = centerLogo !== 'none' && r >= 10 && r <= 14 && c >= 10 && c <= 14;
        if (isCenter) {
          on = false;
        } else {
          if (on === null && near) on = false;
          if (on === null) on = rnd() > 0.52;
        }
        res.push(!!on);
      }
    }
    return res;
  }, [centerLogo]);

  const handleSaveCompanyStyle = () => {
    toast('Saved as company QR style', 'ok');
  };

  const handleDownloadPng = () => {
    const canvas = document.createElement('canvas');
    const size = 1000;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = selectedColor.bg;
    ctx.fillRect(0, 0, size, size);

    const N = 25;
    const pad = 100;
    const cellSize = (size - pad * 2) / N;
    ctx.fillStyle = selectedColor.fg;

    const rRadius = dotShape === 'rounded' ? cellSize * 0.3 : dotShape === 'dots' ? cellSize * 0.5 : 0;

    cells.forEach((on, idx) => {
      if (!on) return;
      const r = Math.floor(idx / N);
      const c = idx % N;
      const x = pad + c * cellSize;
      const y = pad + r * cellSize;
      if (rRadius > 0) {
        ctx.beginPath();
        ctx.roundRect(x, y, cellSize * 0.92, cellSize * 0.92, rRadius);
        ctx.fill();
      } else {
        ctx.fillRect(x, y, cellSize * 0.92, cellSize * 0.92);
      }
    });

    const link = document.createElement('a');
    link.download = `vellaire-qr-${dotShape}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    toast('Downloaded QR code PNG', 'ok');
  };

  const handleDownloadSvg = () => {
    const N = 25;
    const size = 500;
    const cellSize = size / N;
    const rRadius = dotShape === 'rounded' ? '2.5' : dotShape === 'dots' ? '4.5' : '0';

    let rects = '';
    cells.forEach((on, idx) => {
      if (!on) return;
      const r = Math.floor(idx / N);
      const c = idx % N;
      const x = (c * cellSize).toFixed(1);
      const y = (r * cellSize).toFixed(1);
      const w = (cellSize * 0.92).toFixed(1);
      rects += `<rect x="${x}" y="${y}" width="${w}" height="${w}" rx="${rRadius}" fill="${selectedColor.fg}"/>`;
    });

    const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}"><rect width="100%" height="100%" fill="${selectedColor.bg}"/>${rects}</svg>`;
    const blob = new Blob([svgContent], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = `vellaire-qr-${dotShape}.svg`;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
    toast('Downloaded QR code SVG', 'ok');
  };

  const handleDownloadPdf = () => {
    window.print();
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
            Download all · 1,248
          </a>
          <button
            type="button"
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
              {/* 25x25 QR Grid */}
              <div className="grid h-[250px] w-[250px] grid-cols-[repeat(25,minmax(0,1fr))]">
                {cells.map((on, idx) => (
                  <span
                    key={idx}
                    style={{
                      backgroundColor: on ? selectedColor.fg : 'transparent',
                      borderRadius: selectedShape.r,
                    }}
                  />
                ))}
              </div>

              {/* Centre Logo Overlay */}
              {centerLogo === 'logo' && (
                <div className="absolute left-1/2 top-1/2 -ml-[29px] -mt-[29px] flex h-[58px] w-[58px] items-center justify-center rounded-[12px] bg-white shadow-sm">
                  <span className="flex h-11 w-11 items-center justify-center rounded-[10px] bg-[#17171B] font-display text-[22px] text-[#C9A96E]">
                    M
                  </span>
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
            <span className="font-display text-[32px] font-semibold leading-tight text-[#17171B]">4,812</span>
            <span className="text-[12.5px] text-[#5E5952]">QR scans this month · +9%</span>
          </div>
        </section>
      </div>
    </div>
  );
}
