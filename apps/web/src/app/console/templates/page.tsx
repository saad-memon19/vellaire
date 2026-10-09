'use client';

import { useState } from 'react';
import { CardFace } from '@/components/card/card-face';
import { Button, ErrorState, Field, Input, Loading, Modal, PageHeader, PillTabs, Select } from '@/components/ui';
import { api, useApi } from '@/lib/api';
import { Pill, RowButton, useAction } from '../parts';

type Tab = 'live' | 'draft' | 'retired' | 'themes';
const SAMPLE = { name: 'Full Name', title: 'Job title' };
const BRAND = { companyName: 'Company' };

export default function TemplateLibrary() {
  const { data, error, mutate } = useApi<any>('/console/library');
  const { busy, run } = useAction(mutate);
  const [tab, setTab] = useState<Tab>('live');
  const [edit, setEdit] = useState<any>(null);

  if (error) return <ErrorState error={error} retry={() => mutate()} />;
  const count = (s: string) => data?.templates.filter((t: any) => t.status === s).length ?? null;
  const shown = data?.templates.filter((t: any) => t.status === tab) || [];
  const setStatus = (t: any, status: string, msg: string) => run(t.id, () => api.patch(`/console/library/${t.id}`, { status }), msg);

  return (
    <div className="flex flex-col gap-5.5 [&>header]:mb-0">
      <PageHeader
        eyebrow="Operations"
        title="Template library"
        desc="Card templates and colour themes every customer can choose from."
        actions={
          <Button variant="ink" onClick={() => setEdit({})}>
            New template
          </Button>
        }
      />
      <PillTabs
        items={[
          { id: 'live', name: 'Templates', count: count('live') },
          { id: 'themes', name: 'Themes', count: data?.themes.length ?? null },
          { id: 'draft', name: 'Drafts', count: count('draft') },
          { id: 'retired', name: 'Retired', count: count('retired') },
        ]}
        value={tab}
        onChange={setTab}
      />
      {!data ? (
        <Loading />
      ) : tab === 'themes' ? (
        <Grid>
          {data.themes.map((t: any) => (
            <Tile
              key={t.id}
              preview={<CardFace layout="classic" theme={t.id} fields={SAMPLE} brand={BRAND} width="100%" />}
              title={t.name}
              sub={`Used by ${t.usedBy} ${t.usedBy === 1 ? 'company' : 'companies'}`}
            />
          ))}
        </Grid>
      ) : shown.length === 0 ? (
        <p className="py-14 text-center text-[14px] text-stone-2">{tab === 'draft' ? 'No drafts. Start a new template to design one.' : 'Nothing here yet.'}</p>
      ) : (
        <Grid>
          {shown.map((t: any) => (
            <Tile
              key={t.id}
              preview={<CardFace layout={t.layout} theme={t.theme} fields={SAMPLE} brand={BRAND} width="100%" />}
              title={t.name}
              sub={`Used by ${t.usedBy} ${t.usedBy === 1 ? 'company' : 'companies'}`}
              status={t.status}
              actions={
                <>
                  <RowButton className="h-9 flex-1" onClick={() => setEdit(t)}>
                    Edit
                  </RowButton>
                  {t.status === 'live' ? (
                    <RowButton className="h-9 flex-1" disabled={busy === t.id} onClick={() => setStatus(t, 'retired', `${t.name} retired`)}>
                      Retire
                    </RowButton>
                  ) : (
                    <RowButton className="h-9 flex-1" disabled={busy === t.id} onClick={() => setStatus(t, 'live', `${t.name} is live for every customer`)}>
                      Publish
                    </RowButton>
                  )}
                </>
              }
            />
          ))}
        </Grid>
      )}
      {edit && data && <TemplateModal template={edit} layouts={data.layouts} themes={data.themes} onClose={() => setEdit(null)} onSaved={mutate} />}
    </div>
  );
}

const Grid = ({ children }: { children: React.ReactNode }) => <div className="grid grid-cols-[repeat(auto-fit,minmax(min(250px,100%),1fr))] gap-4">{children}</div>;

function Tile({ preview, title, sub, status, actions }: { preview: React.ReactNode; title: string; sub: string; status?: string; actions?: React.ReactNode }) {
  return (
    <article className="flex flex-col gap-3 rounded-[14px] border border-linen bg-white p-3.5">
      <div className="flex justify-center rounded-[10px] bg-sand p-4.5">
        <div className="w-full max-w-52.5">{preview}</div>
      </div>
      <div className="flex items-start justify-between gap-2">
        <span className="flex flex-col gap-0.5">
          <span className="font-semibold">{title}</span>
          <span className="text-[12.5px] text-stone-2">{sub}</span>
        </span>
        {status && <Pill status={status} />}
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </article>
  );
}

function TemplateModal({ template, layouts, themes, onClose, onSaved }: { template: any; layouts: any[]; themes: any[]; onClose: () => void; onSaved: () => void }) {
  const isNew = !template.id;
  const [f, setF] = useState({ name: template.name || '', layout: template.layout || layouts[0].id, theme: template.theme || themes[0].id });
  const { busy, run } = useAction(onSaved);
  const save = () =>
    run('save', () => (isNew ? api.post('/console/library', f) : api.patch(`/console/library/${template.id}`, f)), isNew ? `${f.name} saved as a draft` : `${f.name} saved`).then(
      (r) => r && onClose(),
    );
  return (
    <Modal
      open
      onClose={onClose}
      title={isNew ? 'New template' : `Edit ${template.name}`}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="ink" loading={busy === 'save'} disabled={f.name.trim().length < 2} onClick={save}>
            {isNew ? 'Save draft' : 'Save'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex justify-center rounded-xl bg-sand p-5">
          <CardFace layout={f.layout} theme={f.theme} fields={SAMPLE} brand={BRAND} width={260} />
        </div>
        <Field label="Name">{(id) => <Input id={id} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />}</Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Layout">
            {(id) => (
              <Select id={id} value={f.layout} onChange={(e) => setF({ ...f, layout: e.target.value })}>
                {layouts.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Colour theme">
            {(id) => (
              <Select id={id} value={f.theme} onChange={(e) => setF({ ...f, theme: e.target.value })}>
                {themes.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>
      </div>
    </Modal>
  );
}
