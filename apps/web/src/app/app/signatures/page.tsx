'use client';

import { useEffect, useRef, useState } from 'react';
import { useToast } from '@/components/toast';
import { ErrorState, Loading } from '@/components/ui';
import { api, useApi, useMe } from '@/lib/api';

/* Built to match design/Signatures.dc.html artboard 100% */

type SignatureStyle = 'Classic' | 'Compact' | 'With banner';
type Design = { style: SignatureStyle; photo: boolean; qr: boolean; phone: boolean; social: boolean; booking: boolean; legal: string };

const OPTIONS: { key: keyof Omit<Design, 'style' | 'legal'>; label: string }[] = [
  { key: 'photo', label: 'Profile photo' },
  { key: 'qr', label: 'QR code to the card' },
  { key: 'phone', label: 'Phone number' },
  { key: 'social', label: 'Social links' },
  { key: 'booking', label: 'Book a meeting link' },
];

// Mailbox deployment is not built yet; both rows say so
const MAILBOXES = [
  { id: 'm365', n: 'Microsoft 365 · Outlook' },
  { id: 'gw', n: 'Google Workspace · Gmail' },
];

export default function SignaturesPage() {
  const { data, error, mutate } = useApi<any>('/cards/signatures');
  const { data: me } = useMe();
  const toast = useToast();

  const [design, setDesign] = useState<Design | null>(null);
  const [html, setHtml] = useState('');
  // The design as last saved (or loaded), so only real changes are saved
  const saved = useRef<string | null>(null);

  const canEdit = ['owner', 'admin', 'brand_manager'].includes(me?.user?.role || '');

  useEffect(() => {
    if (data?.design && saved.current === null) {
      saved.current = JSON.stringify(data.design);
      setDesign(data.design);
    }
  }, [data?.design]);

  // Preview the real signature, and save the design a moment after each change
  useEffect(() => {
    if (!design) return;
    const t = setTimeout(async () => {
      try {
        setHtml((await api.post('/cards/signatures/preview', design)).html);
        const json = JSON.stringify(design);
        if (canEdit && json !== saved.current) {
          await api.patch('/cards/signatures', design);
          saved.current = json;
        }
      } catch (e) {
        toast((e as Error).message, 'err');
      }
    }, 500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [design]);

  if (error) return <ErrorState error={error} retry={() => mutate()} />;
  if (!data || !design) return <Loading />;

  const set = (patch: Partial<Design>) => setDesign({ ...design, ...patch });

  return (
    <div className="flex w-full max-w-[1320px] flex-col gap-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <div className="text-[12px] font-medium tracking-[0.2em] text-[#876A33]">SHARING</div>
          <h1 className="m-0 font-display text-[42px] font-normal leading-[1.05] text-[#17171B]">
            Email signatures
          </h1>
          <p className="m-0 text-[15px] text-[#5E5952]">
            One signature design for everyone. Changes save by themselves; employees copy theirs from the app.
          </p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <a
            href="/api/cards/signatures.zip"
            download
            className="flex h-11 cursor-pointer items-center rounded-lg border border-[#D9D2C4] bg-white px-4 text-[14px] text-[#17171B] transition-colors hover:border-[#17171B]"
          >
            Download HTML · {data.live.toLocaleString()}
          </a>
          <button
            type="button"
            disabled
            title="Coming soon"
            className="flex h-11 cursor-not-allowed items-center rounded-lg bg-[#17171B] px-[18px] text-[14px] font-semibold text-white opacity-50"
          >
            Deploy to all mailboxes
          </button>
        </div>
      </div>

      {/* Middle Row: Design Controls & Outlook Preview */}
      <div className="flex flex-wrap items-start gap-5">
        {/* Left Section: Design Controls */}
        <section
          className="flex min-w-0 flex-col gap-[18px] rounded-[14px] border border-[#E6E0D5] bg-white p-[22px]"
          style={{ flex: '1 1 340px' }}
        >
          <h2 className="m-0 text-[16px] font-semibold text-[#17171B]">Design</h2>

          {/* Style Selector Grid */}
          <div className="grid grid-cols-3 gap-2">
            {(['Classic', 'Compact', 'With banner'] as SignatureStyle[]).map((s) => {
              const active = design.style === s;
              return (
                <button
                  key={s}
                  type="button"
                  disabled={!canEdit}
                  onClick={() => set({ style: s })}
                  className="flex h-16 cursor-pointer items-center justify-center rounded-[10px] text-[13px] text-[#17171B] transition-all disabled:cursor-default"
                  style={{
                    backgroundColor: active ? '#FBF6EC' : '#FFFFFF',
                    border: active ? '2px solid #B08D4F' : '1px solid #E6E0D5',
                  }}
                >
                  {s}
                </button>
              );
            })}
          </div>

          {/* Options Checkboxes */}
          <div className="flex flex-col gap-2">
            {OPTIONS.map((o) => (
              <label key={o.key} className="flex cursor-pointer items-center gap-2.5 text-[14px] text-[#17171B]">
                <input
                  type="checkbox"
                  checked={design[o.key]}
                  disabled={!canEdit}
                  onChange={(e) => set({ [o.key]: e.target.checked })}
                  className="h-[17px] w-[17px] accent-[#17171B]"
                />
                {o.label}
              </label>
            ))}
          </div>

          {/* Legal Line Textarea */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="disc" className="text-[13px] font-medium text-[#17171B]">
              Legal line
            </label>
            <textarea
              id="disc"
              rows={2}
              value={design.legal}
              disabled={!canEdit}
              placeholder="Company legal disclaimer"
              onChange={(e) => set({ legal: e.target.value })}
              className="resize-y rounded-lg border border-[#E0D9CC] p-2.5 px-3 text-[13px] text-[#17171B] outline-none focus:border-[#B08D4F]"
            />
          </div>
        </section>

        {/* Right Section: Live Outlook Preview Card */}
        <section
          className="flex min-w-0 flex-col gap-3.5 rounded-[16px] bg-[#EFE9DD] p-7"
          style={{ flex: '2 1 480px' }}
        >
          {/* Outlook Window Mockup */}
          <div className="overflow-hidden rounded-[12px] bg-white shadow-[0_18px_36px_rgba(23,23,27,0.10)]">
            {/* Outlook Top Bar */}
            <div className="flex items-center gap-2 border-b border-[#EEE8DD] p-3 px-[18px] text-[12.5px] text-[#6E685F]">
              <span>Outlook preview</span>
              <span className="ml-auto">To: client@example.com</span>
            </div>

            {/* Email Body */}
            <div className="flex flex-col gap-[18px] p-[22px] text-[14px] text-[#2A2A30]">
              <div className="leading-relaxed">
                Dear Faisal,
                <br />
                <br />
                Thank you for your time today. I will send the proposal by Thursday.
                <br />
                <br />
                Kind regards,
              </div>

              {/* The real signature, as it is sent */}
              {html ? (
                <div className="overflow-x-auto pt-1.5" dangerouslySetInnerHTML={{ __html: html }} />
              ) : (
                <span className="text-[13px] text-[#6E685F]">Publish a card to see a signature here.</span>
              )}
            </div>
          </div>
        </section>
      </div>

      {/* Bottom Section: Deployment Table */}
      <section className="overflow-hidden rounded-[14px] border border-[#E6E0D5] bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 p-5">
          <h2 className="m-0 text-[16px] font-semibold text-[#17171B]">Deployment</h2>
        </div>

        <div className="overflow-x-auto">
          <div className="min-w-[640px]">
            {/* Table Header */}
            <div className="grid grid-cols-[1.6fr_1fr_1.2fr_1fr_120px] gap-3.5 bg-[#FAF8F3] px-5 py-2.5 text-[11px] font-medium tracking-[0.14em] text-[#6E685F]">
              <span>MAILBOX SYSTEM</span>
              <span>MAILBOXES</span>
              <span>LAST DEPLOYED</span>
              <span>STATUS</span>
              <span></span>
            </div>

            {/* Table Rows */}
            {MAILBOXES.map((r) => (
              <div
                key={r.id}
                className="grid grid-cols-[1.6fr_1fr_1.2fr_1fr_120px] items-center gap-3.5 border-t border-[#F0EBE2] px-5 py-[13px] text-[14px] transition-colors hover:bg-[#FAF7F1]"
              >
                <span className="font-semibold text-[#17171B]">{r.n}</span>
                <span className="text-[#17171B]">—</span>
                <span className="text-[#4E4A44]">Never</span>
                <span>
                  <span className="inline-block rounded-full bg-[#EFEBE3] px-2.5 py-[3px] text-[12px] font-medium text-[#4E4A44]">Coming soon</span>
                </span>
                <span className="justify-self-end">
                  <button
                    type="button"
                    disabled
                    className="h-8 cursor-not-allowed rounded-lg border border-[#E0D9CC] bg-white px-2.5 text-[12.5px] text-[#17171B] opacity-50"
                  >
                    Connect
                  </button>
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
