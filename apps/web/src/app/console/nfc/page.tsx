'use client';

import { useState } from 'react';
import { useToast } from '@/components/toast';
import { Badge, Button, cx, ErrorState, Field, Input, Loading, Modal, PageHeader, Select, Spinner } from '@/components/ui';
import { MATERIALS, materialName } from '@/lib/catalog';
import { api, qs, useApi } from '@/lib/api';

const NEXT: Record<string, string> = {
  received: 'proof',
  proof: 'production',
  production: 'encoded',
  encoded: 'shipped',
  shipped: 'delivered',
};
const LABEL: Record<string, string> = {
  proof: 'Send proof',
  production: 'Start production',
  encoded: 'Mark encoded',
  shipped: 'Mark shipped',
  delivered: 'Mark delivered',
};

export default function NfcBoard() {
  const [supplier, setSupplier] = useState('');
  const [pastDue, setPastDue] = useState(false);
  const { data, error, mutate } = useApi<any>(`/console/nfc${qs({ supplier, pastDue: pastDue ? '1' : '' })}`);
  const [edit, setEdit] = useState<any>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const toast = useToast();

  const move = async (o: any, stage: string, extra: any = {}) => {
    setBusy(o.id);
    try {
      await api.patch(`/console/nfc/${o.id}`, { stage, ...extra });
      toast(`${o.number} → ${stage}${stage === 'delivered' ? '. Chips are now active.' : ''}`);
      mutate();
    } catch (e) {
      toast((e as Error).message, 'err');
    } finally {
      setBusy(null);
    }
  };

  if (error) return <ErrorState error={error} retry={() => mutate()} />;
  return (
    <div>
      <PageHeader
        eyebrow="Operations"
        title="NFC fulfilment"
        desc={data ? `${data.summary.open} open orders · ${data.summary.pastDue} past due · ${data.summary.cards.toLocaleString()} cards in the pipeline` : ' '}
        actions={
          <>
            <Select aria-label="Supplier" value={supplier} onChange={(e) => setSupplier(e.target.value)} className="w-52">
              <option value="">All suppliers</option>
              {data?.suppliers.map((s: string) => (
                <option key={s}>{s}</option>
              ))}
            </Select>
            <Button variant={pastDue ? 'ink' : 'outline'} onClick={() => setPastDue((p) => !p)}>
              Past due only
            </Button>
          </>
        }
      />
      {!data ? (
        <Loading />
      ) : (
        <div className="scrollbar-thin -mx-4 flex gap-4 overflow-x-auto px-4 pb-4 sm:mx-0 sm:px-0">
          {data.columns.map((col: any) => (
            <section key={col.id} className="flex w-62.5 shrink-0 flex-col self-start rounded-[14px] bg-sand p-3">
              <header className="mb-3 flex items-center justify-between px-1">
                <h2 className="text-[13.5px] font-semibold">{col.name}</h2>
                <span className="rounded-full bg-white px-2 py-0.5 text-[11.5px] text-stone">{col.count}</span>
              </header>
              <ul className="flex flex-col gap-2">
                {col.orders.map((o: any) => (
                  <li key={o.id} className={cx('flex flex-col gap-2 rounded-[10px] border bg-white p-3', o.late ? 'border-err/40' : 'border-linen')}>
                    <div className="flex items-center justify-between gap-2 text-[11.5px]">
                      <span className="font-mono text-stone">{o.number}</span>
                      <span className={o.late ? 'font-semibold text-err' : 'text-ink'}>{o.late ? `Late · ${o.due}` : `Due ${o.due}`}</span>
                    </div>
                    <div className="text-[14px] font-semibold">{o.company}</div>
                    <div className="flex items-center gap-2 text-[12.5px] text-stone">
                      <span
                        className="h-3.5 w-5.5 shrink-0 rounded-sm"
                        style={{
                          background: MATERIALS.find((m) => m.id === o.material)?.bg || '#17171B',
                        }}
                      />
                      {o.qty} × {materialName(o.material)}
                    </div>
                    {o.automatic && (
                      <Badge tone="gold" className="self-start">
                        Auto from HR
                      </Badge>
                    )}
                    <div className="flex items-center justify-between gap-2 border-t border-[#F0EBE2] pt-2 text-[12px]">
                      <span className="min-w-0 truncate text-stone-2">{o.tracking || o.supplier}</span>
                      {NEXT[o.stage] && (
                        <button
                          type="button"
                          disabled={busy === o.id}
                          onClick={() => (NEXT[o.stage] === 'shipped' ? setEdit(o) : move(o, NEXT[o.stage]!))}
                          className="flex shrink-0 items-center gap-1.5 font-medium text-gold-text hover:text-ink disabled:opacity-60"
                        >
                          {busy === o.id && <Spinner size={12} />}
                          {LABEL[NEXT[o.stage]!]}
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
      <ShipModal
        order={edit}
        onClose={() => setEdit(null)}
        onShip={(o, tracking) => {
          setEdit(null);
          move(o, 'shipped', { tracking });
        }}
      />
    </div>
  );
}

function ShipModal({ order, onClose, onShip }: { order: any; onClose: () => void; onShip: (o: any, tracking: string) => void }) {
  const [t, setT] = useState('');
  return (
    <Modal
      open={!!order}
      onClose={onClose}
      title={`Ship ${order?.number || ''}`}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="ink" onClick={() => onShip(order, t)}>
            Mark shipped
          </Button>
        </>
      }
    >
      <Field label="Tracking number (optional)">{(id) => <Input id={id} value={t} onChange={(e) => setT(e.target.value)} placeholder="DHL 1234 5678" />}</Field>
    </Modal>
  );
}
