'use client';

import { useState } from 'react';
import { Button, Checkbox, ErrorState, Field, Input, Loading, Modal, PageHeader, Textarea, Toggle } from '@/components/ui';
import { api, useApi } from '@/lib/api';
import { EmptyRow, GridRow, GridTable, Meter, RowButton, Section, useAction } from '../parts';

const COLS = '2.1fr 1.7fr 1.5fr 0.9fr 70px 80px';
const PLANS = [
  { id: 'starter', name: 'Starter' },
  { id: 'professional', name: 'Professional' },
  { id: 'enterprise', name: 'Enterprise' },
];
const REGIONS = [
  { id: 'me', name: 'Middle East' },
  { id: 'eu', name: 'Europe' },
  { id: 'us', name: 'Americas' },
];
const toggle = (list: string[], id: string, on: boolean) => (on ? [...list, id] : list.filter((x) => x !== id));

export default function Flags() {
  const { data, error, mutate } = useApi<any>('/console/flags');
  const { busy, run } = useAction(mutate);
  const [edit, setEdit] = useState<any>(null);
  const [notes, setNotes] = useState(false);

  if (error) return <ErrorState error={error} retry={() => mutate()} />;
  return (
    <div className="flex flex-col gap-5.5 [&>header]:mb-0">
      <PageHeader
        eyebrow="Platform"
        title="Feature flags and releases"
        desc="Turn features on gradually, for chosen companies first, and roll back in one click."
        actions={
          <>
            <Button onClick={() => setNotes(true)}>Add release notes</Button>
            <Button variant="ink" onClick={() => setEdit({})}>
              New flag
            </Button>
          </>
        }
      />
      {!data ? (
        <Loading />
      ) : (
        <>
          <Section>
            <GridTable cols={COLS} minWidth={900} head={['Feature', 'Rollout', 'Who gets it', 'Owner', 'On', '']}>
              {data.flags.length === 0 && <EmptyRow>No flags yet</EmptyRow>}
              {data.flags.map((f: any) => (
                <GridRow key={f.id} cols={COLS}>
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="font-semibold">{f.name}</span>
                    <span className="truncate font-mono text-[12px] text-stone-2">{f.key}</span>
                  </span>
                  <Meter pct={f.on ? f.rolloutPct : 0} label={f.on ? `${f.rolloutPct}%` : 'Off'} />
                  <span className="flex flex-col text-[13px] text-[#4E4A44]">
                    {f.who}
                    {f.on && (
                      <span className="text-[12px] text-stone-2">
                        On for {f.live} of {data.totalCompanies}
                      </span>
                    )}
                  </span>
                  <span className="text-[13px] text-[#4E4A44]">{f.owner}</span>
                  <Toggle
                    checked={f.on}
                    disabled={busy === f.id}
                    label={`${f.name} on`}
                    onChange={(on) => run(f.id, () => api.patch(`/console/flags/${f.id}`, { on }), `${f.name} turned ${on ? 'on' : 'off'}`)}
                  />
                  <span className="flex justify-end">
                    <RowButton onClick={() => setEdit(f)}>Edit</RowButton>
                  </span>
                </GridRow>
              ))}
            </GridTable>
          </Section>
          <Section title="Recent releases">
            {data.releases.length === 0 && <EmptyRow>No release notes yet</EmptyRow>}
            {data.releases.map((r: any) => (
              <div key={r.id} className="flex flex-wrap items-baseline gap-3.5 border-t border-[#F0EBE2] px-5 py-3">
                <span className="w-17.5 text-[13px] font-medium">{r.version}</span>
                <span className="w-24 text-[13px] text-stone-2">{r.date}</span>
                <span className="flex-[1_1_300px] text-[14px] leading-normal">{r.notes}</span>
              </div>
            ))}
          </Section>
        </>
      )}
      {edit && data && <FlagModal flag={edit} companies={data.companies} onClose={() => setEdit(null)} onSaved={mutate} />}
      {notes && <ReleaseModal onClose={() => setNotes(false)} onSaved={mutate} />}
    </div>
  );
}

function FlagModal({ flag, companies, onClose, onSaved }: { flag: any; companies: any[]; onClose: () => void; onSaved: () => void }) {
  const isNew = !flag.id;
  const [f, setF] = useState({
    key: flag.key || '',
    name: flag.name || '',
    owner: flag.owner && flag.owner !== '—' ? flag.owner : '',
    rolloutPct: flag.rolloutPct ?? 0,
    plans: (flag.plans || []) as string[],
    regions: (flag.regions || []) as string[],
    companyIds: (flag.companyIds || []) as string[],
  });
  const { busy, run } = useAction(onSaved);
  const save = () =>
    run(
      'save',
      () => (isNew ? api.post('/console/flags', { ...f, companyIds: undefined }) : api.patch(`/console/flags/${flag.id}`, { ...f, key: undefined })),
      isNew ? 'Flag created' : 'Rollout saved',
    ).then((r) => r && onClose());
  return (
    <Modal
      open
      onClose={onClose}
      title={isNew ? 'New feature flag' : flag.name}
      wide
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="ink" loading={busy === 'save'} disabled={f.name.length < 2 || (isNew && f.key.length < 3)} onClick={save}>
            {isNew ? 'Create flag' : 'Save rollout'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Name">{(id) => <Input id={id} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />}</Field>
          <Field label="Key" hint={isNew ? 'Used in code, cannot change later' : undefined}>
            {(id) => (
              <Input
                id={id}
                className="font-mono"
                disabled={!isNew}
                placeholder="cards.video_cover"
                value={f.key}
                onChange={(e) => setF({ ...f, key: e.target.value.toLowerCase().replace(/[^a-z0-9_.]/g, '') })}
              />
            )}
          </Field>
          <Field label="Owner">{(id) => <Input id={id} placeholder="Design" value={f.owner} onChange={(e) => setF({ ...f, owner: e.target.value })} />}</Field>
        </div>
        <Field label={`Rollout · ${f.rolloutPct}% of matching companies`} hint="Companies stay in the rollout as the percentage grows">
          {(id) => (
            <input
              id={id}
              type="range"
              min={0}
              max={100}
              step={5}
              value={f.rolloutPct}
              onChange={(e) => setF({ ...f, rolloutPct: Number(e.target.value) })}
              className="w-full accent-[#B08D4F]"
            />
          )}
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-[13px] font-medium">Plans (none ticked = every plan)</legend>
            {PLANS.map((p) => (
              <label key={p.id} className="flex items-center gap-2.5 text-[14px]">
                <Checkbox label={p.name} checked={f.plans.includes(p.id)} onChange={(on) => setF({ ...f, plans: toggle(f.plans, p.id, on) })} />
                {p.name}
              </label>
            ))}
          </fieldset>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-[13px] font-medium">Regions (none ticked = every region)</legend>
            {REGIONS.map((r) => (
              <label key={r.id} className="flex items-center gap-2.5 text-[14px]">
                <Checkbox label={r.name} checked={f.regions.includes(r.id)} onChange={(on) => setF({ ...f, regions: toggle(f.regions, r.id, on) })} />
                {r.name}
              </label>
            ))}
          </fieldset>
        </div>
        {!isNew && (
          <fieldset>
            <legend className="mb-2 text-[13px] font-medium">Pilot companies · always on for these</legend>
            <div className="scrollbar-thin grid max-h-48 gap-2 overflow-y-auto rounded-lg border border-linen p-3 sm:grid-cols-2">
              {companies.map((c) => (
                <label key={c.id} className="flex items-center gap-2.5 text-[14px]">
                  <Checkbox label={c.name} checked={f.companyIds.includes(c.id)} onChange={(on) => setF({ ...f, companyIds: toggle(f.companyIds, c.id, on) })} />
                  {c.name}
                </label>
              ))}
            </div>
          </fieldset>
        )}
      </div>
    </Modal>
  );
}

function ReleaseModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ version: '', notes: '' });
  const { busy, run } = useAction(onSaved);
  const save = () => run('save', () => api.post('/console/releases', f), `Release ${f.version} noted`).then((r) => r && onClose());
  return (
    <Modal
      open
      onClose={onClose}
      title="Add release notes"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="ink" loading={busy === 'save'} disabled={!f.version || f.notes.length < 4} onClick={save}>
            Publish notes
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Version">{(id) => <Input id={id} placeholder="2.15" value={f.version} onChange={(e) => setF({ ...f, version: e.target.value })} />}</Field>
        <Field label="What changed">{(id) => <Textarea id={id} rows={4} maxLength={600} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />}</Field>
      </div>
    </Modal>
  );
}
