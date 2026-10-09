'use client';

import { useState } from 'react';
import { Button, ErrorState, Field, Input, Loading, Modal, PageHeader, Select } from '@/components/ui';
import { api, useApi } from '@/lib/api';
import { EmptyRow, GridRow, GridTable, Kpis, Meter, Pill, RowButton, Section, useAction } from '../parts';

const PARTNER_COLS = '2fr 1fr 0.8fr 0.8fr 0.9fr 0.9fr 170px';
const COUPON_COLS = '1.3fr 1.6fr 1.2fr 1.2fr 1fr 0.9fr 100px';
const KINDS = ['Reseller', 'Design agency', 'HR consultancy', 'NFC print partner'];

export default function Partners() {
  const { data, error, mutate } = useApi<any>('/console/partners');
  const { busy, run } = useAction(mutate);
  const [modal, setModal] = useState<null | 'partner' | 'coupon' | { link: any }>(null);

  if (error) return <ErrorState error={error} retry={() => mutate()} />;
  return (
    <div className="flex flex-col gap-5.5 [&>header]:mb-0">
      <PageHeader
        eyebrow="Revenue"
        title="Partners, resellers and coupons"
        desc="Agencies and resellers who bring in customers, and the codes they use."
        actions={
          <>
            <Button onClick={() => setModal('coupon')}>New coupon</Button>
            <Button variant="ink" onClick={() => setModal('partner')}>
              Add partner
            </Button>
          </>
        }
      />
      {!data ? (
        <Loading />
      ) : (
        <>
          <Kpis items={data.kpis} />
          <Section title="Partners">
            <GridTable cols={PARTNER_COLS} minWidth={880} head={['Partner', 'Region', 'Companies', 'Live cards', 'Commission', 'Status', '']}>
              {data.partners.length === 0 && <EmptyRow>No partners yet</EmptyRow>}
              {data.partners.map((p: any) => (
                <GridRow key={p.id} cols={PARTNER_COLS}>
                  <span className="flex flex-col">
                    <span className="font-semibold">{p.name}</span>
                    <span className="text-[12.5px] text-stone-2">{p.kind}</span>
                  </span>
                  <span>{p.region}</span>
                  <span className="tabular-nums">{p.companies}</span>
                  <span className="tabular-nums">{p.cards ? p.cards.toLocaleString() : '—'}</span>
                  <span className="tabular-nums">{p.commissionPct}%</span>
                  <span>
                    <Pill status={p.status} />
                  </span>
                  <span className="flex justify-end gap-1.5">
                    {p.status === 'pending' && (
                      <RowButton disabled={busy === p.id} onClick={() => run(p.id, () => api.patch(`/console/partners/${p.id}`, { status: 'active' }), `${p.name} is active`)}>
                        Activate
                      </RowButton>
                    )}
                    {p.status === 'active' && <RowButton onClick={() => setModal({ link: p })}>Credit a company</RowButton>}
                  </span>
                </GridRow>
              ))}
            </GridTable>
          </Section>
          <Section title="Coupon codes">
            <GridTable cols={COUPON_COLS} minWidth={900} head={['Code', 'Offer', 'Partner', 'Used', 'Expires', 'Status', '']}>
              {data.coupons.length === 0 && <EmptyRow>No coupons yet</EmptyRow>}
              {data.coupons.map((c: any) => (
                <GridRow key={c.id} cols={COUPON_COLS}>
                  <span className="font-mono text-[13px] font-medium">{c.code}</span>
                  <span>{c.offer}</span>
                  <span className="text-[#4E4A44]">{c.partner}</span>
                  <Meter pct={Math.round((c.used / c.maxUses) * 100)} label={`${c.used} / ${c.maxUses}`} />
                  <span className="text-[#4E4A44]">{c.expires}</span>
                  <span>
                    <Pill status={c.status} />
                  </span>
                  <span className="flex justify-end">
                    {c.status === 'archived' ? (
                      <RowButton disabled={busy === c.id} onClick={() => run(c.id, () => api.patch(`/console/coupons/${c.id}`, { status: 'active' }), `${c.code} reopened`)}>
                        Reopen
                      </RowButton>
                    ) : (
                      <RowButton disabled={busy === c.id} onClick={() => run(c.id, () => api.patch(`/console/coupons/${c.id}`, { status: 'archived' }), `${c.code} archived`)}>
                        Archive
                      </RowButton>
                    )}
                  </span>
                </GridRow>
              ))}
            </GridTable>
          </Section>
        </>
      )}
      {modal === 'partner' && <PartnerModal onClose={() => setModal(null)} onSaved={mutate} />}
      {modal === 'coupon' && data && <CouponModal partners={data.partners} onClose={() => setModal(null)} onSaved={mutate} />}
      {modal && typeof modal === 'object' && data && <LinkModal partner={modal.link} companies={data.companies} onClose={() => setModal(null)} onSaved={mutate} />}
    </div>
  );
}

function PartnerModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ name: '', kind: KINDS[0]!, region: '', commissionPct: '10', contactEmail: '' });
  const { busy, run } = useAction(onSaved);
  const save = () =>
    run('save', () => api.post('/console/partners', { ...f, commissionPct: Number(f.commissionPct) }), `${f.name} added. Activate them when the agreement is signed.`).then(
      (r) => r && onClose(),
    );
  return (
    <Modal
      open
      onClose={onClose}
      title="Add a partner"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="ink" loading={busy === 'save'} disabled={f.name.length < 2} onClick={save}>
            Add partner
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Name">{(id) => <Input id={id} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />}</Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Type">
            {(id) => (
              <Select id={id} value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}>
                {KINDS.map((k) => (
                  <option key={k}>{k}</option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Region">{(id) => <Input id={id} placeholder="UAE" value={f.region} onChange={(e) => setF({ ...f, region: e.target.value })} />}</Field>
          <Field label="Commission (%)">
            {(id) => <Input id={id} type="number" min={0} max={50} value={f.commissionPct} onChange={(e) => setF({ ...f, commissionPct: e.target.value })} />}
          </Field>
          <Field label="Contact email">{(id) => <Input id={id} type="email" value={f.contactEmail} onChange={(e) => setF({ ...f, contactEmail: e.target.value })} />}</Field>
        </div>
      </div>
    </Modal>
  );
}

function CouponModal({ partners, onClose, onSaved }: { partners: any[]; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ code: '', offer: '', partnerId: '', maxUses: '20', expiresAt: '' });
  const { busy, run } = useAction(onSaved);
  const save = () =>
    run(
      'save',
      () => api.post('/console/coupons', { ...f, maxUses: Number(f.maxUses), expiresAt: f.expiresAt ? new Date(f.expiresAt).toISOString() : '' }),
      `Coupon ${f.code.toUpperCase()} created`,
    ).then((r) => r && onClose());
  return (
    <Modal
      open
      onClose={onClose}
      title="New coupon"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="ink" loading={busy === 'save'} disabled={f.code.length < 3 || f.offer.length < 2} onClick={save}>
            Create coupon
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Code" hint="Customers type this when they sign up">
            {(id) => <Input id={id} className="font-mono uppercase" value={f.code} onChange={(e) => setF({ ...f, code: e.target.value.replace(/[^A-Za-z0-9-]/g, '') })} />}
          </Field>
          <Field label="Uses allowed">{(id) => <Input id={id} type="number" min={1} value={f.maxUses} onChange={(e) => setF({ ...f, maxUses: e.target.value })} />}</Field>
        </div>
        <Field label="Offer">{(id) => <Input id={id} placeholder="15% off the first year" value={f.offer} onChange={(e) => setF({ ...f, offer: e.target.value })} />}</Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Partner">
            {(id) => (
              <Select id={id} value={f.partnerId} onChange={(e) => setF({ ...f, partnerId: e.target.value })}>
                <option value="">No partner</option>
                {partners.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Expires">{(id) => <Input id={id} type="date" value={f.expiresAt} onChange={(e) => setF({ ...f, expiresAt: e.target.value })} />}</Field>
        </div>
      </div>
    </Modal>
  );
}

function LinkModal({ partner, companies, onClose, onSaved }: { partner: any; companies: any[]; onClose: () => void; onSaved: () => void }) {
  const [companyId, setCompanyId] = useState('');
  const { busy, run } = useAction(onSaved);
  const save = () => run('save', () => api.post(`/console/partners/${partner.id}/companies`, { companyId }), `Credited to ${partner.name}`).then((r) => r && onClose());
  return (
    <Modal
      open
      onClose={onClose}
      title={`Credit a company to ${partner.name}`}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="ink" loading={busy === 'save'} disabled={!companyId} onClick={save}>
            Credit company
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <p className="text-[14px] text-stone">The company's recurring revenue counts toward {partner.name}'s commission from this month.</p>
        <Field label="Company">
          {(id) => (
            <Select id={id} value={companyId} onChange={(e) => setCompanyId(e.target.value)}>
              <option value="">Choose a company</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>
    </Modal>
  );
}
