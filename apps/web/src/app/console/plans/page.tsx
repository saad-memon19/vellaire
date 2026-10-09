'use client';

import { useState } from 'react';
import { Icon } from '@/components/icons';
import { Button, Checkbox, cx, ErrorState, Field, Input, Loading, Modal, PageHeader } from '@/components/ui';
import { api, useApi } from '@/lib/api';
import { GridRow, GridTable, Section, useAction } from '../parts';

const REGIONS = [
  { id: 'me', name: 'Middle East' },
  { id: 'eu', name: 'Europe' },
  { id: 'us', name: 'Americas' },
] as const;
const LIMITS: { key: string; name: string }[] = [
  { key: 'subBrands', name: 'Sub-brands' },
  { key: 'hrConnections', name: 'HR and identity connections' },
  { key: 'aiCredits', name: 'AI credits per card, per month' },
  { key: 'admins', name: 'Admins' },
  { key: 'support', name: 'Support' },
];
const money = (n: number) => `$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
const limitText = (key: string, v: unknown) => (key === 'aiCredits' ? (v === null || v === undefined ? 'Unlimited' : String(v)) : String(v ?? '—'));

export default function Plans() {
  const { data, error, mutate } = useApi<any[]>('/console/plans');
  const [edit, setEdit] = useState<any>(null);
  const [regions, setRegions] = useState<any>(null);
  const [history, setHistory] = useState(false);

  if (error) return <ErrorState error={error} retry={() => mutate()} />;
  const cols = `2fr ${data?.map(() => '1fr').join(' ') || ''}`;
  return (
    <div className="flex flex-col gap-5.5 [&>header]:mb-0">
      <PageHeader
        eyebrow="Revenue"
        title="Plans"
        desc="What each plan includes and costs. New prices apply to every bill and quote from the moment you save."
        actions={<Button onClick={() => setHistory(true)}>Compare versions</Button>}
      />
      {!data ? (
        <Loading />
      ) : (
        <>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(300px,100%),1fr))] gap-4">
            {data.map((p) => (
              <article key={p.key} className={cx('flex flex-col gap-4 rounded-2xl bg-white p-5.5', p.key === 'professional' ? 'border-2 border-gold' : 'border border-linen')}>
                <div className="flex items-center justify-between">
                  <span className="font-display text-[30px] font-medium">{p.name}</span>
                  <span className="rounded-full bg-ok-bg px-2.5 py-0.5 text-[12px] font-medium text-ok">Live · v{p.version}</span>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="font-display text-[34px] font-semibold">{money(p.pricePerSeat)}</span>
                  <span className="text-[13px] text-stone-2">per seat, per month</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  {[
                    [p.companies, 'companies'],
                    [p.cards.toLocaleString(), 'live cards'],
                    [p.minSeats, 'min seats'],
                  ].map(([v, l]) => (
                    <span key={l} className="flex flex-col gap-0.5 rounded-[10px] bg-pearl px-1.5 py-2.5">
                      <span className="font-display text-[22px] font-semibold">{v}</span>
                      <span className="text-[11.5px] text-stone-2">{l}</span>
                    </span>
                  ))}
                </div>
                <ul className="flex flex-col gap-2 border-t border-[#F0EBE2] pt-3">
                  {p.features.map((f: any) => (
                    <li key={f.name} className={cx('flex items-center gap-2.5 text-[13.5px]', f.on ? 'text-ink' : 'text-[#8E887E]')}>
                      <Icon name={f.on ? 'check' : 'x'} size={16} className={f.on ? 'text-ok' : 'text-[#C9BFAD]'} />
                      {f.name}
                    </li>
                  ))}
                </ul>
                {Object.keys(p.regionalPrices).length > 0 && (
                  <p className="text-[12.5px] text-stone-2">
                    Regional:{' '}
                    {REGIONS.filter((r) => p.regionalPrices[r.id] !== undefined)
                      .map((r) => `${r.name} ${money(p.regionalPrices[r.id])}`)
                      .join(' · ')}
                  </p>
                )}
                <div className="mt-auto flex gap-2">
                  <Button size="sm" className="flex-1" onClick={() => setEdit(p)}>
                    Edit plan
                  </Button>
                  <Button size="sm" className="flex-1" onClick={() => setRegions(p)}>
                    Regional prices
                  </Button>
                </div>
              </article>
            ))}
          </div>

          <Section title="Limits per plan">
            <GridTable cols={cols} minWidth={640} head={['Limit', ...data.map((p) => p.name)]}>
              {LIMITS.map((l) => (
                <GridRow key={l.key} cols={cols}>
                  <span className="font-medium">{l.name}</span>
                  {data.map((p) => (
                    <span key={p.key}>{limitText(l.key, p.limits?.[l.key])}</span>
                  ))}
                </GridRow>
              ))}
            </GridTable>
          </Section>
        </>
      )}
      {edit && <EditPlan plan={edit} onClose={() => setEdit(null)} onSaved={mutate} />}
      {regions && <RegionalPrices plan={regions} onClose={() => setRegions(null)} onSaved={mutate} />}
      <Modal open={history} onClose={() => setHistory(false)} title="Plan versions" wide>
        <div className="flex flex-col gap-5">
          {data?.map((p) => (
            <div key={p.key}>
              <h3 className="mb-2 text-[15px] font-semibold">
                {p.name} · now v{p.version} at {money(p.pricePerSeat)}
              </h3>
              {p.history.length === 0 ? (
                <p className="text-[13px] text-stone-2">No earlier versions.</p>
              ) : (
                <ul className="flex flex-col divide-y divide-linen text-[13.5px]">
                  {p.history.map((h: any) => (
                    <li key={`${h.version}-${h.at}`} className="flex flex-wrap justify-between gap-2 py-2">
                      <span>
                        v{h.version} · {money(h.pricePerSeat)} per seat · min {h.minSeats} seats
                      </span>
                      <span className="text-stone-2">
                        Replaced {h.at} by {h.by}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      </Modal>
    </div>
  );
}

function EditPlan({ plan, onClose, onSaved }: { plan: any; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState(() => ({
    name: plan.name,
    pricePerSeat: String(plan.pricePerSeat),
    minSeats: String(plan.minSeats),
    features: plan.features.map((x: any) => ({ ...x })) as { name: string; on: boolean }[],
    limits: { ...plan.limits, aiCredits: plan.limits?.aiCredits === null || plan.limits?.aiCredits === undefined ? '' : String(plan.limits.aiCredits) },
  }));
  const { busy, run } = useAction(onSaved);
  const setLimit = (key: string, v: string) => setF({ ...f, limits: { ...f.limits, [key]: v } });
  const save = () =>
    run(
      'save',
      () =>
        api.patch(`/console/plans/${plan.key}`, {
          name: f.name,
          pricePerSeat: Number(f.pricePerSeat),
          minSeats: Number(f.minSeats),
          features: f.features.filter((x) => x.name.trim()),
          limits: { ...f.limits, aiCredits: f.limits.aiCredits === '' ? null : Number(f.limits.aiCredits) },
        }),
      `${f.name} saved as version ${plan.version + 1}`,
    ).then((r) => r && onClose());

  return (
    <Modal
      open
      onClose={onClose}
      title={`Edit ${plan.name}`}
      wide
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="ink" loading={busy === 'save'} onClick={save}>
            Save as v{plan.version + 1}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Name">{(id) => <Input id={id} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />}</Field>
          <Field label="Price per seat (USD / month)">
            {(id) => <Input id={id} type="number" min={0} step="0.5" value={f.pricePerSeat} onChange={(e) => setF({ ...f, pricePerSeat: e.target.value })} />}
          </Field>
          <Field label="Minimum seats">{(id) => <Input id={id} type="number" min={1} value={f.minSeats} onChange={(e) => setF({ ...f, minSeats: e.target.value })} />}</Field>
        </div>
        <fieldset>
          <legend className="mb-2 text-[13px] font-medium">What is included</legend>
          <ul className="flex flex-col gap-2">
            {f.features.map((x, i) => (
              <li key={i} className="flex items-center gap-3">
                <Checkbox label={`Include ${x.name}`} checked={x.on} onChange={(on) => setF({ ...f, features: f.features.map((y, j) => (j === i ? { ...y, on } : y)) })} />
                <Input aria-label="Feature" value={x.name} onChange={(e) => setF({ ...f, features: f.features.map((y, j) => (j === i ? { ...y, name: e.target.value } : y)) })} />
              </li>
            ))}
          </ul>
        </fieldset>
        <div className="grid gap-4 sm:grid-cols-2">
          {LIMITS.map((l) => (
            <Field key={l.key} label={l.name} hint={l.key === 'aiCredits' ? 'Leave empty for unlimited' : undefined}>
              {(id) => <Input id={id} type={l.key === 'aiCredits' ? 'number' : 'text'} value={f.limits[l.key] ?? ''} onChange={(e) => setLimit(l.key, e.target.value)} />}
            </Field>
          ))}
        </div>
      </div>
    </Modal>
  );
}

function RegionalPrices({ plan, onClose, onSaved }: { plan: any; onClose: () => void; onSaved: () => void }) {
  const [prices, setPrices] = useState<Record<string, string>>(() =>
    Object.fromEntries(REGIONS.map((r) => [r.id, plan.regionalPrices[r.id] === undefined ? '' : String(plan.regionalPrices[r.id])])),
  );
  const { busy, run } = useAction(onSaved);
  const save = () =>
    run(
      'save',
      () => api.patch(`/console/plans/${plan.key}/regions`, Object.fromEntries(REGIONS.map((r) => [r.id, prices[r.id] === '' ? null : Number(prices[r.id])]))),
      'Regional prices saved',
    ).then((r) => r && onClose());
  return (
    <Modal
      open
      onClose={onClose}
      title={`${plan.name} by region`}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="ink" loading={busy === 'save'} onClick={save}>
            Save prices
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-[14px] text-stone">Leave a region empty to use the standard price of {money(plan.pricePerSeat)} per seat.</p>
        {REGIONS.map((r) => (
          <Field key={r.id} label={`${r.name} (USD per seat / month)`}>
            {(id) => (
              <Input
                id={id}
                type="number"
                min={0}
                step="0.5"
                placeholder={String(plan.pricePerSeat)}
                value={prices[r.id]}
                onChange={(e) => setPrices({ ...prices, [r.id]: e.target.value })}
              />
            )}
          </Field>
        ))}
      </div>
    </Modal>
  );
}
