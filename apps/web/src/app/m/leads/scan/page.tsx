'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/icons';
import { useToast } from '@/components/toast';
import { Button, cx, Spinner } from '@/components/ui';
import { api, useMe } from '@/lib/api';
import { shrinkImage, toDataUrl } from '@/lib/image';

type Fields = { name: string; jobTitle: string; company: string; phone: string; email: string; note: string };
const EMPTY: Fields = { name: '', jobTitle: '', company: '', phone: '', email: '', note: '' };

/** Scan a paper card with the camera, then check what was read and save it as a lead. Design: ScanCard, ScanResult. */
export default function ScanCard() {
  const { data: me } = useMe();
  const [photo, setPhoto] = useState<string | null>(null);
  const [fields, setFields] = useState<Fields | null>(null);
  const [read, setRead] = useState<(keyof Fields)[]>([]);
  const [reading, setReading] = useState(false);
  const toast = useToast();

  // AI reads the photo when it is on; otherwise the details are typed in
  const use = async (file: Blob) => {
    setPhoto(URL.createObjectURL(file));
    if (!me?.features.ai) return setFields(EMPTY);
    setReading(true);
    try {
      const small = await shrinkImage(new File([file], 'card.jpg', { type: file.type || 'image/jpeg' }), 1600, 2_500_000);
      const type = small.type === 'image/png' || small.type === 'image/webp' ? small.type : 'image/jpeg';
      const out = await api.post<Record<string, string>>('/leads/scan', { image: await toDataUrl(small), mediaType: type });
      const got = (Object.keys(EMPTY) as (keyof Fields)[]).filter((k) => out[k]);
      setRead(got);
      setFields({ ...EMPTY, ...Object.fromEntries(got.map((k) => [k, out[k]])) });
    } catch (e) {
      toast((e as Error).message, 'err');
      setFields(EMPTY);
    } finally {
      setReading(false);
    }
  };

  if (fields) return <Result photo={photo} fields={fields} read={read} ai={!!me?.features.ai} onBack={() => (setFields(null), setPhoto(null), setRead([]))} />;
  return <Camera onShot={use} reading={reading} />;
}

function Camera({ onShot, reading }: { onShot: (b: Blob) => void; reading: boolean }) {
  const video = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [failed, setFailed] = useState(false);
  const [torch, setTorch] = useState<boolean | null>(null);

  useEffect(() => {
    let s: MediaStream | null = null;
    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1920 } }, audio: false })
      .then((m) => {
        s = m;
        setStream(m);
        if (video.current) video.current.srcObject = m;
        const caps = (m.getVideoTracks()[0]?.getCapabilities?.() || {}) as { torch?: boolean };
        setTorch(caps.torch ? false : null);
      })
      .catch(() => setFailed(true));
    if (!navigator.mediaDevices) setFailed(true);
    return () => s?.getTracks().forEach((t) => t.stop());
  }, []);

  const shoot = () => {
    const v = video.current;
    if (!v || !v.videoWidth) return;
    const c = document.createElement('canvas');
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    c.getContext('2d')!.drawImage(v, 0, 0);
    c.toBlob((b) => b && onShot(b), 'image/jpeg', 0.9);
  };
  const flash = async () => {
    const t = stream?.getVideoTracks()[0];
    if (!t || torch === null) return;
    await t.applyConstraints({ advanced: [{ torch: !torch } as MediaTrackConstraintSet] }).catch(() => {});
    setTorch(!torch);
  };

  return (
    <main className="relative flex min-h-screen flex-col gap-4 overflow-hidden bg-[#0E0E10] px-5 pb-[34px] pt-14 text-white">
      <div className="relative z-10 flex items-center justify-between">
        <Link href="/m/leads" aria-label="Close" className="flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-white">
          <Icon name="x" size={20} />
        </Link>
        <span className="text-[15px] font-semibold">Scan a paper card</span>
        {torch !== null ? (
          <button type="button" aria-label="Flash" aria-pressed={torch} onClick={flash} className={cx('flex h-11 w-11 items-center justify-center rounded-full', torch ? 'bg-[#E6D3A3] text-ink' : 'bg-white/15 text-white')}>
            <Icon name="sparkle" size={20} />
          </button>
        ) : (
          <span className="h-11 w-11" />
        )}
      </div>

      <div className="relative flex flex-1 items-center justify-center">
        {failed ? (
          <p className="max-w-[280px] text-center text-[14px] text-[#E8E3D9]">The camera is not available here. Choose a photo of the card instead.</p>
        ) : (
          <video ref={video} autoPlay playsInline muted className="absolute inset-0 h-full w-full rounded-2xl object-cover" />
        )}
        <div className="pointer-events-none absolute inset-x-[18px] inset-y-[120px] rounded-[20px] border-2 border-[#E6D3A3] shadow-[0_0_0_9999px_rgba(10,10,12,0.55)]" />
      </div>

      <div className="relative z-10 flex flex-col items-center gap-[18px]">
        <span className="flex items-center gap-2 text-[14px] text-[#E8E3D9]">
          {reading && <Spinner size={16} />}
          {reading ? 'Reading the card…' : 'Fit the card inside the frame'}
        </span>
        <div className="flex w-full items-center justify-between">
          <label className="flex h-[52px] w-[52px] cursor-pointer items-center justify-center rounded-xl bg-white/15 text-[11px]">
            Photos
            <input type="file" accept="image/*" className="sr-only" onChange={(e) => e.target.files?.[0] && onShot(e.target.files[0])} />
          </label>
          {failed ? (
            <label aria-label="Take photo" className="flex h-[76px] w-[76px] cursor-pointer items-center justify-center rounded-full border-4 border-white">
              <span className="h-[60px] w-[60px] rounded-full bg-white" />
              <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => e.target.files?.[0] && onShot(e.target.files[0])} />
            </label>
          ) : (
            <button type="button" aria-label="Take photo" disabled={reading || !stream} onClick={shoot} className="flex h-[76px] w-[76px] items-center justify-center rounded-full border-4 border-white disabled:opacity-50">
              <span className="h-[60px] w-[60px] rounded-full bg-white" />
            </button>
          )}
          <span className="h-[52px] w-[52px]" />
        </div>
      </div>
    </main>
  );
}

const LABELS: Record<keyof Fields, string> = { name: 'Full name', jobTitle: 'Job title', company: 'Company', phone: 'Phone', email: 'Email', note: 'Where you met' };
// Numbers and addresses are the easiest to misread, so they are marked for a second look
const CHECK: (keyof Fields)[] = ['phone', 'email'];

function Result({ photo, fields, read, ai, onBack }: { photo: string | null; fields: Fields; read: (keyof Fields)[]; ai: boolean; onBack: () => void }) {
  const [f, setF] = useState(fields);
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const toast = useToast();
  const check = CHECK.filter((k) => read.includes(k));

  const save = async () => {
    setBusy(true);
    try {
      const { id } = await api.post<{ id: string }>('/leads', { ...f, via: 'paper' });
      toast('Lead saved');
      router.replace(`/m/leads/${id}`);
    } catch (e) {
      toast((e as Error).message, 'err');
      setBusy(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col gap-4 px-5 pb-7 pt-14">
      <div className="flex items-center gap-3">
        <button type="button" aria-label="Back" onClick={onBack} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-linen bg-white text-ink">
          <Icon name="left" size={20} />
        </button>
        <h1 className="m-0 flex-1 font-display text-[28px] font-medium">Check the details</h1>
      </div>
      {read.length > 0 ? (
        <div className="flex items-center gap-3 rounded-[14px] bg-ok-bg px-3.5 py-3 text-[13.5px] text-ok">
          <Icon name="checkCircle" size={20} />
          AI read {read.length} {read.length === 1 ? 'field' : 'fields'}.{check.length ? ' Please check the ones in gold.' : ''}
        </div>
      ) : (
        <div className="flex items-center gap-3 rounded-[14px] bg-gold-tint px-3.5 py-3 text-[13.5px] text-gold-text">
          <Icon name="info" size={20} />
          {ai ? 'The card could not be read. Type the details from it.' : 'Type the details from the card.'}
        </div>
      )}
      {photo && <img src={photo} alt="The card you scanned" className="h-[120px] w-full rounded-[14px] object-cover" />}
      <section className="flex flex-col gap-3 rounded-2xl border border-linen bg-white p-4">
        {(Object.keys(LABELS) as (keyof Fields)[]).map((k) => (
          <label key={k} className="flex flex-col gap-[5px] text-[12.5px] text-stone">
            {LABELS[k]}
            {check.includes(k) ? ' · please check' : ''}
            <input
              value={f[k]}
              type={k === 'email' ? 'email' : k === 'phone' ? 'tel' : 'text'}
              placeholder={k === 'note' ? 'For example an event or a meeting' : undefined}
              onChange={(e) => setF({ ...f, [k]: e.target.value })}
              className={cx('h-11 rounded-[10px] border bg-white px-3 text-[14.5px] text-ink outline-none focus:border-gold', check.includes(k) ? 'border-[#D9B877]' : 'border-[#E0D9CC]')}
            />
          </label>
        ))}
      </section>
      <Button variant="ink" size="lg" loading={busy} disabled={!f.name.trim()} onClick={save}>
        Save lead
      </Button>
    </main>
  );
}
