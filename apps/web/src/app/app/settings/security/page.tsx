'use client';

import { useState } from 'react';
import { useToast } from '@/components/toast';
import { ErrorState, Loading } from '@/components/ui';
import { api, isAdmin, useApi, useMe } from '@/lib/api';

/* Built to match design/Security.dc.html artboard 100% */

interface RuleItem {
  id: string;
  n: string;
  d: string;
}

// None of these rules exist yet; they are shown off and locked, with "Coming soon"
const RULES: RuleItem[] = [
  { id: 'onlySso', n: 'Only allow single sign-on', d: 'Turns off passwords for everyone at your domain' },
  { id: 'require2fa', n: 'Require two-step sign-in', d: 'For admins who do not use single sign-on' },
  { id: 'inactivityTimeout', n: 'Sign out after inactivity', d: 'Today everyone stays signed in for 30 days' },
  { id: 'officeNetworksOnly', n: 'Only allow these networks', d: 'Admin dashboard works from office networks only' },
  { id: 'alertNewCountries', n: 'Alert me about new countries', d: 'Email the owner when an admin signs in from a new country' },
];

export default function SecurityPage() {
  const { data, error, mutate } = useApi<any>('/settings');
  const { data: me } = useMe();
  const toast = useToast();

  const [newToken, setNewToken] = useState<string | null>(null);
  const [tokenModal, setTokenModal] = useState(false);
  const [busy, setBusy] = useState(false);

  if (error) return <ErrorState error={error} retry={() => mutate()} />;
  if (!data) return <Loading />;

  const admin = isAdmin(me?.user?.role);
  const verifiedDomain = data.domain?.verified && data.domain.host ? data.domain.host.replace(/^cards\./, '') : 'Not verified yet';
  const scimCreated = data.settings?.scimCreated;

  const createToken = async () => {
    setBusy(true);
    try {
      const r = await api.post('/integrations/scim/token');
      setNewToken(r.token);
      mutate();
    } catch (e) {
      toast((e as Error).message, 'err');
    } finally {
      setBusy(false);
    }
  };

  const closeTokenModal = () => {
    setTokenModal(false);
    setNewToken(null);
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
          {admin && (
            <a
              href="/api/settings/audit.csv"
              download
              className="flex h-11 cursor-pointer items-center rounded-lg border border-[#D9D2C4] bg-white px-4 text-[14px] text-[#17171B] transition-colors hover:border-[#17171B]"
            >
              Download audit log
            </a>
          )}
          {/* Nothing on this page is saved with this button yet; the SCIM token saves itself */}
          <button
            type="button"
            disabled
            title="Coming soon"
            className="flex h-11 cursor-not-allowed items-center rounded-lg bg-[#17171B] px-[18px] text-[14px] font-semibold text-white opacity-50"
          >
            Save changes
          </button>
        </div>
      </div>

      {/* Section 1: Single Sign-On (SAML is not built yet; Google and Microsoft sign-in work on /signin) */}
      <section className="flex flex-col gap-[18px] rounded-[14px] border border-[#E6E0D5] bg-white p-[22px]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col gap-[3px]">
            <h2 className="m-0 text-[16px] font-semibold text-[#17171B]">Single sign-on</h2>
            <span className="text-[13px] text-[#6E685F]">People sign in with their company account</span>
          </div>
          <span className="rounded-full bg-[#F6EFE1] px-2.5 py-[3px] text-[12px] font-medium text-[#876A33]">Coming soon</span>
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
              <span>Shown here once single sign-on is ready</span>
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2.5">
          <button
            type="button"
            disabled
            className="h-10 cursor-not-allowed rounded-lg border border-[#D9D2C4] bg-white px-3.5 text-[13.5px] text-[#17171B] opacity-50"
          >
            Test sign-in
          </button>
          <button
            type="button"
            disabled
            className="h-10 cursor-not-allowed rounded-lg border border-[#D9D2C4] bg-white px-3.5 text-[13.5px] text-[#17171B] opacity-50"
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

        {RULES.map((r) => (
          <div
            key={r.id}
            className="flex items-center gap-3.5 border-t border-[#F0EBE2] px-[22px] py-3.5 transition-colors hover:bg-[#FAF7F1]"
          >
            <span className="flex flex-1 flex-col gap-0.5">
              <span className="font-medium text-[#17171B]">{r.n}</span>
              <span className="text-[12.5px] text-[#6E685F]">{r.d}</span>
            </span>
            <span className="text-[13px] text-[#4E4A44]">Coming soon</span>
            <button
              type="button"
              role="switch"
              aria-checked={false}
              aria-label={r.n}
              disabled
              className="relative h-7 w-[46px] shrink-0 cursor-not-allowed rounded-full border-none opacity-60 transition-colors"
              style={{ backgroundColor: '#D9D2C4' }}
            >
              <span className="absolute top-1 h-5 w-5 rounded-full transition-all" style={{ left: '4px', backgroundColor: '#FFFFFF' }} />
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
            {data.settings?.scimConfigured ? 'vl_scim_•••••••••••••••• (shown only once, when created)' : 'No token yet'}
          </span>
          {admin && (
            <button
              type="button"
              onClick={() => setTokenModal(true)}
              className="h-11 cursor-pointer rounded-lg border border-[#D9D2C4] bg-white px-3.5 text-[13.5px] text-[#17171B] transition-colors hover:border-[#17171B]"
            >
              Create new token
            </button>
          )}
        </div>

        <span className="text-[13px] text-[#5E5952]">
          {scimCreated
            ? `Created ${new Date(scimCreated.at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} by ${scimCreated.by}`
            : 'Create a token, then paste it with the address into Microsoft Entra ID or another SCIM client'}
        </span>
      </section>

      {/* Create Token Modal */}
      {tokenModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="flex w-full max-w-md flex-col gap-4 rounded-xl bg-white p-6 shadow-xl">
            <h3 className="m-0 text-[18px] font-semibold text-[#17171B]">New SCIM Provisioning Token</h3>
            {newToken ? (
              <>
                <p className="m-0 text-[14px] text-[#5E5952]">Copy your new bearer token now. It will not be shown again:</p>
                <div className="break-all rounded-lg bg-[#F7F5F0] p-3 font-mono text-[12.5px] text-[#17171B]">{newToken}</div>
                <p className="m-0 text-[13px] text-[#5E5952]">
                  SCIM address: <span className="font-mono">{`${window.location.origin}/api/scim/v2`}</span>
                </p>
              </>
            ) : (
              <p className="m-0 text-[14px] text-[#5E5952]">
                {data.settings?.scimConfigured
                  ? 'The current token stops working straight away. Your identity provider needs the new one.'
                  : 'Vellaire makes a bearer token for your identity provider.'}
              </p>
            )}
            <div className="mt-2 flex justify-end gap-3">
              <button
                type="button"
                onClick={closeTokenModal}
                className="h-10 cursor-pointer rounded-lg border border-[#D9D2C4] px-4 text-[14px] text-[#17171B] hover:bg-[#F7F5F0]"
              >
                {newToken ? 'Close' : 'Cancel'}
              </button>
              {newToken ? (
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(newToken);
                    toast('SCIM token copied to clipboard', 'ok');
                    closeTokenModal();
                  }}
                  className="h-10 cursor-pointer rounded-lg bg-[#17171B] px-4 text-[14px] font-semibold text-white hover:bg-[#2E2E35]"
                >
                  Copy & Done
                </button>
              ) : (
                <button
                  type="button"
                  disabled={busy}
                  onClick={createToken}
                  className="h-10 cursor-pointer rounded-lg bg-[#17171B] px-4 text-[14px] font-semibold text-white hover:bg-[#2E2E35] disabled:opacity-50"
                >
                  {busy ? 'Creating...' : 'Create token'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
