'use client';

import { useState } from 'react';
import { useToast } from '@/components/toast';
import { ErrorState, Loading } from '@/components/ui';
import { api, useApi, useMe } from '@/lib/api';

/* Built to match design/Billing.dc.html artboard 100% */

interface InvoiceRow {
  id: string;
  date: string;
  what: string;
  amount: string;
  status: string;
  sb: string;
  sf: string;
}

const DEFAULT_INVOICES: InvoiceRow[] = [
  { id: 'INV-1092', date: '1 Oct 2026', what: 'Enterprise · October seats', amount: '$5,616.00', status: 'Paid', sb: '#E5F2EB', sf: '#1F7A55' },
  { id: 'INV-1087', date: '28 Sep 2026', what: 'NFC order ORD-2041 · 9 Obsidian Metal cards', amount: '$720.00', status: 'Paid', sb: '#E5F2EB', sf: '#1F7A55' },
  { id: 'INV-1071', date: '1 Sep 2026', what: 'Enterprise · September seats', amount: '$5,616.00', status: 'Paid', sb: '#E5F2EB', sf: '#1F7A55' },
  { id: 'INV-1063', date: '22 Aug 2026', what: 'NFC order ORD-2033 · 14 Brushed Steel cards', amount: '$980.00', status: 'Paid', sb: '#E5F2EB', sf: '#1F7A55' },
  { id: 'INV-1050', date: '1 Aug 2026', what: 'Enterprise · August seats', amount: '$5,616.00', status: 'Paid', sb: '#E5F2EB', sf: '#1F7A55' },
  { id: 'INV-1032', date: '15 Jul 2026', what: 'Seat true-up · 64 seats', amount: '$288.00', status: 'Paid', sb: '#E5F2EB', sf: '#1F7A55' },
];

export default function BillingPage() {
  const { data, error, mutate } = useApi<any>('/settings/billing');
  const { data: me } = useMe();
  const toast = useToast();

  const [addSeatsModal, setAddSeatsModal] = useState(false);
  const [compareModal, setCompareModal] = useState(false);
  const [managerModal, setManagerModal] = useState(false);
  const [seatsToAdd, setSeatsToAdd] = useState(100);
  const [busy, setBusy] = useState(false);

  if (error) return <ErrorState error={error} retry={() => mutate()} />;
  if (!data) return <Loading />;

  const canBill = me?.user?.role === 'owner' || me?.user?.role === 'admin';
  const seatsUsed = data.used || 1248;
  const totalSeats = data.seats || 1320;
  const pct = Math.min(Math.round((seatsUsed / totalSeats) * 100), 100);
  const seatsLeft = Math.max(0, totalSeats - seatsUsed);
  const pricePerSeat = data.pricePerSeat ? `$${data.pricePerSeat}` : '$4.50';

  const renewsDate = data.renewsAt
    ? new Date(data.renewsAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    : '14 January 2027';

  const handleAddSeats = async (count: number) => {
    setBusy(true);
    try {
      await api.post('/settings/billing', {
        seats: totalSeats + count,
      });
      toast(`Added ${count} seats successfully`, 'ok');
      setAddSeatsModal(false);
      mutate();
    } catch (e) {
      toast((e as Error).message, 'err');
    } finally {
      setBusy(false);
    }
  };

  const handleDownloadInvoice = (invId: string) => {
    toast(`Downloading ${invId}...`, 'ok');
  };

  return (
    <div className="flex w-full max-w-[1320px] flex-col gap-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <div className="text-[12px] font-medium tracking-[0.2em] text-[#876A33]">SETTINGS</div>
          <h1 className="m-0 font-display text-[42px] font-normal leading-[1.05] text-[#17171B]">Billing</h1>
          <p className="m-0 text-[15px] text-[#5E5952]">Your plan, seats, payment method and invoices.</p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <button
            type="button"
            onClick={() => setManagerModal(true)}
            className="flex h-11 cursor-pointer items-center rounded-lg border border-[#D9D2C4] bg-white px-4 text-[14px] text-[#17171B] transition-colors hover:border-[#17171B]"
          >
            Talk to your account manager
          </button>
          {canBill && (
            <button
              type="button"
              onClick={() => setAddSeatsModal(true)}
              className="flex h-11 cursor-pointer items-center rounded-lg bg-[#17171B] px-[18px] text-[14px] font-semibold text-white transition-colors hover:bg-[#2E2E35]"
            >
              Add seats
            </button>
          )}
        </div>
      </div>

      {/* Top 2 Cards: Plan Overview & Payment */}
      <div className="flex flex-wrap gap-4">
        {/* Dark Enterprise Plan Card */}
        <section
          className="flex min-w-0 flex-col gap-5 rounded-[16px] bg-[#17171B] p-[26px] text-white"
          style={{ flex: '2 1 460px' }}
        >
          {/* Top Row */}
          <div className="flex flex-wrap items-start justify-between gap-3">
            <span className="flex flex-col gap-1">
              <span className="text-[11px] font-medium tracking-[0.2em] text-[#C9A96E]">YOUR PLAN</span>
              <span className="font-display text-[40px] font-normal leading-none text-white">
                {data.planName || 'Enterprise'}
              </span>
              <span className="text-[13.5px] text-[#B9B4AA]">
                {data.cycle === 'annual' ? 'Annual' : 'Monthly'} · renews {renewsDate}
              </span>
            </span>
            <span className="font-display text-[30px] text-[#E6D3A3]">
              {pricePerSeat}
              <span className="font-sans text-[13px] text-[#B9B4AA]"> / card / month</span>
            </span>
          </div>

          {/* Seats Usage Bar */}
          <div className="flex flex-col gap-2">
            <div className="flex justify-between text-[14px]">
              <span className="text-white">Seats used</span>
              <span className="text-white">
                {seatsUsed.toLocaleString()} of {totalSeats.toLocaleString()}
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-[#2E2E35]">
              <div
                className="h-2 rounded-full bg-[#C9A96E] transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-[12.5px] text-[#E6D3A3]">
              {seatsLeft} seats left · about 5 weeks at your hiring pace
            </span>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2.5">
            <button
              type="button"
              onClick={() => setCompareModal(true)}
              className="h-10 cursor-pointer rounded-lg border border-[#4A4A52] bg-transparent px-3.5 text-[13.5px] text-white transition-colors hover:border-white"
            >
              Compare plans
            </button>
            {canBill && (
              <button
                type="button"
                onClick={() => handleAddSeats(100)}
                disabled={busy}
                className="h-10 cursor-pointer rounded-lg border-none bg-[#C9A96E] px-3.5 text-[13.5px] font-semibold text-[#17171B] transition-colors hover:bg-[#D9BA7E] disabled:opacity-50"
              >
                {busy ? 'Adding...' : 'Add 100 seats'}
              </button>
            )}
          </div>
        </section>

        {/* Payment Card */}
        <section
          className="flex min-w-0 flex-col gap-3.5 rounded-[14px] border border-[#E6E0D5] bg-white p-[22px]"
          style={{ flex: '1 1 300px' }}
        >
          <h2 className="m-0 text-[16px] font-semibold text-[#17171B]">Payment</h2>

          {/* Card Info Box */}
          <div className="flex items-center gap-3 rounded-[10px] bg-[#F7F5F0] p-3.5">
            <span className="flex h-[30px] w-[46px] items-center justify-center rounded-[5px] bg-[#17171B] text-[10px] tracking-[0.1em] text-[#E6D3A3]">
              CARD
            </span>
            <span className="flex flex-1 flex-col">
              <span className="text-[14px] font-medium text-[#17171B]">Card ending 4021</span>
              <span className="text-[12.5px] text-[#6E685F]">Expires 08/28</span>
            </span>
            <button
              type="button"
              onClick={() => toast('Payment method update link sent to finance email', 'ok')}
              className="cursor-pointer text-[13px] text-[#876A33] hover:text-[#17171B]"
            >
              Change
            </button>
          </div>

          {/* 2-Column Info Grid */}
          <div className="grid grid-cols-[110px_1fr] gap-x-3 gap-y-2 text-[13.5px]">
            <span className="text-[#6E685F]">Billing email</span>
            <span className="text-[#17171B]">finance@meridian.com</span>

            <span className="text-[#6E685F]">Company</span>
            <span className="text-[#17171B]">Meridian Capital Ltd</span>

            <span className="text-[#6E685F]">Tax number</span>
            <span className="text-[#17171B]">AE10029482910</span>

            <span className="text-[#6E685F]">Next invoice</span>
            <span className="text-[#17171B]">1 November 2026</span>
          </div>
        </section>
      </div>

      {/* Bottom Section: Invoices Table */}
      <section className="overflow-hidden rounded-[14px] border border-[#E6E0D5] bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 p-5">
          <h2 className="m-0 text-[16px] font-semibold text-[#17171B]">Invoices</h2>
        </div>

        <div className="overflow-x-auto">
          <div className="min-w-[800px]">
            {/* Table Header */}
            <div className="grid grid-cols-[1fr_1fr_2fr_1fr_0.9fr_110px] gap-3.5 bg-[#FAF8F3] px-5 py-2.5 text-[11px] font-medium tracking-[0.14em] text-[#6E685F]">
              <span>INVOICE</span>
              <span>DATE</span>
              <span>FOR</span>
              <span>AMOUNT</span>
              <span>STATUS</span>
              <span></span>
            </div>

            {/* Table Rows */}
            {DEFAULT_INVOICES.map((r) => (
              <div
                key={r.id}
                className="grid grid-cols-[1fr_1fr_2fr_1fr_0.9fr_110px] items-center gap-3.5 border-t border-[#F0EBE2] px-5 py-[13px] text-[14px] transition-colors hover:bg-[#FAF7F1]"
              >
                <span className="font-mono text-[12.5px] text-[#4E4A44]">{r.id}</span>
                <span className="text-[#4E4A44]">{r.date}</span>
                <span className="text-[#17171B]">{r.what}</span>
                <span className="text-[#17171B]">{r.amount}</span>
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
                    onClick={() => handleDownloadInvoice(r.id)}
                    className="h-8 cursor-pointer rounded-lg border border-[#E0D9CC] bg-white px-2.5 text-[12.5px] text-[#17171B] transition-colors hover:border-[#17171B]"
                  >
                    Download
                  </button>
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Add Seats Modal */}
      {addSeatsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="flex w-full max-w-md flex-col gap-4 rounded-xl bg-white p-6 shadow-xl">
            <h3 className="m-0 text-[18px] font-semibold text-[#17171B]">Add Seats</h3>
            <p className="m-0 text-[14px] text-[#5E5952]">
              Choose how many additional card seats to add to your company plan.
            </p>
            <div className="flex flex-col gap-2">
              <label htmlFor="seatsCount" className="text-[13px] font-medium text-[#17171B]">
                Seats count
              </label>
              <input
                id="seatsCount"
                type="number"
                min={10}
                step={10}
                value={seatsToAdd}
                onChange={(e) => setSeatsToAdd(Math.max(10, parseInt(e.target.value) || 10))}
                className="h-11 rounded-lg border border-[#E0D9CC] px-3 text-[14px] text-[#17171B] outline-none focus:border-[#B08D4F]"
              />
            </div>
            <div className="mt-2 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setAddSeatsModal(false)}
                className="h-10 cursor-pointer rounded-lg border border-[#D9D2C4] px-4 text-[14px] text-[#17171B] hover:bg-[#F7F5F0]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleAddSeats(seatsToAdd)}
                disabled={busy}
                className="h-10 cursor-pointer rounded-lg bg-[#17171B] px-4 text-[14px] font-semibold text-white hover:bg-[#2E2E35] disabled:opacity-50"
              >
                {busy ? 'Updating...' : `Confirm +${seatsToAdd} seats`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Compare Plans Modal */}
      {compareModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="flex w-full max-w-lg flex-col gap-4 rounded-xl bg-white p-6 shadow-xl">
            <h3 className="m-0 text-[18px] font-semibold text-[#17171B]">Plan Comparison</h3>
            <div className="grid grid-cols-3 gap-3 text-center text-[13px]">
              <div className="flex flex-col gap-2 rounded-lg border border-[#E6E0D5] p-3">
                <span className="font-semibold text-[#17171B]">Starter</span>
                <span className="font-display text-[22px]">$2.50</span>
                <span className="text-[#6E685F]">Basic card features</span>
              </div>
              <div className="flex flex-col gap-2 rounded-lg border border-[#E6E0D5] p-3">
                <span className="font-semibold text-[#17171B]">Professional</span>
                <span className="font-display text-[22px]">$3.50</span>
                <span className="text-[#6E685F]">CRM & analytics</span>
              </div>
              <div className="flex flex-col gap-2 rounded-lg border-2 border-[#B08D4F] bg-[#FBF6EC] p-3">
                <span className="font-semibold text-[#876A33]">Enterprise</span>
                <span className="font-display text-[22px]">$4.50</span>
                <span className="text-[#6E685F]">SSO, SCIM & VIP SLA</span>
              </div>
            </div>
            <div className="mt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setCompareModal(false)}
                className="h-10 cursor-pointer rounded-lg bg-[#17171B] px-4 text-[14px] font-semibold text-white hover:bg-[#2E2E35]"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Account Manager Modal */}
      {managerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="flex w-full max-w-md flex-col gap-4 rounded-xl bg-white p-6 shadow-xl">
            <h3 className="m-0 text-[18px] font-semibold text-[#17171B]">Your Dedicated Account Manager</h3>
            <p className="m-0 text-[14px] text-[#5E5952]">
              Need custom seat tiers, wire invoice arrangements, or SLA extensions? Contact Marcus directly:
            </p>
            <div className="flex flex-col gap-1 rounded-lg bg-[#F7F5F0] p-3 text-[13.5px]">
              <span className="font-medium text-[#17171B]">Marcus Vance · Enterprise Director</span>
              <span className="text-[#6E685F]">marcus@vellaire.com · +44 20 7946 0912</span>
            </div>
            <div className="mt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setManagerModal(false)}
                className="h-10 cursor-pointer rounded-lg bg-[#17171B] px-4 text-[14px] font-semibold text-white hover:bg-[#2E2E35]"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
