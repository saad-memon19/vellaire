'use client';

import { useState } from 'react';
import { CardFace } from '@/components/card/card-face';
import { useToast } from '@/components/toast';
import { Badge, Button, cx, ErrorState, Field, Input, Loading, Modal, PageHeader, Select, Toggle } from '@/components/ui';
import { api, isManager, useApi, useMe } from '@/lib/api';
import { LAYOUTS, THEMES } from '@/lib/catalog';

export default function Templates() {
  const { data, error, mutate } = useApi<any[]>('/templates');
  const { data: brand } = useApi<any>('/brand');
  const { data: depts } = useApi<any[]>('/departments');
  const { data: me } = useMe();
  const [edit, setEdit] = useState<any>(null);
  const toast = useToast();
  const canEdit = isManager(me?.user.role);

  const apply = async (t: any) => {
    if (!confirm(`Apply "${t.name}" to every card that uses it${t.departments.length ? ` and every card in ${t.departments.join(', ')}` : ''}?`)) return;
    try {
      const r = await api.post(`/templates/${t.id}/apply`);
      toast(`${r.updated} cards updated`);
      mutate();
    } catch (e) {
      toast((e as Error).message, 'err');
    }
  };
  const remove = async (t: any) => {
    if (!confirm(`Delete "${t.name}"? Cards keep their current design.`)) return;
    await api.del(`/templates/${t.id}`);
    mutate();
  };

  if (error) return <ErrorState error={error} retry={() => mutate()} />;
  const b = brand ? { ...brand.brand, companyName: brand.companyName } : undefined;

  return (
    <div>
      <PageHeader
        eyebrow="Cards"
        title="Templates"
        desc="A template is a layout and a colour theme. New cards use their department's template, or the default."
        actions={canEdit && <Button variant="ink" icon="plus" onClick={() => setEdit({ name: '', layout: 'classic', theme: 'obsidian_gold', isDefault: false, departments: [] })}>New template</Button>}
      />
      {!data ? (
        <Loading />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data.map((t) => (
            <article key={t.id} className="flex flex-col rounded-xl border border-line bg-white p-4">
              <CardFace layout={t.layout} theme={t.theme} fields={{ name: me?.user.name || 'Full name', title: 'Job title' }} brand={b} width="100%" />
              <div className="mt-4 flex items-start justify-between gap-2">
                <div>
                  <h2 className="text-[16px] font-medium">{t.name}</h2>
                  <div className="text-[13px] text-stone-2">
                    {t.layoutName} · {t.themeName}
                  </div>
                </div>
                {t.isDefault && <Badge tone="gold">Default</Badge>}
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {t.departments.map((d: string) => (
                  <Badge key={d}>{d}</Badge>
                ))}
              </div>
              <div className="mt-auto flex items-center justify-between gap-2 border-t border-linen pt-3 text-[13px] text-stone-2">
                <span>{t.cards.toLocaleString()} cards</span>
                {canEdit && (
                  <span className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => apply(t)}>
                      Apply
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEdit(t)}>
                      Edit
                    </Button>
                    {!t.isDefault && (
                      <Button size="sm" variant="ghost" onClick={() => remove(t)}>
                        Delete
                      </Button>
                    )}
                  </span>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
      {edit && (
        <TemplateEditor
          t={edit}
          brand={b}
          departments={(depts || []).map((d) => d.name)}
          onClose={() => setEdit(null)}
          onSaved={() => {
            setEdit(null);
            mutate();
          }}
        />
      )}
    </div>
  );
}

function TemplateEditor({ t, brand, departments, onClose, onSaved }: { t: any; brand: any; departments: string[]; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ name: t.name, layout: t.layout, theme: t.theme, isDefault: t.isDefault, departments: t.departments as string[] });
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const save = async () => {
    setBusy(true);
    try {
      if (t.id) await api.patch(`/templates/${t.id}`, f);
      else await api.post('/templates', f);
      toast('Template saved');
      onSaved();
    } catch (e) {
      toast((e as Error).message, 'err');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      open
      wide
      onClose={onClose}
      title={t.id ? 'Edit template' : 'New template'}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="ink" loading={busy} disabled={!f.name} onClick={save}>
            Save template
          </Button>
        </>
      }
    >
      <div className="grid gap-6 md:grid-cols-[1fr_280px]">
        <div className="flex flex-col gap-4">
          <Field label="Name">{(id) => <Input id={id} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />}</Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Layout">
              {(id) => (
                <Select id={id} value={f.layout} onChange={(e) => setF({ ...f, layout: e.target.value })}>
                  {LAYOUTS.map((l) => (
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
                  {THEMES.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.name}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          </div>
          <div>
            <div className="mb-2 text-[13px] font-medium">Used by departments</div>
            <div className="flex flex-wrap gap-2">
              {departments.map((d) => {
                const on = f.departments.includes(d);
                return (
                  <button
                    key={d}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setF({ ...f, departments: on ? f.departments.filter((x) => x !== d) : [...f.departments, d] })}
                    className={cx('rounded-full px-3 py-1.5 text-[13px]', on ? 'bg-ink text-cream' : 'bg-pearl text-stone hover:text-ink')}
                  >
                    {d}
                  </button>
                );
              })}
            </div>
          </div>
          <label className="flex items-center justify-between gap-3 text-[14px]">
            Default for everyone else
            <Toggle checked={f.isDefault} onChange={(v) => setF({ ...f, isDefault: v })} label="Default template" />
          </label>
        </div>
        <div className="flex flex-col gap-3">
          <CardFace layout={f.layout} theme={f.theme} fields={{ name: 'Full name', title: 'Job title' }} brand={brand} width="100%" />
          <CardFace layout={f.layout} theme={f.theme} fields={{}} brand={brand} side="back" width="100%" />
        </div>
      </div>
    </Modal>
  );
}
