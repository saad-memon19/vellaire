'use client';

import { useEffect, useMemo, useState } from 'react';
import { useToast } from '@/components/toast';
import { ErrorState, Loading } from '@/components/ui';
import { api, isManager, useApi, useMe } from '@/lib/api';
import { qrSvg } from '@/lib/qr';

/* Built to match design/WalletPasses.dc.html artboard 100% */

interface BackgroundOption {
  n: string;
  c: string;
  gradient: string;
  textColor: string;
  labelColor: string;
}

// Names match PASS_BACKGROUNDS in apps/api/src/modules/public/wallet.ts
const BACKGROUNDS: BackgroundOption[] = [
  { n: 'Obsidian', c: '#17171B', gradient: 'linear-gradient(160deg, #1A1A1E, #0E0E10)', textColor: '#F6F1E7', labelColor: '#A9A49A' },
  { n: 'Navy', c: '#13203A', gradient: 'linear-gradient(160deg, #162646, #0D1628)', textColor: '#F6F1E7', labelColor: '#8E9BB2' },
  { n: 'Emerald', c: '#0F2E25', gradient: 'linear-gradient(160deg, #13392E, #0A1F19)', textColor: '#F6F1E7', labelColor: '#88AB9F' },
  { n: 'Ivory', c: '#F6F1E7', gradient: 'linear-gradient(160deg, #FFFFFF, #EFE9DD)', textColor: '#17171B', labelColor: '#7A746A' },
];

export default function WalletPassesPage() {
  const { data, error, mutate } = useApi<any>('/cards/wallet');
  const { data: me } = useMe();
  const toast = useToast();

  const [selectedBgIdx, setSelectedBgIdx] = useState(0);
  const [fields, setFields] = useState({
    name: true,
    title: true,
    office: true,
    photo: true,
  });

  const [reminderModal, setReminderModal] = useState(false);
  const [busy, setBusy] = useState(false);

  // Start from the saved design
  useEffect(() => {
    if (!data?.design) return;
    const i = BACKGROUNDS.findIndex((b) => b.n === data.design.bg);
    setSelectedBgIdx(i < 0 ? 0 : i);
    setFields(data.design.fields);
  }, [data?.design]);

  // The real code on the pass: the sample card's link
  const qrSrc = useMemo(
    () => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(qrSvg(data?.sample?.url || 'https://vellaire.app', { shape: 'square', fg: '#17171B', bg: '#F6F1E7', centre: 'none', frameText: '' }))}`,
    [data?.sample?.url],
  );

  if (error) return <ErrorState error={error} retry={() => mutate()} />;
  if (!data) return <Loading />;

  const activeBg = BACKGROUNDS[selectedBgIdx];
  const companyName = me?.company?.name || '';
  const companyWord = companyName.split(' ')[0].toUpperCase();
  const employeeName = data.sample?.name || me?.user?.name || '';
  const manager = isManager(me?.user?.role);
  const walletReady = data.ready.apple || data.ready.google;
  const without = Math.max(0, data.live - data.installed);
  const share = data.live ? Math.round((data.installed / data.live) * 100) : 0;
  // Why reminders cannot go out yet, if they cannot
  const remindBlock = !walletReady ? 'Apple and Google Wallet are not set up yet' : !data.ready.mail ? 'Turns on once email is set up' : !without ? 'Everyone has a pass' : '';

  const kpis = [
    { label: 'PASSES INSTALLED', value: data.installed.toLocaleString(), note: `${share}% of live cards`, c: '#1F7A55' },
    { label: 'APPLE · GOOGLE', value: `${data.apple.toLocaleString()} · ${data.google.toLocaleString()}`, note: data.installed > data.apple + data.google ? `${(data.installed - data.apple - data.google).toLocaleString()} added before this split was recorded` : 'iPhone and Android', c: '#6E685F' },
    { label: 'UPDATES DELIVERED', value: '—', note: 'Coming soon', c: '#6E685F' },
    { label: 'WITHOUT A PASS', value: without.toLocaleString(), note: remindBlock || 'Send them a reminder', c: '#8A5A12' },
  ];

  // None of these run yet; shown as plans, not as done
  const rules = [
    'Send the pass in the welcome email for every new card',
    'Update passes when a title, phone or office changes in your HR system',
    "Void the pass on an employee's last day",
  ];

  const handleSaveDesign = async () => {
    setBusy(true);
    try {
      await api.patch('/cards/wallet', { bg: activeBg.n, fields });
      mutate();
      toast('Pass design saved. New passes use it', 'ok');
    } catch (e) {
      toast((e as Error).message, 'err');
    } finally {
      setBusy(false);
    }
  };

  const handleSendReminders = async () => {
    setBusy(true);
    try {
      const r = await api.post('/cards/wallet/remind');
      toast(`Reminder emailed to ${r.sent.toLocaleString()} people`, 'ok');
      setReminderModal(false);
    } catch (e) {
      toast((e as Error).message, 'err');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex w-full max-w-[1320px] flex-col gap-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <div className="text-[12px] font-medium tracking-[0.2em] text-[#876A33]">SHARING</div>
          <h1 className="m-0 font-display text-[42px] font-normal leading-[1.05] text-[#17171B]">
            Wallet passes
          </h1>
          <p className="m-0 text-[15px] text-[#5E5952]">
            Every employee can keep their card in Apple Wallet or Google Wallet. Passes update by themselves.
          </p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <button
            type="button"
            onClick={() => setReminderModal(true)}
            disabled={!!remindBlock || !manager}
            title={remindBlock || undefined}
            className="flex h-11 cursor-pointer items-center rounded-lg border border-[#D9D2C4] bg-white px-4 text-[14px] text-[#17171B] transition-colors hover:border-[#17171B] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Send to everyone without a pass
          </button>
          <button
            type="button"
            onClick={handleSaveDesign}
            disabled={busy || !['owner', 'admin', 'brand_manager'].includes(me?.user?.role || '')}
            className="flex h-11 cursor-pointer items-center rounded-lg bg-[#17171B] px-[18px] text-[14px] font-semibold text-white transition-colors hover:bg-[#2E2E35] disabled:opacity-50"
          >
            {busy ? 'Saving...' : 'Save design'}
          </button>
        </div>
      </div>

      {/* 4 KPI Metric Cards */}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(190px,100%),1fr))] gap-3">
        {kpis.map((k) => (
          <div
            key={k.label}
            className="flex flex-col gap-2 rounded-[14px] border border-[#E6E0D5] bg-white p-[18px]"
          >
            <span className="text-[11px] font-medium tracking-[0.16em] text-[#6E685F]">{k.label}</span>
            <span className="font-display text-[34px] font-normal leading-none text-[#17171B]">{k.value}</span>
            <span className="text-[12.5px]" style={{ color: k.c }}>{k.note}</span>
          </div>
        ))}
      </div>

      {/* Middle Row: Pass design & Live Pass Mockups */}
      <div className="flex flex-wrap items-start gap-5">
        {/* Left Section: Pass Design Controls */}
        <section
          className="flex min-w-0 flex-col gap-5 rounded-[14px] border border-[#E6E0D5] bg-white p-[22px]"
          style={{ flex: '1 1 360px' }}
        >
          <h2 className="m-0 text-[16px] font-semibold text-[#17171B]">Pass design</h2>

          {/* Background Swatches */}
          <div className="flex flex-col gap-2">
            <span className="text-[13px] font-medium text-[#17171B]">Background</span>
            <div className="flex gap-2.5">
              {BACKGROUNDS.map((b, idx) => {
                const active = selectedBgIdx === idx;
                return (
                  <button
                    key={b.n}
                    type="button"
                    aria-label={b.n}
                    onClick={() => setSelectedBgIdx(idx)}
                    className="h-11 w-11 cursor-pointer rounded-full transition-all"
                    style={{
                      backgroundColor: b.c,
                      border: active ? '3px solid #B08D4F' : '3px solid #E0D9CC',
                      boxShadow: 'inset 0 0 0 2px #FFFFFF',
                    }}
                  />
                );
              })}
            </div>
          </div>

          {/* Fields on the Front */}
          <div className="flex flex-col gap-2">
            <span className="text-[13px] font-medium text-[#17171B]">Fields on the front</span>
            <div className="flex flex-col gap-1.5">
              <label className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-[#EEE8DD] p-2.5 px-3 text-[14px] text-[#17171B]">
                <input
                  type="checkbox"
                  checked={fields.name}
                  onChange={(e) => setFields({ ...fields, name: e.target.checked })}
                  className="h-[17px] w-[17px] accent-[#17171B]"
                />
                Name
              </label>

              <label className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-[#EEE8DD] p-2.5 px-3 text-[14px] text-[#17171B]">
                <input
                  type="checkbox"
                  checked={fields.title}
                  onChange={(e) => setFields({ ...fields, title: e.target.checked })}
                  className="h-[17px] w-[17px] accent-[#17171B]"
                />
                Job title
              </label>

              <label className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-[#EEE8DD] p-2.5 px-3 text-[14px] text-[#17171B]">
                <input
                  type="checkbox"
                  checked={fields.office}
                  onChange={(e) => setFields({ ...fields, office: e.target.checked })}
                  className="h-[17px] w-[17px] accent-[#17171B]"
                />
                Office
              </label>

              <label className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-[#EEE8DD] p-2.5 px-3 text-[14px] text-[#17171B]">
                <input
                  type="checkbox"
                  checked={fields.photo}
                  onChange={(e) => setFields({ ...fields, photo: e.target.checked })}
                  className="h-[17px] w-[17px] accent-[#17171B]"
                />
                Profile photo (Google Wallet)
              </label>
            </div>
          </div>

          {/* Back of the Pass */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium text-[#17171B]">Back of the pass</span>
            <span className="text-[13.5px] leading-relaxed text-[#4E4A44]">
              Phone, email and website as tappable links, plus the company address.
            </span>
          </div>
        </section>

        {/* Right Section: Live Mockups on #EFE9DD background */}
        <section
          className="flex min-w-0 flex-wrap justify-center gap-6 rounded-[16px] bg-[#EFE9DD] p-7"
          style={{ flex: '1 1 420px' }}
        >
          {/* Apple Wallet Mockup (iPhone) */}
          <div className="flex flex-col items-center gap-2.5">
            <div
              className="flex w-[280px] flex-col gap-3.5 rounded-[20px] p-[18px] shadow-[0_24px_48px_rgba(23,23,27,0.25)] transition-all"
              style={{
                background: activeBg.gradient,
                color: activeBg.textColor,
              }}
            >
              {/* Header inside pass */}
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <svg width="22" height="22" viewBox="0 0 40 40" fill="none" stroke="#C9A96E" strokeWidth="1.2">
                    <circle cx="20" cy="20" r="18.5" />
                    <rect x="17.6" y="8" width="4.8" height="21" rx="0.8" transform="rotate(-20 20 29)" />
                    <rect x="17.6" y="8" width="4.8" height="21" rx="0.8" transform="rotate(20 20 29)" />
                  </svg>
                  <span className="text-[9px] font-medium tracking-[0.28em] text-[#C9A96E]">{companyWord}</span>
                </span>
                <span className="text-[9px] tracking-[0.2em]" style={{ color: activeBg.labelColor }}>
                  APPLE WALLET
                </span>
              </div>

              {/* Name */}
              {fields.name && (
                <div className="flex flex-col gap-0.5">
                  <span className="text-[9px] tracking-[0.2em]" style={{ color: activeBg.labelColor }}>
                    NAME
                  </span>
                  <span className="font-display text-[24px] font-normal leading-tight">{employeeName}</span>
                </div>
              )}

              {/* Title & Office */}
              {(fields.title || fields.office) && (
                <div className="flex gap-5">
                  {fields.title && (
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[9px] tracking-[0.2em]" style={{ color: activeBg.labelColor }}>
                        TITLE
                      </span>
                      <span className="text-[12.5px]">{data.sample?.title || 'Job title'}</span>
                    </div>
                  )}
                  {fields.office && (
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[9px] tracking-[0.2em]" style={{ color: activeBg.labelColor }}>
                        OFFICE
                      </span>
                      <span className="text-[12.5px]">{data.sample?.office || 'Office'}</span>
                    </div>
                  )}
                </div>
              )}

              {/* QR Code */}
              <div className="flex h-[130px] w-[130px] self-center items-center justify-center rounded-[10px] bg-[#F6F1E7] p-[9px]">
                <img src={qrSrc} alt="" className="h-full w-full rounded-[6px]" />
              </div>
            </div>
            <span className="text-[13px] text-[#5E5952]">iPhone</span>
          </div>

          {/* Google Wallet Mockup (Android) */}
          <div className="flex flex-col items-center gap-2.5">
            <div
              className="flex w-[280px] flex-col gap-3.5 rounded-[20px] p-[18px] shadow-[0_24px_48px_rgba(23,23,27,0.25)] transition-all"
              style={{
                background: activeBg.gradient,
                color: activeBg.textColor,
              }}
            >
              {/* Header inside pass */}
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <svg width="22" height="22" viewBox="0 0 40 40" fill="none" stroke="#C9A96E" strokeWidth="1.2">
                    <circle cx="20" cy="20" r="18.5" />
                    <rect x="17.6" y="8" width="4.8" height="21" rx="0.8" transform="rotate(-20 20 29)" />
                    <rect x="17.6" y="8" width="4.8" height="21" rx="0.8" transform="rotate(20 20 29)" />
                  </svg>
                  <span className="text-[9px] font-medium tracking-[0.28em] text-[#C9A96E]">{companyWord}</span>
                </span>
                <span className="text-[9px] tracking-[0.2em]" style={{ color: activeBg.labelColor }}>
                  GOOGLE WALLET
                </span>
              </div>

              {/* Name */}
              {fields.name && (
                <div className="flex flex-col gap-0.5">
                  <span className="text-[9px] tracking-[0.2em]" style={{ color: activeBg.labelColor }}>
                    NAME
                  </span>
                  <span className="font-display text-[24px] font-normal leading-tight">{employeeName}</span>
                </div>
              )}

              {/* Title & Office */}
              {(fields.title || fields.office) && (
                <div className="flex gap-5">
                  {fields.title && (
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[9px] tracking-[0.2em]" style={{ color: activeBg.labelColor }}>
                        TITLE
                      </span>
                      <span className="text-[12.5px]">{data.sample?.title || 'Job title'}</span>
                    </div>
                  )}
                  {fields.office && (
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[9px] tracking-[0.2em]" style={{ color: activeBg.labelColor }}>
                        OFFICE
                      </span>
                      <span className="text-[12.5px]">{data.sample?.office || 'Office'}</span>
                    </div>
                  )}
                </div>
              )}

              {/* QR Code */}
              <div className="flex h-[130px] w-[130px] self-center items-center justify-center rounded-[10px] bg-[#F6F1E7] p-[9px]">
                <img src={qrSrc} alt="" className="h-full w-full rounded-[6px]" />
              </div>
            </div>
            <span className="text-[13px] text-[#5E5952]">Android</span>
          </div>
        </section>
      </div>

      {/* Bottom Section: Automatic Rules */}
      <section className="flex flex-col gap-2.5 rounded-[14px] border border-[#E6E0D5] bg-white p-5">
        <h2 className="m-0 text-[16px] font-semibold text-[#17171B]">Automatic rules</h2>
        {rules.map((r, i) => (
          <div key={i} className="flex items-center gap-3 border-t border-[#F0EBE2] py-2.5">
            <svg
              className="h-[18px] w-[18px] shrink-0 text-[#C9BFAD]"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M5 12.5l4.5 4.5L19 7.5" />
            </svg>
            <span className="flex-1 text-[14px] text-[#17171B]">{r}</span>
            <span className="text-[13px] text-[#6E685F]">Coming soon</span>
          </div>
        ))}
      </section>

      {/* Reminder Modal */}
      {reminderModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="flex w-full max-w-md flex-col gap-4 rounded-xl bg-white p-6 shadow-xl">
            <h3 className="m-0 text-[18px] font-semibold text-[#17171B]">Send Pass Reminders</h3>
            <p className="m-0 text-[14px] text-[#5E5952]">
              {without.toLocaleString()} people with a live card have not added it to Apple Wallet or Google Wallet yet. Email each of them a link to their card, where the wallet buttons are?
            </p>
            <div className="mt-2 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setReminderModal(false)}
                className="h-10 cursor-pointer rounded-lg border border-[#D9D2C4] px-4 text-[14px] text-[#17171B] hover:bg-[#F7F5F0]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSendReminders}
                disabled={busy}
                className="h-10 cursor-pointer rounded-lg bg-[#17171B] px-4 text-[14px] font-semibold text-white hover:bg-[#2E2E35] disabled:opacity-50"
              >
                Send Reminders
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
