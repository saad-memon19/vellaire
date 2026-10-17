'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useToast } from '@/components/toast';
import { ErrorState, Loading } from '@/components/ui';
import { api, useApi, useMe } from '@/lib/api';

/* Built to match design/Billing.dc.html artboard 100% */

const STATUS: Record<string, { label: string; sb: string; sf: string }> = {
  paid: { label: 'Paid', sb: '#E5F2EB', sf: '#1F7A55' },
  open: { label: 'Open', sb: '#F6EFE1', sf: '#876A33' },
  failed: { label: 'Failed', sb: '#FBE9EC', sf: '#A3283A' },
};

const day = (d?: string) => (d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '—');
const money = (n: number, currency = 'USD') => new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(n || 0);

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
  const seatsUsed = data.used || 0;
  const totalSeats = data.seats || 0;
  const pct = totalSeats ? Math.min(Math.round((seatsUsed / totalSeats) * 100), 100) : 0;
  const seatsLeft = Math.max(0, totalSeats - seatsUsed);
  const pricePerSeat = money(data.pricePerSeat || 0).replace(/\.00$/, '');
  // Weeks until seats run out at the last 30 days' pace of new cards
  const weeksLeft = data.addedLast30 > 0 ? Math.round(seatsLeft / ((data.addedLast30 / 30) * 7)) : null;

  const renewsDate = day(data.renewsAt);

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
              {seatsLeft.toLocaleString()} seats left
              {weeksLeft != null && seatsLeft > 0 && ` · about ${weeksLeft.toLocaleString()} ${weeksLeft === 1 ? 'week' : 'weeks'} at your hiring pace`}
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
            {/* Card payments are not built yet (Stripe); invoices are settled by bank transfer */}
            <span className="flex flex-1 flex-col">
              <span className="text-[14px] font-medium text-[#17171B]">No card on file</span>
              <span className="text-[12.5px] text-[#6E685F]">Card payments coming soon · invoices are paid by transfer</span>
            </span>
            <button type="button" disabled className="cursor-not-allowed text-[13px] text-[#876A33] opacity-50">
              Change
            </button>
          </div>

          {/* 2-Column Info Grid */}
          <div className="grid grid-cols-[110px_1fr] gap-x-3 gap-y-2 text-[13.5px]">
            <span className="text-[#6E685F]">Billing email</span>
            <span className="text-[#17171B]">{data.billingEmail || '—'}</span>

            <span className="text-[#6E685F]">Company</span>
            <span className="text-[#17171B]">{data.companyName}</span>

            <span className="text-[#6E685F]">Tax number</span>
            <span className="text-[#6E685F]">Coming soon</span>

            <span className="text-[#6E685F]">Next invoice</span>
            <span className="text-[#17171B]">{renewsDate}</span>
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
            {!data.invoices?.length && <div className="border-t border-[#F0EBE2] px-5 py-[13px] text-[14px] text-[#6E685F]">No invoices yet</div>}
            {(data.invoices || []).map((r: any) => {
              const s = STATUS[r.status] || STATUS.open;
              return (
                <div
                  key={r.id}
                  className="grid grid-cols-[1fr_1fr_2fr_1fr_0.9fr_110px] items-center gap-3.5 border-t border-[#F0EBE2] px-5 py-[13px] text-[14px] transition-colors hover:bg-[#FAF7F1]"
                >
                  <span className="font-mono text-[12.5px] text-[#4E4A44]">{r.number}</span>
                  <span className="text-[#4E4A44]">{day(r.date)}</span>
                  <span className="text-[#17171B]">
                    {r.plan} · {r.period} · {(r.seats || 0).toLocaleString()} seats
                  </span>
                  <span className="text-[#17171B]">{money(r.amount, r.currency)}</span>
                  <span>
                    <span className="inline-block rounded-full px-2.5 py-[3px] text-[12px] font-medium" style={{ backgroundColor: s.sb, color: s.sf }}>
                      {s.label}
                    </span>
                  </span>
                  <span className="justify-self-end">
                    {canBill && (
                      <a
                        href={`/api/settings/invoices/${r.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex h-8 cursor-pointer items-center rounded-lg border border-[#E0D9CC] bg-white px-2.5 text-[12.5px] text-[#17171B] transition-colors hover:border-[#17171B]"
                      >
                        Download
                      </a>
                    )}
                  </span>
                </div>
              );
            })}
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
            {/* Prices come from the console, so they match what is billed */}
            <div className="grid grid-cols-3 gap-3 text-center text-[13px]">
              {(data.plans || []).map((p: any) => {
                const current = p.id === data.plan;
                return (
                  <div
                    key={p.id}
                    className={`flex flex-col gap-2 rounded-lg p-3 ${current ? 'border-2 border-[#B08D4F] bg-[#FBF6EC]' : 'border border-[#E6E0D5]'}`}
                  >
                    <span className={`font-semibold ${current ? 'text-[#876A33]' : 'text-[#17171B]'}`}>{p.name}</span>
                    <span className="font-display text-[22px]">{money(p.pricePerSeat).replace(/\.00$/, '')}</span>
                    <span className="text-[#6E685F]">
                      per card / month · from {p.minSeats} seats{current ? ' · your plan' : ''}
                    </span>
                  </div>
                );
              })}
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
            <h3 className="m-0 text-[18px] font-semibold text-[#17171B]">Talk to Vellaire</h3>
            <p className="m-0 text-[14px] text-[#5E5952]">
              Need custom seat tiers, invoice arrangements, or a different plan? Write to the Vellaire team in Support and we will answer there.
            </p>
            <div className="mt-2 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setManagerModal(false)}
                className="h-10 cursor-pointer rounded-lg border border-[#D9D2C4] px-4 text-[14px] text-[#17171B] hover:bg-[#F7F5F0]"
              >
                Close
              </button>
              <Link
                href="/app/support"
                className="flex h-10 items-center rounded-lg bg-[#17171B] px-4 text-[14px] font-semibold text-white hover:bg-[#2E2E35]"
              >
                Open Support
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
