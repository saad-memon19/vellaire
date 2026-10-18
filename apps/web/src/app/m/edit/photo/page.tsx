'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { Icon } from '@/components/icons';
import { useToast } from '@/components/toast';
import { Avatar, Button, Loading } from '@/components/ui';
import { api } from '@/lib/api';
import { NoCard } from '../../no-card';
import { useMyCard } from '../../use-my-card';

const BOX = 260; // the preview square, as in the design
const RING = 240; // the round crop inside it

/** Pick or take a photo, place it in the round frame, send it (for approval when the company asks). Design: PhotoChange. */
export default function PhotoChange() {
  const { data, error, mutate } = useMyCard();
  const router = useRouter();
  const toast = useToast();
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [busy, setBusy] = useState(false);
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null);

  if (error) return <NoCard />;
  if (!data) return <Loading className="min-h-screen" />;

  const pick = (file?: File) => {
    if (!file) return;
    const i = new Image();
    i.onload = () => {
      setImg(i);
      setZoom(1);
      setPos({ x: 0, y: 0 });
    };
    i.src = URL.createObjectURL(file);
  };

  // The photo covers the frame at zoom 1; drag moves it, the slider zooms
  const base = img ? Math.max(BOX / img.width, BOX / img.height) : 1;
  const w = img ? img.width * base * zoom : 0;
  const h = img ? img.height * base * zoom : 0;
  const clamp = (p: { x: number; y: number }) => ({ x: Math.min(Math.max(p.x, (BOX - w) / 2), (w - BOX) / 2), y: Math.min(Math.max(p.y, (BOX - h) / 2), (h - BOX) / 2) });
  // Kept inside the frame after zooming out too
  const at = clamp(pos);

  const send = async () => {
    if (!img) return;
    setBusy(true);
    try {
      // Crop exactly what the ring shows, at 800 px
      const out = 800;
      const c = document.createElement('canvas');
      c.width = c.height = out;
      const k = out / RING;
      const left = (BOX - w) / 2 + at.x - (BOX - RING) / 2;
      const top = (BOX - h) / 2 + at.y - (BOX - RING) / 2;
      c.getContext('2d')!.drawImage(img, left * k, top * k, w * k, h * k);
      const blob = await new Promise<Blob>((ok, fail) => c.toBlob((b) => (b ? ok(b) : fail(new Error('Could not read this photo'))), 'image/jpeg', 0.88));
      const up = await api.upload(new File([blob], 'photo.jpg', { type: 'image/jpeg' }));
      const r = await api.patch<{ message: string }>('/me/card', { photoUrl: up.url });
      toast(r.message || 'Photo updated');
      await mutate();
      router.replace('/m/edit');
    } catch (e) {
      toast((e as Error).message, 'err');
      setBusy(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col gap-4 px-5 pb-[30px] pt-14">
      <div className="flex items-center gap-3">
        <Link href="/m/edit" aria-label="Back" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-linen bg-white text-ink">
          <Icon name="left" size={20} />
        </Link>
        <h1 className="m-0 flex-1 font-display text-[28px] font-medium">Profile photo</h1>
      </div>

      <div className="flex flex-col items-center gap-3.5 py-2">
        <div
          className="relative touch-none overflow-hidden rounded-[20px] bg-[linear-gradient(160deg,#CFC6B5,#A69B87)]"
          style={{ width: BOX, height: BOX }}
          onPointerDown={(e) => {
            if (!img) return;
            (e.target as Element).setPointerCapture(e.pointerId);
            drag.current = { x: e.clientX, y: e.clientY, px: at.x, py: at.y };
          }}
          onPointerMove={(e) => drag.current && setPos(clamp({ x: drag.current.px + e.clientX - drag.current.x, y: drag.current.py + e.clientY - drag.current.y }))}
          onPointerUp={() => (drag.current = null)}
        >
          {img ? (
            <img src={img.src} alt="" draggable={false} className="absolute max-w-none select-none" style={{ width: w, height: h, left: (BOX - w) / 2 + at.x, top: (BOX - h) / 2 + at.y }} />
          ) : (
            <span className="absolute inset-0 flex items-center justify-center">
              <Avatar name={data.card.fields.name} src={data.card.fields.photoUrl} size={150} />
            </span>
          )}
          <span className="pointer-events-none absolute left-1/2 top-1/2 rounded-full border-2 border-white shadow-[0_0_0_999px_rgba(23,23,27,0.45)]" style={{ width: RING, height: RING, marginLeft: -RING / 2, marginTop: -RING / 2 }} />
        </div>
        {img ? (
          <label className="flex w-[260px] items-center gap-3 text-[13px] text-stone">
            Zoom
            <input type="range" min={1} max={3} step={0.01} value={zoom} onChange={(e) => setZoom(+e.target.value)} className="flex-1 accent-ink" />
          </label>
        ) : (
          <span className="text-[13px] text-stone">Take or choose a photo, then drag to place it</span>
        )}
        {img && <span className="text-[13px] text-stone">Drag to move · slide to zoom</span>}
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <label className="flex h-12 cursor-pointer items-center justify-center gap-2.5 rounded-[14px] border border-[#D9D2C4] bg-white text-[15px]">
          <Icon name="scan" size={20} className="text-gold-text" /> Take photo
          <input type="file" accept="image/*" capture="user" className="sr-only" onChange={(e) => pick(e.target.files?.[0])} />
        </label>
        <label className="flex h-12 cursor-pointer items-center justify-center rounded-[14px] border border-[#D9D2C4] bg-white text-[15px]">
          Choose photo
          <input type="file" accept="image/*" className="sr-only" onChange={(e) => pick(e.target.files?.[0])} />
        </label>
      </div>

      {/* Not built yet: AI evening out backgrounds */}
      <div className="flex items-center gap-3 rounded-2xl border border-linen bg-white px-4 py-3.5 opacity-60">
        <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-gold-tint text-gold-text">
          <Icon name="sparkle" size={18} />
        </span>
        <span className="flex flex-1 flex-col gap-0.5">
          <span className="font-medium">Match team style</span>
          <span className="text-[12.5px] text-stone">Coming soon · AI evens the background and light</span>
        </span>
      </div>

      {data.photoApproval && (
        <div className="flex items-start gap-3 rounded-[14px] border border-[#EBD3A8] bg-[#FBF0DC] px-4 py-3.5 text-[13.5px] leading-normal text-[#4E4A44]">
          <Icon name="info" size={20} className="shrink-0 text-[#8A5A12]" />
          <span>A Brand Manager approves new photos. Your current photo stays live until then.</span>
        </div>
      )}

      <Button variant="ink" size="lg" className="mt-auto" disabled={!img} loading={busy} onClick={send}>
        {data.photoApproval ? 'Send for approval' : 'Use this photo'}
      </Button>
    </main>
  );
}
