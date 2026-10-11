'use client';

import { useState } from 'react';
import { useToast } from '@/components/toast';
import { useMe } from '@/lib/api';

/* Built to match design/Signatures.dc.html artboard 100% */

type SignatureStyle = 'Classic' | 'Compact' | 'With banner';

interface DeployItem {
  id: string;
  n: string;
  count: string;
  last: string;
  status: string;
  sb: string;
  sf: string;
  act: string;
}

export default function SignaturesPage() {
  const { data: me } = useMe();
  const toast = useToast();

  const [style, setStyle] = useState<SignatureStyle>('Classic');
  const [photo, setPhoto] = useState(true);
  const [qrCode, setQrCode] = useState(true);
  const [phone, setPhone] = useState(true);
  const [social, setSocial] = useState(false);
  const [booking, setBooking] = useState(false);
  const [legalText, setLegalText] = useState('[Company legal disclaimer]');

  const [deployModal, setDeployModal] = useState(false);
  const [connectModal, setConnectModal] = useState(false);
  const [busy, setBusy] = useState(false);

  const [deployRows, setDeployRows] = useState<DeployItem[]>([
    {
      id: 'm365',
      n: 'Microsoft 365 · Outlook',
      count: '1,248',
      last: 'Yesterday 18:00',
      status: 'Deployed',
      sb: '#E5F2EB',
      sf: '#1F7A55',
      act: 'Deploy again',
    },
    {
      id: 'gw',
      n: 'Google Workspace · Gmail',
      count: '—',
      last: 'Not connected',
      status: 'Off',
      sb: '#EFEBE3',
      sf: '#4E4A44',
      act: 'Connect',
    },
  ]);

  const companyName = me?.company?.name || 'Meridian Capital';
  const employeeName = me?.user?.name || 'Sara Khan';
  const employeeInitials = employeeName
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  const companySlug = me?.company?.slug || 'meridian';
  const cardUrl = `cards.${companySlug}.com/sara-khan`;

  const handleDownloadHtml = () => {
    const htmlSignature = `
<table cellpadding="0" cellspacing="0" border="0" style="font-family: Arial, sans-serif; font-size: 14px; color: #17171b;">
  <tr>
    <td style="padding-right: 16px; border-right: 2px solid #b08d4f; vertical-align: middle;">
      ${photo ? `<div style="width: 56px; height: 56px; border-radius: 50%; background: #f2eee6; color: #876a33; text-align: center; line-height: 56px; font-weight: bold; font-size: 20px;">${employeeInitials}</div>` : ''}
    </td>
    <td style="padding-left: 16px; vertical-align: middle;">
      <div style="font-size: 18px; font-weight: bold; color: #17171b;">${employeeName}</div>
      <div style="font-size: 13px; color: #5e5952;">Head of Private Clients · ${companyName}</div>
      ${phone ? '<div style="font-size: 13px; color: #5e5952;">+971 4 000 0000</div>' : ''}
      <div style="font-size: 13px;"><a href="https://${cardUrl}" style="color: #876a33; text-decoration: none;">${cardUrl}</a></div>
    </td>
    ${qrCode ? `<td style="padding-left: 18px; vertical-align: middle;"><div style="width: 56px; height: 56px; border: 2px solid #17171b; background: #faf8f3; text-align: center; line-height: 56px; font-size: 10px;">QR</div></td>` : ''}
  </tr>
</table>
<div style="font-size: 11px; color: #8e887e; margin-top: 10px;">${legalText}</div>
    `.trim();

    navigator.clipboard.writeText(htmlSignature);
    toast('HTML signature copied to clipboard', 'ok');
  };

  const handleDeployAll = () => {
    setBusy(true);
    setTimeout(() => {
      setBusy(false);
      setDeployRows((prev) =>
        prev.map((r) =>
          r.id === 'm365' ? { ...r, last: 'Just now', status: 'Deployed', sb: '#E5F2EB', sf: '#1F7A55' } : r,
        ),
      );
      toast('Signatures deployed to all 1,248 mailboxes', 'ok');
      setDeployModal(false);
    }, 600);
  };

  const handleRowAction = (r: DeployItem) => {
    if (r.id === 'gw') {
      setConnectModal(true);
    } else {
      setDeployModal(true);
    }
  };

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
            One signature design for everyone, deployed straight to Outlook and Gmail.
          </p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <button
            type="button"
            onClick={handleDownloadHtml}
            className="flex h-11 cursor-pointer items-center rounded-lg border border-[#D9D2C4] bg-white px-4 text-[14px] text-[#17171B] transition-colors hover:border-[#17171B]"
          >
            Download HTML
          </button>
          <button
            type="button"
            onClick={() => setDeployModal(true)}
            className="flex h-11 cursor-pointer items-center rounded-lg bg-[#17171B] px-[18px] text-[14px] font-semibold text-white transition-colors hover:bg-[#2E2E35]"
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
              const active = style === s;
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStyle(s)}
                  className="flex h-16 cursor-pointer items-center justify-center rounded-[10px] text-[13px] text-[#17171B] transition-all"
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
            <label className="flex cursor-pointer items-center gap-2.5 text-[14px] text-[#17171B]">
              <input
                type="checkbox"
                checked={photo}
                onChange={(e) => setPhoto(e.target.checked)}
                className="h-[17px] w-[17px] accent-[#17171B]"
              />
              Profile photo
            </label>

            <label className="flex cursor-pointer items-center gap-2.5 text-[14px] text-[#17171B]">
              <input
                type="checkbox"
                checked={qrCode}
                onChange={(e) => setQrCode(e.target.checked)}
                className="h-[17px] w-[17px] accent-[#17171B]"
              />
              QR code to the card
            </label>

            <label className="flex cursor-pointer items-center gap-2.5 text-[14px] text-[#17171B]">
              <input
                type="checkbox"
                checked={phone}
                onChange={(e) => setPhone(e.target.checked)}
                className="h-[17px] w-[17px] accent-[#17171B]"
              />
              Phone number
            </label>

            <label className="flex cursor-pointer items-center gap-2.5 text-[14px] text-[#17171B]">
              <input
                type="checkbox"
                checked={social}
                onChange={(e) => setSocial(e.target.checked)}
                className="h-[17px] w-[17px] accent-[#17171B]"
              />
              Social links
            </label>

            <label className="flex cursor-pointer items-center gap-2.5 text-[14px] text-[#17171B]">
              <input
                type="checkbox"
                checked={booking}
                onChange={(e) => setBooking(e.target.checked)}
                className="h-[17px] w-[17px] accent-[#17171B]"
              />
              Book a meeting link
            </label>
          </div>

          {/* Legal Line Textarea */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="disc" className="text-[13px] font-medium text-[#17171B]">
              Legal line
            </label>
            <textarea
              id="disc"
              rows={2}
              value={legalText}
              onChange={(e) => setLegalText(e.target.value)}
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

              {/* Signature Block */}
              <div className="flex items-center gap-[18px] pt-1.5">
                {/* Gold Vertical Divider Line */}
                <span className="w-[2px] self-stretch bg-[#B08D4F]" />

                {/* Profile Photo / Initials */}
                {photo && (
                  <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-[#F2EEE6] font-display text-[22px] font-semibold text-[#876A33]">
                    {employeeInitials}
                  </span>
                )}

                {/* Info Block */}
                <div className="flex flex-1 flex-col gap-[3px]">
                  <span className="font-display text-[22px] font-semibold text-[#17171B]">
                    {employeeName}
                  </span>
                  <span className="text-[12.5px] text-[#5E5952]">
                    Head of Private Clients · {companyName}
                  </span>
                  <span className="text-[12.5px] text-[#5E5952]">
                    {phone ? '+971 4 000 0000 · ' : ''}
                    {cardUrl}
                  </span>
                  {booking && (
                    <span className="text-[12px] font-medium text-[#876A33]">
                      🗓 Book a meeting with Sara
                    </span>
                  )}
                  {social && (
                    <span className="text-[11.5px] text-[#8E887E]">
                      LinkedIn · Twitter / X
                    </span>
                  )}
                </div>

                {/* QR Code */}
                {qrCode && (
                  <span
                    className="h-16 w-16 shrink-0 border-[3px] border-[#17171B]"
                    style={{
                      background:
                        'repeating-conic-gradient(#17171B 0 25%, #FFFFFF 0 50%) 0 0 / 12px 12px',
                    }}
                  />
                )}
              </div>

              {/* Legal Disclaimer Line */}
              {legalText && (
                <span className="text-[11px] text-[#8E887E]">{legalText}</span>
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
            {deployRows.map((r) => (
              <div
                key={r.id}
                className="grid grid-cols-[1.6fr_1fr_1.2fr_1fr_120px] items-center gap-3.5 border-t border-[#F0EBE2] px-5 py-[13px] text-[14px] transition-colors hover:bg-[#FAF7F1]"
              >
                <span className="font-semibold text-[#17171B]">{r.n}</span>
                <span className="text-[#17171B]">{r.count}</span>
                <span className="text-[#4E4A44]">{r.last}</span>
                <span>
                  <span
                    className="inline-block rounded-full px-2.5 py-[3px] text-[12px] font-medium"
                    style={{ backgroundColor: r.sb, color: r.sf }}
                  >
                    {r.status}
                  </span>
                </span>
                <span className="justify-self-end">
                  <button
                    type="button"
                    onClick={() => handleRowAction(r)}
                    className="h-8 cursor-pointer rounded-lg border border-[#E0D9CC] bg-white px-2.5 text-[12.5px] text-[#17171B] transition-colors hover:border-[#17171B]"
                  >
                    {r.act}
                  </button>
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Deploy to All Mailboxes Modal */}
      {deployModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="flex w-full max-w-md flex-col gap-4 rounded-xl bg-white p-6 shadow-xl">
            <h3 className="m-0 text-[18px] font-semibold text-[#17171B]">Deploy to All Mailboxes</h3>
            <p className="m-0 text-[14px] text-[#5E5952]">
              This will update the signature across all 1,248 active Microsoft 365 Outlook accounts. Existing custom signatures will be replaced with company brand standard.
            </p>
            <div className="mt-2 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeployModal(false)}
                className="h-10 cursor-pointer rounded-lg border border-[#D9D2C4] px-4 text-[14px] text-[#17171B] hover:bg-[#F7F5F0]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeployAll}
                disabled={busy}
                className="h-10 cursor-pointer rounded-lg bg-[#17171B] px-4 text-[14px] font-semibold text-white hover:bg-[#2E2E35] disabled:opacity-50"
              >
                {busy ? 'Deploying...' : 'Deploy Now'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Connect Google Workspace Modal */}
      {connectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="flex w-full max-w-md flex-col gap-4 rounded-xl bg-white p-6 shadow-xl">
            <h3 className="m-0 text-[18px] font-semibold text-[#17171B]">Connect Google Workspace</h3>
            <p className="m-0 text-[14px] text-[#5E5952]">
              Authorise Vellaire via Google Workspace Marketplace or Service Account to automatically sync signatures with Gmail users.
            </p>
            <div className="mt-2 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setConnectModal(false)}
                className="h-10 cursor-pointer rounded-lg border border-[#D9D2C4] px-4 text-[14px] text-[#17171B] hover:bg-[#F7F5F0]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  toast('Google Workspace connection initiated', 'ok');
                  setConnectModal(false);
                }}
                className="h-10 cursor-pointer rounded-lg bg-[#17171B] px-4 text-[14px] font-semibold text-white hover:bg-[#2E2E35]"
              >
                Authorize with Google
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
