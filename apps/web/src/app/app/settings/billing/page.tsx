'use client';

import { useState } from 'react';
import { useToast } from '@/components/toast';
import { Badge, Button, Callout, cx, ErrorState, Field, Input, Loading, Modal, PageHeader, Panel, PanelHeader, StatusBadge, Table, Td } from '@/components/ui';
import { api, useApi, useMe } from '@/lib/api';

export default function Billing() {
  const { data, error, mutate } = useApi<any>('/settings/billing');
  const { data: me } = useMe();
  const [modal, setModal] = useState(false);
  const [plan, setPlan] = useState('');
  const [seats, setSeats] = useState(0);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const canBill = me?.user.role === 'owner' || me?.user.role === 'admin';

  if (error) return <ErrorState error={error} retry={() => mutate()} />;
  if (!data) return <Loading />;
  const pct = Math.min(Math.round((data.used / data.seats) * 100), 100);
  const sel = data.plans.find((p: any) => p.id === (plan || data.plan));

  const save = async () => {
    setBusy(true);
    try {
      await api.post('/settings/billing', { plan: plan || data.plan, seats: seats || data.seats });
      toast('Plan updated');
      setModal(false);
      mutate();
    } catch (e) {
      toast((e as Error).message, 'err');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader eyebrow="Settings" title="Billing" desc="Your plan, seats and invoices." actions={canBill && <Button variant="ink" onClick={() => { setPlan(data.plan); setSeats(data.seats); setModal(true); }}>Change plan or seats</Button>} />
      {data.paymentStatus === 'failed' && (
        <div className="mb-6">
          <Callout tone="err" icon="alert">
            Your last payment failed. Please update your payment method to avoid interruption.
          </Callout>
        </div>
      )}
      {data.status === 'trial' && data.trialEndsAt && (
        <div className="mb-6">
          <Callout tone="info" icon="info">
            Your trial ends on {new Date(data.trialEndsAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })}. Choose a plan to keep your cards live.
          </Callout>
        </div>
      )}
      <div className="grid gap-6 lg:grid-cols-3">
        <Panel className="lg:col-span-2">
          <PanelHeader title={`${data.planName} plan`} sub={`$${data.pricePerSeat} per seat per month · billed ${data.cycle === 'annual' ? 'annually' : 'monthly'}`} action={<StatusBadge status={data.status} />} />
          <div className="font-display text-[44px] leading-none">${data.monthly.toLocaleString()}</div>
          <div className="mt-1 text-[14px] text-stone">per month{data.renewsAt && ` · renews ${new Date(data.renewsAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`}</div>
          <div className="mt-6">
            <div className="mb-2 flex justify-between text-[14px]">
              <span>Seats</span>
              <span className="tabular-nums">
                {data.used.toLocaleString()} of {data.seats.toLocaleString()} used
              </span>
            </div>
            <div className="h-2 rounded-full bg-linen">
              <div className={cx('h-2 rounded-full', pct > 90 ? 'bg-warn' : 'bg-ink')} style={{ width: `${pct}%` }} />
            </div>
            {pct > 90 && <p className="mt-2 text-[13px] text-warn">You are close to your seat limit. New joiners’ cards need free seats.</p>}
          </div>
        </Panel>
        <Panel>
          <PanelHeader title="What a seat is" />
          <p className="text-[14px] text-stone">One live, scheduled or waiting card uses one seat. Deactivated cards and drafts are free.</p>
        </Panel>
      </div>
      <Panel pad={false} className="mt-6">
        <div className="p-5">
          <PanelHeader title="Invoices" />
        </div>
        {data.invoices.length === 0 ? (
          <p className="px-5 pb-6 text-[14px] text-stone-2">No invoices yet</p>
        ) : (
          <Table head={['Invoice', 'Period', 'Seats', 'Amount', 'Status']}>
            {data.invoices.map((i: any) => (
              <tr key={i.id}>
                <Td className="font-mono text-[13px]">{i.number}</Td>
                <Td>{i.period}</Td>
                <Td className="tabular-nums">{i.seats?.toLocaleString()}</Td>
                <Td className="tabular-nums">${i.amount.toLocaleString()}</Td>
                <Td>
                  <StatusBadge status={i.status} />
                </Td>
              </tr>
            ))}
          </Table>
        )}
      </Panel>

      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title="Change plan or seats"
        footer={
          <>
            <Button onClick={() => setModal(false)}>Cancel</Button>
            <Button variant="ink" loading={busy} onClick={save}>
              Confirm · ${((sel?.pricePerSeat || 0) * (seats || 0)).toLocaleString()}/month
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <div className="grid gap-3 sm:grid-cols-3">
            {data.plans.map((p: any) => (
              <label key={p.id} className={cx('flex cursor-pointer flex-col gap-1 rounded-lg border p-4', (plan || data.plan) === p.id ? 'border-ink ring-1 ring-ink' : 'border-line')}>
                <input type="radio" name="plan" className="sr-only" checked={(plan || data.plan) === p.id} onChange={() => setPlan(p.id)} />
                <span className="text-[15px] font-medium">{p.name}</span>
                <span className="text-[13px] text-stone-2">${p.pricePerSeat}/seat/month</span>
                {p.id === data.plan && <Badge tone="gold" className="mt-1 self-start">Current</Badge>}
              </label>
            ))}
          </div>
          <Field label="Seats" hint={`At least ${data.used.toLocaleString()} (cards in use)`}>
            {(id) => <Input id={id} type="number" min={data.used} value={seats} onChange={(e) => setSeats(Number(e.target.value))} />}
          </Field>
        </div>
      </Modal>
    </div>
  );
}
