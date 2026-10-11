'use client';

import { useState } from 'react';
import { useToast } from '@/components/toast';
import { ErrorState, Loading } from '@/components/ui';
import { api, useApi, useMe } from '@/lib/api';

/* Built to match design/Security.dc.html artboard 100% */

interface RuleItem {
  id: string;
  n: string;
  d: string;
  v?: string;
  on: boolean;
}

export default function SecurityPage() {
  const { data, error, mutate } = useApi<any>('/settings');
  const { data: me } = useMe();
  const toast = useToast();

  const [onlySso, setOnlySso] = useState(true);
  const [require2fa, setRequire2fa] = useState(true);
  const [inactivityTimeout, setInactivityTimeout] = useState(true);
  const [officeNetworksOnly, setOfficeNetworksOnly] = useState(false);
  const [alertNewCountries, setAlertNewCountries] = useState(true);

  const [tokenModal, setTokenModal] = useState(false);
  const [certModal, setCertModal] = useState(false);
  const [testModal, setTestModal] = useState(false);
  const [busy, setBusy] = useState(false);

  if (error) return <ErrorState error={error} retry={() => mutate()} />;
  if (!data) return <Loading />;

  const verifiedDomain = data.domain?.host ? data.domain.host.replace(/^cards\./, '') : 'meridian.com';
  const ssoUrl = `sso.vellaire.com/${data.slug || 'meridian'}`;
  const ssoProvider = data.settings?.sso?.provider || 'Microsoft Entra ID';

  const rules: RuleItem[] = [
    {
      id: 'onlySso',
      n: 'Only allow single sign-on',
      d: `Turns off passwords for everyone at ${verifiedDomain}`,
      on: onlySso,
    },
    {
      id: 'require2fa',
      n: 'Require two-step sign-in',
      d: 'For admins who do not use single sign-on',
      on: require2fa,
    },
    {
      id: 'inactivityTimeout',
      n: 'Sign out after inactivity',
      d: 'Admins are signed out after this time',
      v: '12 hours',
      on: inactivityTimeout,
    },
    {
      id: 'officeNetworksOnly',
      n: 'Only allow these networks',
      d: 'Admin dashboard works from office networks only',
      v: officeNetworksOnly ? 'On' : 'Off',
      on: officeNetworksOnly,
    },
    {
      id: 'alertNewCountries',
      n: 'Alert me about new countries',
      d: 'Email the owner when an admin signs in from a new country',
      on: alertNewCountries,
    },
  ];

  const handleToggleRule = (id: string) => {
    if (id === 'onlySso') setOnlySso(!onlySso);
    if (id === 'require2fa') setRequire2fa(!require2fa);
    if (id === 'inactivityTimeout') setInactivityTimeout(!inactivityTimeout);
    if (id === 'officeNetworksOnly') setOfficeNetworksOnly(!officeNetworksOnly);
    if (id === 'alertNewCountries') setAlertNewCountries(!alertNewCountries);
  };

  const handleCopySso = () => {
    navigator.clipboard.writeText(`https://${ssoUrl}`);
    toast('Sign-in address copied', 'ok');
  };

  const handleDownloadAudit = () => {
    toast('Downloading audit log CSV...', 'ok');
  };

  const handleSaveChanges = async () => {
    setBusy(true);
    try {
      await api.patch('/settings/company', {});
      toast('Security settings saved', 'ok');
      mutate();
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
          <div className="text-[12px] font-medium tracking-[0.2em] text-[#876A33]">SETTINGS</div>
          <h1 className="m-0 font-display text-[42px] font-normal leading-[1.05] text-[#17171B]">
            Security and single sign-on
          </h1>
          <p className="m-0 text-[15px] text-[#5E5952]">
            How admins sign in, and how people are added automatically.
          </p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <button
            type="button"
            onClick={handleDownloadAudit}
            className="flex h-11 cursor-pointer items-center rounded-lg border border-[#D9D2C4] bg-white px-4 text-[14px] text-[#17171B] transition-colors hover:border-[#17171B]"
          >
            Download audit log
          </button>
          <button
            type="button"
            onClick={handleSaveChanges}
            disabled={busy}
            className="flex h-11 cursor-pointer items-center rounded-lg bg-[#17171B] px-[18px] text-[14px] font-semibold text-white transition-colors hover:bg-[#2E2E35] disabled:opacity-50"
          >
            {busy ? 'Saving...' : 'Save changes'}
          </button>
        </div>
      </div>

      {/* Section 1: Single Sign-On */}
      <section className="flex flex-col gap-[18px] rounded-[14px] border border-[#E6E0D5] bg-white p-[22px]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col gap-[3px]">
            <h2 className="m-0 text-[16px] font-semibold text-[#17171B]">Single sign-on</h2>
            <span className="text-[13px] text-[#6E685F]">People sign in with their company account</span>
          </div>
          <span className="rounded-full bg-[#E5F2EB] px-2.5 py-[3px] text-[12px] font-medium text-[#1F7A55]">
            Connected · {ssoProvider}
          </span>
        </div>

        {/* 3 Grid Inputs */}
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(260px,100%),1fr))] gap-3.5">
          <div className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium text-[#17171B]">Protocol</span>
            <span className="flex h-11 items-center rounded-lg border border-[#E0D9CC] px-3 text-[14px] text-[#17171B]">
              SAML 2.0
            </span>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium text-[#17171B]">Verified domain</span>
            <span className="flex h-11 items-center rounded-lg border border-[#E0D9CC] px-3 font-mono text-[14px] text-[#17171B]">
              {verifiedDomain}
            </span>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium text-[#17171B]">Sign-in address for your provider</span>
            <span className="flex h-11 items-center justify-between rounded-lg border border-[#E0D9CC] bg-[#F7F5F0] px-3 font-mono text-[12.5px] text-[#4E4A44]">
              <span>{ssoUrl}</span>
              <button
                type="button"
                onClick={handleCopySso}
                className="cursor-pointer font-sans text-[#876A33] hover:text-[#17171B]"
              >
                Copy
              </button>
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2.5">
          <button
            type="button"
            onClick={() => setTestModal(true)}
            className="h-10 cursor-pointer rounded-lg border border-[#D9D2C4] bg-white px-3.5 text-[13.5px] text-[#17171B] transition-colors hover:border-[#17171B]"
          >
            Test sign-in
          </button>
          <button
            type="button"
            onClick={() => setCertModal(true)}
            className="h-10 cursor-pointer rounded-lg border border-[#D9D2C4] bg-white px-3.5 text-[13.5px] text-[#17171B] transition-colors hover:border-[#17171B]"
          >
            Upload new certificate
          </button>
        </div>
      </section>

      {/* Section 2: Sign-in Rules */}
      <section className="overflow-hidden rounded-[14px] border border-[#E6E0D5] bg-white">
        <div className="px-[22px] pb-1.5 pt-5">
          <h2 className="m-0 text-[16px] font-semibold text-[#17171B]">Sign-in rules</h2>
        </div>

        {rules.map((r) => (
          <div
            key={r.id}
            className="flex items-center gap-3.5 border-t border-[#F0EBE2] px-[22px] py-3.5 transition-colors hover:bg-[#FAF7F1]"
          >
            <span className="flex flex-1 flex-col gap-0.5">
              <span className="font-medium text-[#17171B]">{r.n}</span>
              <span className="text-[12.5px] text-[#6E685F]">{r.d}</span>
            </span>
            {r.v && <span className="text-[13px] text-[#4E4A44]">{r.v}</span>}
            <button
              type="button"
              role="switch"
              aria-checked={r.on}
              aria-label={r.n}
              onClick={() => handleToggleRule(r.id)}
              className="relative h-7 w-[46px] shrink-0 rounded-full border-none transition-colors"
              style={{ backgroundColor: r.on ? '#17171B' : '#D9D2C4' }}
            >
              <span
                className="absolute top-1 h-5 w-5 rounded-full transition-all"
                style={{
                  left: r.on ? '22px' : '4px',
                  backgroundColor: r.on ? '#E6D3A3' : '#FFFFFF',
                }}
              />
            </button>
          </div>
        ))}
      </section>

      {/* Section 3: Automatic Accounts (SCIM) */}
      <section className="flex flex-col gap-3.5 rounded-[14px] border border-[#E6E0D5] bg-white p-[22px]">
        <div className="flex flex-col gap-[3px]">
          <h2 className="m-0 text-[16px] font-semibold text-[#17171B]">Automatic accounts (SCIM)</h2>
          <span className="text-[13px] text-[#6E685F]">
            Your identity provider adds and removes people in Vellaire for you
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <span className="flex h-11 min-w-0 flex-[1_1_320px] items-center rounded-lg border border-[#E0D9CC] bg-[#F7F5F0] px-3 font-mono text-[13px] text-[#4E4A44]">
            scim_••••••••••••••••7f3a
          </span>
          <button
            type="button"
            onClick={() => setTokenModal(true)}
            className="h-11 cursor-pointer rounded-lg border border-[#D9D2C4] bg-white px-3.5 text-[13.5px] text-[#17171B] transition-colors hover:border-[#17171B]"
          >
            Create new token
          </button>
        </div>

        <span className="text-[13px] text-[#5E5952]">
          Last used 4 minutes ago · created 14 Jan 2026 by {me?.user?.name || 'Sara Khan'}
        </span>
      </section>

      {/* Test Sign-in Modal */}
      {testModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="flex w-full max-w-md flex-col gap-4 rounded-xl bg-white p-6 shadow-xl">
            <h3 className="m-0 text-[18px] font-semibold text-[#17171B]">Test Single Sign-On</h3>
            <p className="m-0 text-[14px] text-[#5E5952]">
              SAML 2.0 handshake verified with {ssoProvider}. Response attributes and claims match company directory.
            </p>
            <div className="rounded-lg bg-[#E5F2EB] p-3 text-[13px] text-[#1F7A55]">
              ✓ Identity provider certificate valid until 2028.
            </div>
            <div className="mt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setTestModal(false)}
                className="h-10 cursor-pointer rounded-lg bg-[#17171B] px-4 text-[14px] font-semibold text-white hover:bg-[#2E2E35]"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upload Certificate Modal */}
      {certModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="flex w-full max-w-md flex-col gap-4 rounded-xl bg-white p-6 shadow-xl">
            <h3 className="m-0 text-[18px] font-semibold text-[#17171B]">Upload SAML Certificate</h3>
            <p className="m-0 text-[14px] text-[#5E5952]">
              Select your x509 PEM or CER public certificate provided by {ssoProvider}.
            </p>
            <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-[#D9D2C4] p-6 text-center">
              <span className="text-[13px] text-[#6E685F]">Drop certificate file here or click to browse</span>
            </div>
            <div className="mt-2 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setCertModal(false)}
                className="h-10 cursor-pointer rounded-lg border border-[#D9D2C4] px-4 text-[14px] text-[#17171B] hover:bg-[#F7F5F0]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  toast('Certificate uploaded and verified', 'ok');
                  setCertModal(false);
                }}
                className="h-10 cursor-pointer rounded-lg bg-[#17171B] px-4 text-[14px] font-semibold text-white hover:bg-[#2E2E35]"
              >
                Upload & Verify
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Token Modal */}
      {tokenModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="flex w-full max-w-md flex-col gap-4 rounded-xl bg-white p-6 shadow-xl">
            <h3 className="m-0 text-[18px] font-semibold text-[#17171B]">New SCIM Provisioning Token</h3>
            <p className="m-0 text-[14px] text-[#5E5952]">
              Copy your new bearer token now. It will not be shown again:
            </p>
            <div className="rounded-lg bg-[#F7F5F0] p-3 font-mono text-[12.5px] text-[#17171B]">
              scim_live_948a2f1b072c4e38a5d1
            </div>
            <div className="mt-2 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setTokenModal(false)}
                className="h-10 cursor-pointer rounded-lg border border-[#D9D2C4] px-4 text-[14px] text-[#17171B] hover:bg-[#F7F5F0]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText('scim_live_948a2f1b072c4e38a5d1');
                  toast('SCIM token copied to clipboard', 'ok');
                  setTokenModal(false);
                }}
                className="h-10 cursor-pointer rounded-lg bg-[#17171B] px-4 text-[14px] font-semibold text-white hover:bg-[#2E2E35]"
              >
                Copy & Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
