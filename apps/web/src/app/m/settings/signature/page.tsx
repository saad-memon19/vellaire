'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Icon, Seal } from '@/components/icons';
import { useToast } from '@/components/toast';
import { Button, copyText, cx, Loading } from '@/components/ui';
import { useApi } from '@/lib/api';
import { NoCard } from '../../no-card';
import { useMyCard } from '../../use-my-card';

// Video call backgrounds; each is drawn at 1920×1080 when downloaded
const BACKGROUNDS = {
  sand: { name: 'Sand', bg: '#EFE9DD', glow: 'rgba(176,141,79,0.35)', ink: '#17171B', label: '#876A33' },
  obsidian: { name: 'Obsidian', bg: '#141417', glow: 'rgba(201,169,110,0.28)', ink: '#F6F1E7', label: '#C9A96E' },
  office: { name: 'Office', bg: '#DCDAD5', glow: 'rgba(255,255,255,0.55)', ink: '#17171B', label: '#5E5952' },
} as const;
type Bg = keyof typeof BACKGROUNDS;

/** Signature and call background: copy the email signature, download a branded video background. Design: SignatureBackground. */
export default function SignatureBackground() {
  const { data, error } = useMyCard();
  const { data: sig } = useApi<{ html: string }>('/me/signature', { shouldRetryOnError: false });
  const [bg, setBg] = useState<Bg>('sand');
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  if (error) return <NoCard />;
  if (!data) return <Loading />;
  const f = data.card.fields;
  const company = data.card.brand?.companyName || '';
  const b = BACKGROUNDS[bg];

  const copy = async () => {
    if (!sig?.html) return;
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'text/html': new Blob([sig.html], { type: 'text/html' }), 'text/plain': new Blob([sig.html], { type: 'text/plain' }) })]);
    } catch {
      await copyText(sig.html);
    }
    toast('Signature copied. Paste it in your mail app’s signature settings.');
  };

  const download = async () => {
    setBusy(true);
    try {
      const W = 1920;
      const H = 1080;
      const c = document.createElement('canvas');
      c.width = W;
      c.height = H;
      const g = c.getContext('2d')!;
      g.fillStyle = b.bg;
      g.fillRect(0, 0, W, H);
      const glow = g.createRadialGradient(W * 0.85, H * 0.1, 0, W * 0.85, H * 0.1, W * 0.7);
      glow.addColorStop(0, b.glow);
      glow.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = glow;
      g.fillRect(0, 0, W, H);
      await document.fonts.ready;
      g.fillStyle = b.label;
      g.font = '600 30px "Instrument Sans", sans-serif';
      g.letterSpacing = '8px';
      g.fillText(company.toUpperCase(), 90, 110);
      g.letterSpacing = '0px';
      // QR panel bottom right: the person's real card link
      const qr = await loadImage('/api/me/qr');
      const box = 330;
      const x = W - box - 70;
      const y = H - box - 70;
      g.fillStyle = '#FFFFFF';
      roundRect(g, x - 20, y - 20, box + 40 + 330, box + 40, 24);
      g.drawImage(qr, x, y, box, box);
      g.fillStyle = '#17171B';
      g.font = '600 40px "Instrument Sans", sans-serif';
      g.fillText(f.name, x + box + 30, y + box / 2 - 6);
      g.fillStyle = '#5E5952';
      g.font = '28px "Instrument Sans", sans-serif';
      g.fillText('Scan to connect', x + box + 30, y + box / 2 + 40);
      const a = document.createElement('a');
      a.href = c.toDataURL('image/png');
      a.download = `${f.name} call background.png`;
      a.click();
    } catch (e) {
      toast((e as Error).message, 'err');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Link href="/m/settings" aria-label="Back" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-linen bg-white text-ink">
          <Icon name="left" size={20} />
        </Link>
        <h1 className="m-0 flex-1 font-display text-[26px] font-medium leading-tight">Signature and background</h1>
      </div>

      <section className="flex flex-col gap-3 rounded-2xl border border-linen bg-white p-4">
        <span className="text-[15px] font-semibold">Email signature</span>
        {sig?.html ? (
          <div className="overflow-x-auto rounded-xl border border-[#EEE8DD] bg-[#FBFAF7] p-3.5" dangerouslySetInnerHTML={{ __html: sig.html }} />
        ) : (
          <p className="text-[13px] text-stone">Your signature appears once your card is live.</p>
        )}
        <span className="text-[13px] text-stone">Copy it, then paste it in Outlook, Gmail or your phone’s mail app signature settings.</span>
        <Button size="lg" disabled={!sig?.html} onClick={copy}>
          Copy signature
        </Button>
      </section>

      <section className="flex flex-col gap-3 rounded-2xl border border-linen bg-white p-4">
        <span className="text-[15px] font-semibold">Video call background</span>
        <div className="relative aspect-video overflow-hidden rounded-xl" style={{ background: `radial-gradient(70% 90% at 85% 10%, ${b.glow}, rgba(0,0,0,0) 70%), ${b.bg}` }}>
          <span className="absolute bottom-0 left-1/2 h-[90px] w-[110px] -translate-x-1/2 rounded-t-[55px] bg-ink/10" aria-hidden="true" />
          <span className="absolute left-3.5 top-3 flex items-center gap-1.5">
            <Seal size={16} className="text-gold" />
            <span className="text-[8px] font-semibold tracking-[0.28em]" style={{ color: b.label }}>
              {company.toUpperCase()}
            </span>
          </span>
          <span className="absolute bottom-3 right-3 flex items-center gap-2 rounded-lg bg-white p-2">
            <img src="/api/me/qr" alt="" className="h-[34px] w-[34px]" />
            <span className="flex flex-col text-[8.5px] leading-tight text-stone">
              <b className="text-ink">{f.name}</b>Scan to connect
            </span>
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Background">
          {(Object.keys(BACKGROUNDS) as Bg[]).map((k) => (
            <button key={k} type="button" role="radio" aria-checked={bg === k} onClick={() => setBg(k)} className={cx('h-10 rounded-[10px] text-[12.5px]', bg === k ? 'border-2 border-gold bg-[#FBF6EC]' : 'border border-linen bg-white')}>
              {BACKGROUNDS[k].name}
            </button>
          ))}
        </div>
        <Button variant="ink" size="lg" icon="download" loading={busy} onClick={download}>
          Download for Zoom, Teams, Meet
        </Button>
      </section>
    </div>
  );
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((ok, fail) => {
    const i = new Image();
    i.onload = () => ok(i);
    i.onerror = () => fail(new Error('Could not load your QR code'));
    i.src = src;
  });
}

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  g.roundRect(x, y, w, h, r);
  g.fill();
}
