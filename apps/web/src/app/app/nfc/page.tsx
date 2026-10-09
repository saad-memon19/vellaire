'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { CardFace } from '@/components/card/card-face';
import { Icon } from '@/components/icons';
import { useToast } from '@/components/toast';
import { Badge, Button, cx, ErrorState, Loading, Modal, PageHeader, Pagination, Select, Stat, StatusBadge } from '@/components/ui';
import { api, isAdmin, isManager, qs, useApi, useMe } from '@/lib/api';
import { MATERIALS } from '@/lib/catalog';

const matBg = (id?: string) => MATERIALS.find((m) => m.id === id)?.bg || '#EFEBE3';
const DEVICE_COLS = 'grid grid-cols-[2fr_1.3fr_1.2fr_1fr_110px] items-center gap-3.5 px-5.5';

export default function Page() {
  return (
    <Suspense fallback={<Loading />}>
      <Nfc />
    </Suspense>
  );
}

function Nfc() {
  const params = useSearchParams();
  const orderFor = params.get('order');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const { data, error, mutate } = useApi<any>(`/nfc${qs({ q, page })}`);
  const { data: me } = useMe();
  const { data: brand } = useApi<any>('/brand');
  const { data: single } = useApi<any>(orderFor ? `/cards/${orderFor}` : null);
  const [material, setMaterial] = useState('metal_obsidian');
  const [forOne, setForOne] = useState(true);
  const [review, setReview] = useState(false);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const manager = isManager(me?.user.role);

  if (error) return <ErrorState error={error} retry={() => mutate()} />;
  if (!data) return <Loading />;

  const person = forOne && single?.card.employeeId ? single.card : null;
  const targets: string[] = person ? [person.employeeId] : data.joinersWithout;
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  const m = MATERIALS.find((x) => x.id === material)!;

  const order = async () => {
    setBusy(true);
    try {
      const o = await api.post('/nfc/orders', {
        employeeIds: targets,
        material,
      });
      toast(`Order ${o.number} placed`);
      setReview(false);
      mutate();
    } catch (e) {
      toast((e as Error).message, 'err');
    } finally {
      setBusy(false);
    }
  };

  const setDevice = async (id: string, status: string) => {
    try {
      await api.patch(`/nfc/devices/${id}`, { status });
      toast(status === 'active' ? 'Switched on' : 'Reported lost and switched off');
      mutate();
    } catch (e) {
      toast((e as Error).message, 'err');
    }
  };

  const setAuto = async (enabled: boolean) => {
    try {
      await api.patch('/nfc/settings', {
        enabled,
        material: data.autoOrder.material,
      });
      mutate();
      toast(enabled ? 'New hires get an NFC card automatically' : 'Automatic orders turned off');
    } catch (e) {
      toast((e as Error).message, 'err');
    }
  };

  return (
    <div className="flex flex-col gap-6 [&>header]:mb-0">
      <PageHeader eyebrow="Sharing" title="NFC cards" desc="Order engraved cards, follow every order, and switch off a lost card in one click." />
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(200px,100%),1fr))] gap-3">
        {data.kpis.map((k: any) => (
          <Stat key={k.label} label={k.label} value={k.value} note={k.note} />
        ))}
      </div>

      <div className="flex flex-wrap items-start gap-5">
        <div className="flex min-w-0 flex-[3_1_560px] flex-col gap-4">
          <section className="overflow-hidden rounded-[14px] border border-linen bg-white">
            <div className="flex items-center justify-between px-5.5 py-5">
              <h2 className="text-[16px] font-semibold">Orders</h2>
              <span className="text-[13px] text-stone-2">{data.openOrders} in progress</span>
            </div>
            {data.orders.length === 0 ? (
              <p className="border-t border-[#F0EBE2] py-8 text-center text-[14px] text-stone-2">No orders yet</p>
            ) : (
              data.orders.map((o: any) => {
                const at = o.steps.findLastIndex((s: any) => s.done);
                return (
                  <div key={o.id} className="flex flex-col gap-3.5 border-t border-[#F0EBE2] px-5.5 py-4.5">
                    <div className="flex flex-wrap items-center gap-3.5">
                      <span className="h-9 w-14 shrink-0 rounded-md shadow-[0_6px_12px_rgba(23,23,27,0.15)]" style={{ background: matBg(o.material) }} />
                      <span className="flex min-w-0 flex-[1_1_200px] flex-col gap-0.5">
                        <span className="font-semibold">{o.title}</span>
                        <span className="text-[12.5px] text-stone-2">
                          {o.sub}
                          {o.tracking && ` · ${o.tracking}`}
                        </span>
                      </span>
                      <span className="font-mono text-[12px] text-stone-2">{o.number}</span>
                      {o.late && <Badge tone="err">Late</Badge>}
                      <StatusBadge status={o.status} />
                    </div>
                    <ol className="grid grid-cols-5 gap-1.5" aria-label={`Progress: ${o.status}`}>
                      {o.steps.map((s: any, i: number) => (
                        <li key={s.name} className="flex flex-col gap-1.5">
                          <span className={cx('h-1 rounded-full', s.done ? 'bg-gold' : 'bg-[#EEE8DD]')} />
                          <span className={cx('text-[11.5px]', s.done ? 'text-ink' : 'text-[#8E887E]', i === at && 'font-semibold')}>{s.name}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                );
              })
            )}
          </section>

          <section className="overflow-hidden rounded-[14px] border border-linen bg-white">
            <div className="flex flex-wrap items-center justify-between gap-3 px-5.5 py-4">
              <h2 className="text-[16px] font-semibold">Cards in use</h2>
              <label className="flex h-9.5 flex-[0_1_280px] items-center gap-2 rounded-lg border border-linen bg-pearl px-2.5 text-stone-2">
                <Icon name="dSearch" size={16} />
                <input
                  type="search"
                  aria-label="Search holder"
                  placeholder="Search holder"
                  value={q}
                  onChange={(e) => {
                    setQ(e.target.value);
                    setPage(1);
                  }}
                  className="min-w-0 flex-1 bg-transparent text-[13.5px] text-ink outline-none"
                />
              </label>
            </div>
            <div className="overflow-x-auto">
              <div className="min-w-160">
                <div className={cx(DEVICE_COLS, 'bg-[#FAF8F3] py-2.5 text-[11px] font-medium tracking-[0.14em] text-stone-2')}>
                  <span>HOLDER</span>
                  <span>MATERIAL</span>
                  <span>LAST TAP</span>
                  <span>STATUS</span>
                  <span />
                </div>
                {data.devices.length === 0 && <p className="border-t border-[#F0EBE2] py-8 text-center text-[14px] text-stone-2">No NFC cards found</p>}
                {data.devices.map((d: any) => {
                  const on = d.status === 'active';
                  return (
                    <div key={d.id} className={cx(DEVICE_COLS, 'border-t border-[#F0EBE2] py-3 hover:bg-[#FAF7F1]')}>
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate font-semibold">{d.name}</span>
                        <span className="text-[12.5px] text-stone-2">{d.office}</span>
                      </span>
                      <span className="flex items-center gap-2">
                        <span className="h-4.25 w-6.5 shrink-0 rounded-[3px]" style={{ background: matBg(d.materialId) }} />
                        {d.material}
                      </span>
                      <span className="text-[#4E4A44]">{d.tap}</span>
                      <span>
                        <StatusBadge status={d.status} />
                      </span>
                      {manager ? (
                        <button
                          type="button"
                          onClick={() => setDevice(d.id, on ? 'lost' : 'active')}
                          className={cx('h-8 justify-self-end rounded-lg border border-[#E0D9CC] bg-white px-3 text-[12.5px] hover:border-ink', on ? 'text-err' : 'text-ink')}
                        >
                          {on ? 'Mark lost' : 'Activate'}
                        </button>
                      ) : (
                        <span />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            <Pagination page={data.page} limit={data.limit} total={data.devTotal} onPage={setPage} />
          </section>
        </div>

        {manager && (
          <aside aria-label="New order" className="flex min-w-0 flex-[2_1_340px] flex-col gap-5 rounded-2xl border border-linen bg-white p-6 xl:sticky xl:top-24">
            <div className="flex flex-col gap-1">
              <h2 className="font-display text-[28px] font-medium">New order</h2>
              <span className="text-[13px] text-stone">Engraved from your brand kit automatically</span>
            </div>
            <div className="flex justify-center rounded-xl bg-sand p-5.5">
              <div className="w-full max-w-70">
                <CardFace
                  layout="executive"
                  fields={{
                    name: person?.fields.name || '[Employee name]',
                    title: person?.fields.title || '[Job title]',
                  }}
                  brand={brand ? { ...brand.brand, companyName: brand.companyName } : undefined}
                  material={m}
                  width="100%"
                />
              </div>
            </div>
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-2 text-[13px] font-medium">Material</legend>
              <div className="grid grid-cols-2 gap-2">
                {MATERIALS.map((x) => {
                  const sel = material === x.id;
                  return (
                    <label
                      key={x.id}
                      className={cx('flex cursor-pointer items-center gap-2.5 rounded-[10px] p-2.5', sel ? 'border-2 border-gold bg-[#FBF6EC]' : 'border border-linen bg-white')}
                    >
                      <input type="radio" name="mat" checked={sel} onChange={() => setMaterial(x.id)} className="h-4 w-4 accent-ink" />
                      <span className="h-5 w-7.5 shrink-0 rounded" style={{ background: x.bg }} />
                      <span className="text-[13px] font-medium">{x.name}</span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
            <label className="flex flex-col gap-2">
              <span className="text-[13px] font-medium">For</span>
              <Select value={person ? 'one' : 'joiners'} onChange={(e) => setForOne(e.target.value === 'one')}>
                {single?.card.employeeId && <option value="one">{single.card.fields.name}</option>}
                <option value="joiners">New joiners this month · {plural(data.joinersWithout.length, 'person', 'people')}</option>
              </Select>
            </label>
            <label className="flex flex-col gap-2">
              <span className="text-[13px] font-medium">Ship to</span>
              <Select disabled value="office">
                <option value="office">{person ? person.fields.office || 'Office on file' : "Each person's office"}</option>
              </Select>
            </label>
            {isAdmin(me?.user.role) && (
              <label className="flex cursor-pointer items-start gap-3 rounded-[10px] border border-gold-line bg-[#FBF6EC] p-3.5">
                <input type="checkbox" checked={data.autoOrder.enabled} onChange={(e) => setAuto(e.target.checked)} className="mt-px h-4.25 w-4.25 accent-ink" />
                <span className="flex flex-col gap-0.5">
                  <span className="text-[13.5px] font-semibold">Order automatically for every new hire</span>
                  <span className="text-[12.5px] text-stone">Triggered by your HR sync when a card is published</span>
                </span>
              </label>
            )}
            <Button variant="ink" size="lg" disabled={!targets.length} onClick={() => setReview(true)}>
              {targets.length ? `Review order · ${plural(targets.length, 'card', 'cards')}` : 'Everyone already has a card'}
            </Button>
          </aside>
        )}
      </div>

      <Modal
        open={review}
        onClose={() => setReview(false)}
        title="Review order"
        footer={
          <Button variant="ink" loading={busy} onClick={order}>
            Place order · ${(m.price * targets.length).toLocaleString()}
          </Button>
        }
      >
        <dl className="flex flex-col gap-2 text-[14px]">
          {[
            ['Cards', `${plural(targets.length, 'card', 'cards')} · ${m.name}`],
            ['For', person ? person.fields.name : 'New joiners this month'],
            ['Ship to', person ? person.fields.office || 'Office on file' : "Each person's office"],
            ['Price', `$${m.price} each · $${(m.price * targets.length).toLocaleString()} total`],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between gap-3 border-b border-linen pb-2">
              <dt className="text-stone-2">{k}</dt>
              <dd className="text-right">{v}</dd>
            </div>
          ))}
        </dl>
      </Modal>
    </div>
  );
}
