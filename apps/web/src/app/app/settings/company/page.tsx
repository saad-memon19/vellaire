'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { mutate as globalMutate } from 'swr';
import { useToast } from '@/components/toast';
import { ErrorState, Loading } from '@/components/ui';
import { api, isAdmin, useApi, useMe } from '@/lib/api';
import { LANGS } from '@/lib/catalog';

/* Built to match design/Settings.dc.html artboard 100% */

export default function CompanySettingsPage() {
  const { data, error, mutate } = useApi<any>('/settings');
  const { data: me } = useMe();
  const toast = useToast();

  const [companyName, setCompanyName] = useState('');
  const [website, setWebsite] = useState('https://meridian.com');
  const [languages, setLanguages] = useState<string[]>(['en', 'ar']);
  const [showLangPicker, setShowLangPicker] = useState(false);

  // Offboarding settings
  const [switchOffCard, setSwitchOffCard] = useState(true);
  const [redirectUrl, setRedirectUrl] = useState('meridian.com/contact');
  const [disableNfcWallet, setDisableNfcWallet] = useState(true);
  const [keepLeads, setKeepLeads] = useState(true);
  const [dataRetention, setDataRetention] = useState('30 days');

  // Security settings
  const [require2fa, setRequire2fa] = useState(true);
  const [sessionLength, setSessionLength] = useState('12 hours');
  const [aiFeatures, setAiFeatures] = useState(true);

  const [busy, setBusy] = useState(false);
  const [deleteModal, setDeleteModal] = useState(false);

  useEffect(() => {
    if (data) {
      if (data.name) setCompanyName(data.name);
      if (data.settings?.languages?.length) {
        setLanguages(data.settings.languages);
      }
      if (data.domain?.host) {
        setWebsite(`https://${data.domain.host.replace(/^cards\./, '')}`);
      }
    }
  }, [data]);

  if (error) return <ErrorState error={error} retry={() => mutate()} />;
  if (!data) return <Loading />;

  const admin = isAdmin(me?.user?.role);

  const handleSave = async () => {
    setBusy(true);
    try {
      await api.patch('/settings/company', {
        name: companyName,
        languages,
      });
      toast('Changes saved successfully', 'ok');
      mutate();
      globalMutate('/auth/me');
    } catch (e) {
      toast((e as Error).message, 'err');
    } finally {
      setBusy(false);
    }
  };

  const toggleLanguage = (code: string) => {
    if (code === 'en') return; // English is required primary
    if (languages.includes(code)) {
      setLanguages(languages.filter((l) => l !== code));
    } else {
      setLanguages([...languages, code]);
    }
  };

  const domainHost = data.domain?.host || 'cards.meridian.com';
  const totalCards = 1248;

  return (
    <div className="flex w-full max-w-[1100px] flex-col gap-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div className="flex flex-col gap-1.5">
          <div className="text-[12px] font-medium tracking-[0.2em] text-[#876A33]">SETTINGS</div>
          <h1 className="m-0 font-display text-[46px] font-normal leading-[1.05] text-[#17171B]">Company settings</h1>
          <p className="m-0 text-[15px] text-[#5E5952]">
            Your company profile, card address and what happens when someone leaves.
          </p>
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={busy || !admin}
          className="h-11 cursor-pointer rounded-lg bg-[#17171B] px-5 text-[14px] font-semibold text-white transition-colors hover:bg-[#2E2E35] disabled:opacity-50"
        >
          {busy ? 'Saving...' : 'Save changes'}
        </button>
      </div>

      {/* Navigation Pills */}
      <div className="flex flex-wrap gap-2">
        <span className="rounded-full bg-[#17171B] px-3.5 py-2 text-[13px] font-medium text-white">General</span>
        <Link
          href="/app/settings/security"
          className="rounded-full border border-[#E0D9CC] bg-white px-3.5 py-2 text-[13px] text-[#17171B] transition-colors hover:border-[#17171B]"
        >
          Security and SSO
        </Link>
        <Link
          href="/app/settings/billing"
          className="rounded-full border border-[#E0D9CC] bg-white px-3.5 py-2 text-[13px] text-[#17171B] transition-colors hover:border-[#17171B]"
        >
          Billing
        </Link>
        <Link
          href="/app/integrations"
          className="rounded-full border border-[#E0D9CC] bg-white px-3.5 py-2 text-[13px] text-[#17171B] transition-colors hover:border-[#17171B]"
        >
          Developers
        </Link>
      </div>

      {/* Section 1: Company Profile */}
      <section className="flex flex-col rounded-[14px] border border-[#E6E0D5] bg-white px-6 pb-2 pt-[22px]">
        <div className="flex flex-col gap-0.5 pb-3.5">
          <h2 className="m-0 text-[17px] font-semibold text-[#17171B]">Company profile</h2>
          <span className="text-[13px] text-[#6E685F]">Shown on every card and in emails</span>
        </div>

        {/* Company Name */}
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] items-center gap-4 border-t border-[#F0EBE2] py-3.5">
          <span className="flex flex-col gap-0.5">
            <span className="font-medium text-[#17171B]">Company name</span>
          </span>
          <input
            type="text"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            disabled={!admin}
            className="h-[42px] min-w-0 rounded-lg border border-[#E0D9CC] px-3 text-[14px] text-[#17171B] outline-none focus:border-[#B08D4F] disabled:bg-[#F7F5F0]"
          />
        </div>

        {/* Website */}
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] items-center gap-4 border-t border-[#F0EBE2] py-3.5">
          <span className="flex flex-col gap-0.5">
            <span className="font-medium text-[#17171B]">Website</span>
          </span>
          <input
            type="text"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            disabled={!admin}
            className="h-[42px] min-w-0 rounded-lg border border-[#E0D9CC] px-3 text-[14px] text-[#17171B] outline-none focus:border-[#B08D4F] disabled:bg-[#F7F5F0]"
          />
        </div>

        {/* Card languages */}
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] items-center gap-4 border-t border-[#F0EBE2] py-3.5">
          <span className="flex flex-col gap-0.5">
            <span className="font-medium text-[#17171B]">Card languages</span>
          </span>
          <div className="flex flex-wrap items-center gap-1.5">
            {languages.map((code) => (
              <span
                key={code}
                className="flex items-center gap-1.5 rounded-full bg-[#F6EFE1] px-3 py-1.5 text-[13px] font-medium text-[#876A33]"
              >
                {LANGS[code] || code.toUpperCase()}
                {code !== 'en' && admin && (
                  <button
                    type="button"
                    onClick={() => toggleLanguage(code)}
                    className="cursor-pointer text-[#876A33] hover:text-[#17171B]"
                    title="Remove language"
                  >
                    ×
                  </button>
                )}
              </span>
            ))}
            {admin && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowLangPicker(!showLangPicker)}
                  className="cursor-pointer rounded-full border border-dashed border-[#C9BFAD] px-3 py-1.5 text-[13px] text-[#4E4A44] transition-colors hover:border-[#17171B] hover:text-[#17171B]"
                >
                  Add language
                </button>
                {showLangPicker && (
                  <div className="absolute left-0 top-full z-20 mt-1 max-h-48 w-48 overflow-y-auto rounded-lg border border-[#E6E0D5] bg-white p-1.5 shadow-lg">
                    {Object.entries(LANGS)
                      .filter(([code]) => !languages.includes(code))
                      .map(([code, name]) => (
                        <button
                          key={code}
                          type="button"
                          onClick={() => {
                            toggleLanguage(code);
                            setShowLangPicker(false);
                          }}
                          className="flex w-full cursor-pointer items-center rounded px-2.5 py-1.5 text-left text-[13px] text-[#17171B] hover:bg-[#F7F5F0]"
                        >
                          {name}
                        </button>
                      ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Section 2: Card Address */}
      <section className="flex flex-col rounded-[14px] border border-[#E6E0D5] bg-white px-6 pb-2 pt-[22px]">
        <div className="flex flex-col gap-0.5 pb-3.5">
          <h2 className="m-0 text-[17px] font-semibold text-[#17171B]">Card address</h2>
          <span className="text-[13px] text-[#6E685F]">Cards open on your own domain</span>
        </div>

        {/* Custom Domain */}
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] items-center gap-4 border-t border-[#F0EBE2] py-3.5">
          <span className="flex flex-col gap-0.5">
            <span className="font-medium text-[#17171B]">Custom domain</span>
            <span className="text-[12.5px] text-[#6E685F]">DNS record checked 2 days ago</span>
          </span>
          <span className="flex flex-wrap items-center gap-2.5">
            <span className="rounded-lg border border-[#E6E0D5] bg-[#F7F5F0] px-3 py-2 font-mono text-[13.5px] text-[#17171B]">
              {domainHost}
            </span>
            <span className="rounded-full bg-[#E5F2EB] px-2.5 py-0.5 text-[12px] font-medium text-[#1F7A55]">
              Verified
            </span>
          </span>
        </div>

        {/* Link style */}
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] items-center gap-4 border-t border-[#F0EBE2] py-3.5">
          <span className="flex flex-col gap-0.5">
            <span className="font-medium text-[#17171B]">Link style</span>
          </span>
          <span className="font-mono text-[13.5px] text-[#4E4A44]">/first-last · e.g. /sara-khan</span>
        </div>
      </section>

      {/* Section 3: When Someone Leaves */}
      <section className="flex flex-col rounded-[14px] border border-[#E6E0D5] bg-white px-6 pb-2 pt-[22px]">
        <div className="flex flex-col gap-0.5 pb-3.5">
          <h2 className="m-0 text-[17px] font-semibold text-[#17171B]">When someone leaves</h2>
          <span className="text-[13px] text-[#6E685F]">Triggered by Workday on their last day</span>
        </div>

        {/* Switch off the card */}
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] items-center gap-4 border-t border-[#F0EBE2] py-3.5">
          <span className="flex flex-col gap-0.5">
            <span className="font-medium text-[#17171B]">Switch off the card</span>
            <span className="text-[12.5px] text-[#6E685F]">The link shows a polite page instead</span>
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={switchOffCard}
            onClick={() => setSwitchOffCard(!switchOffCard)}
            className="relative h-7 w-[46px] justify-self-start rounded-full border-none transition-colors"
            style={{ backgroundColor: switchOffCard ? '#17171B' : '#D9D2C4' }}
          >
            <span
              className="absolute top-1 h-5 w-5 rounded-full transition-all"
              style={{
                left: switchOffCard ? '22px' : '4px',
                backgroundColor: switchOffCard ? '#E6D3A3' : '#FFFFFF',
              }}
            />
          </button>
        </div>

        {/* Send visitors to */}
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] items-center gap-4 border-t border-[#F0EBE2] py-3.5">
          <span className="flex flex-col gap-0.5">
            <span className="font-medium text-[#17171B]">Send visitors to</span>
          </span>
          <span className="font-mono text-[13.5px] text-[#17171B]">{redirectUrl}</span>
        </div>

        {/* Disable NFC card and wallet passes */}
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] items-center gap-4 border-t border-[#F0EBE2] py-3.5">
          <span className="flex flex-col gap-0.5">
            <span className="font-medium text-[#17171B]">Disable NFC card and wallet passes</span>
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={disableNfcWallet}
            onClick={() => setDisableNfcWallet(!disableNfcWallet)}
            className="relative h-7 w-[46px] justify-self-start rounded-full border-none transition-colors"
            style={{ backgroundColor: disableNfcWallet ? '#17171B' : '#D9D2C4' }}
          >
            <span
              className="absolute top-1 h-5 w-5 rounded-full transition-all"
              style={{
                left: disableNfcWallet ? '22px' : '4px',
                backgroundColor: disableNfcWallet ? '#E6D3A3' : '#FFFFFF',
              }}
            />
          </button>
        </div>

        {/* Keep their leads for the company */}
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] items-center gap-4 border-t border-[#F0EBE2] py-3.5">
          <span className="flex flex-col gap-0.5">
            <span className="font-medium text-[#17171B]">Keep their leads for the company</span>
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={keepLeads}
            onClick={() => setKeepLeads(!keepLeads)}
            className="relative h-7 w-[46px] justify-self-start rounded-full border-none transition-colors"
            style={{ backgroundColor: keepLeads ? '#17171B' : '#D9D2C4' }}
          >
            <span
              className="absolute top-1 h-5 w-5 rounded-full transition-all"
              style={{
                left: keepLeads ? '22px' : '4px',
                backgroundColor: keepLeads ? '#E6D3A3' : '#FFFFFF',
              }}
            />
          </button>
        </div>

        {/* Delete personal data after */}
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] items-center gap-4 border-t border-[#F0EBE2] py-3.5">
          <span className="flex flex-col gap-0.5">
            <span className="font-medium text-[#17171B]">Delete personal data after</span>
          </span>
          <input
            type="text"
            value={dataRetention}
            onChange={(e) => setDataRetention(e.target.value)}
            disabled={!admin}
            className="h-[42px] min-w-0 rounded-lg border border-[#E0D9CC] px-3 text-[14px] text-[#17171B] outline-none focus:border-[#B08D4F] disabled:bg-[#F7F5F0]"
          />
        </div>
      </section>

      {/* Section 4: Security */}
      <section id="sso" className="flex flex-col rounded-[14px] border border-[#E6E0D5] bg-white px-6 pb-2 pt-[22px]">
        <div className="flex flex-col gap-0.5 pb-3.5">
          <h2 className="m-0 text-[17px] font-semibold text-[#17171B]">Security</h2>
          <span className="text-[13px] text-[#6E685F]">Applies to all admins</span>
        </div>

        {/* Single sign-on */}
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] items-center gap-4 border-t border-[#F0EBE2] py-3.5">
          <span className="flex flex-col gap-0.5">
            <span className="font-medium text-[#17171B]">Single sign-on</span>
          </span>
          <span className="flex items-center gap-2.5">
            <span className="text-[14px] text-[#17171B]">Microsoft Entra ID</span>
            <span className="rounded-full bg-[#E5F2EB] px-2.5 py-0.5 text-[12px] font-medium text-[#1F7A55]">
              On
            </span>
          </span>
        </div>

        {/* Require two-step sign-in */}
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] items-center gap-4 border-t border-[#F0EBE2] py-3.5">
          <span className="flex flex-col gap-0.5">
            <span className="font-medium text-[#17171B]">Require two-step sign-in</span>
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={require2fa}
            onClick={() => setRequire2fa(!require2fa)}
            className="relative h-7 w-[46px] justify-self-start rounded-full border-none transition-colors"
            style={{ backgroundColor: require2fa ? '#17171B' : '#D9D2C4' }}
          >
            <span
              className="absolute top-1 h-5 w-5 rounded-full transition-all"
              style={{
                left: require2fa ? '22px' : '4px',
                backgroundColor: require2fa ? '#E6D3A3' : '#FFFFFF',
              }}
            />
          </button>
        </div>

        {/* Session length */}
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] items-center gap-4 border-t border-[#F0EBE2] py-3.5">
          <span className="flex flex-col gap-0.5">
            <span className="font-medium text-[#17171B]">Session length</span>
          </span>
          <input
            type="text"
            value={sessionLength}
            onChange={(e) => setSessionLength(e.target.value)}
            disabled={!admin}
            className="h-[42px] min-w-0 rounded-lg border border-[#E0D9CC] px-3 text-[14px] text-[#17171B] outline-none focus:border-[#B08D4F] disabled:bg-[#F7F5F0]"
          />
        </div>

        {/* AI features */}
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] items-center gap-4 border-t border-[#F0EBE2] py-3.5">
          <span className="flex flex-col gap-0.5">
            <span className="font-medium text-[#17171B]">AI features</span>
          </span>
          <div className="flex flex-col gap-1">
            <button
              type="button"
              role="switch"
              aria-checked={aiFeatures}
              onClick={() => setAiFeatures(!aiFeatures)}
              className="relative h-7 w-[46px] justify-self-start rounded-full border-none transition-colors"
              style={{ backgroundColor: aiFeatures ? '#17171B' : '#D9D2C4' }}
            >
              <span
                className="absolute top-1 h-5 w-5 rounded-full transition-all"
                style={{
                  left: aiFeatures ? '22px' : '4px',
                  backgroundColor: aiFeatures ? '#E6D3A3' : '#FFFFFF',
                }}
              />
            </button>
            <span className="text-[12.5px] text-[#6E685F]">Your data is never used to train AI</span>
          </div>
        </div>
      </section>

      {/* Section 5: Delete Workspace (Danger Zone) */}
      <section className="flex flex-wrap items-center justify-between gap-4 rounded-[14px] border border-[#E9B9C0] bg-white p-5 px-6">
        <div className="flex flex-col gap-0.5">
          <span className="text-[14px] font-semibold text-[#A3283A]">Delete workspace</span>
          <span className="text-[13px] text-[#5E5952]">
            Switches off all {totalCards.toLocaleString()} cards. Only the owner can do this.
          </span>
        </div>
        <button
          type="button"
          onClick={() => setDeleteModal(true)}
          className="h-[42px] cursor-pointer rounded-lg border border-[#E9B9C0] bg-white px-4 text-[14px] text-[#A3283A] transition-colors hover:bg-[#FDF2F4]"
        >
          Delete workspace
        </button>
      </section>

      {/* Delete Confirmation Modal */}
      {deleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="flex w-full max-w-md flex-col gap-4 rounded-xl bg-white p-6 shadow-xl">
            <h3 className="m-0 text-[18px] font-semibold text-[#A3283A]">Delete Workspace</h3>
            <p className="m-0 text-[14px] text-[#5E5952]">
              Are you sure you want to delete this workspace? This will immediately switch off all cards and cannot be undone.
            </p>
            <div className="mt-2 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeleteModal(false)}
                className="h-10 cursor-pointer rounded-lg border border-[#D9D2C4] px-4 text-[14px] text-[#17171B] hover:bg-[#F7F5F0]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  toast('Workspace deletion requires owner email confirmation', 'err');
                  setDeleteModal(false);
                }}
                className="h-10 cursor-pointer rounded-lg bg-[#A3283A] px-4 text-[14px] font-semibold text-white hover:bg-[#8A2130]"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
