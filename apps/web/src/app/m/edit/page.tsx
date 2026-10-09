'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Icon } from '@/components/icons';
import { useToast } from '@/components/toast';
import { Avatar, Button, Callout, Field, IconButton, Input, Loading, Select, Spinner, Textarea } from '@/components/ui';
import { api, useMe } from '@/lib/api';
import { LINK_TYPES } from '@/lib/catalog';
import { NoCard } from '../no-card';
import { useMyCard } from '../use-my-card';

export default function EditMyCard() {
  const { data, error, mutate } = useMyCard();
  const { data: me } = useMe();
  const [f, setF] = useState<any>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const toast = useToast();

  useEffect(() => {
    if (data && !f) {
      const c = data.card;
      setF({ bio: c.fields.bio || '', mobile: c.fields.mobile || '', whatsapp: c.fields.whatsapp || '', photoUrl: undefined as string | undefined, links: c.links || [], ar: c.translations?.ar || { name: '', title: '', bio: '' } });
    }
  }, [data, f]);

  if (error) return <NoCard />;
  if (!data || !f) return <Loading />;
  const p = data.permissions || {};
  const c = data.card;

  const upload = async (file?: File) => {
    if (!file) return;
    setBusy('photo');
    try {
      const r = await api.upload(file);
      setF({ ...f, photoUrl: r.url });
    } catch (e) {
      toast((e as Error).message, 'err');
    } finally {
      setBusy(null);
    }
  };
  const writeBio = async () => {
    setBusy('bio');
    try {
      const r = await api.post('/ai/bio', { name: c.fields.name, title: c.fields.title, department: c.fields.department, office: c.fields.office });
      setF({ ...f, bio: r.bio });
    } catch (e) {
      toast((e as Error).message, 'err');
    } finally {
      setBusy(null);
    }
  };
  const save = async () => {
    setBusy('save');
    try {
      const body: any = { mobile: f.mobile, whatsapp: f.whatsapp };
      if (p.bio !== false) body.bio = f.bio;
      if (p.links !== false) body.links = f.links.filter((l: any) => l.url);
      if (p.languages !== false && (f.ar.name || f.ar.title || f.ar.bio)) body.translations = { ...c.translations, ar: f.ar };
      if (f.photoUrl !== undefined && p.photo !== false) body.photoUrl = f.photoUrl;
      const r = await api.patch('/me/card', body);
      toast(r.message);
      mutate();
      setF(null);
    } catch (e) {
      toast((e as Error).message, 'err');
    } finally {
      setBusy(null);
    }
  };
  const setLink = (i: number, patch: any) => setF({ ...f, links: f.links.map((l: any, j: number) => (j === i ? { ...l, ...patch } : l)) });

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center gap-2">
        <Link href="/m" aria-label="Back" className="flex h-10 w-10 items-center justify-center rounded-md hover:bg-sand">
          <Icon name="back" />
        </Link>
        <h1 className="font-display text-[30px]">Edit my card</h1>
      </header>

      {data.pendingPhoto && (
        <Callout tone="warn" icon="info">
          Your new photo is waiting for approval.
        </Callout>
      )}

      {p.photo !== false && (
        <div className="flex items-center gap-4 rounded-xl border border-line bg-white p-4">
          <Avatar name={c.fields.name} src={f.photoUrl || c.fields.photoUrl} size={64} />
          <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-md border border-line-strong bg-white px-3 text-[14px]">
            {busy === 'photo' ? <Spinner size={15} /> : <Icon name="upload" size={16} />} Change photo
            <input type="file" accept="image/*" className="sr-only" onChange={(e) => upload(e.target.files?.[0])} />
          </label>
        </div>
      )}

      {p.bio !== false && (
        <div className="rounded-xl border border-line bg-white p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[15px] font-medium">About me</span>
            {me?.features.ai && (
              <Button size="sm" variant="gold" icon="sparkle" loading={busy === 'bio'} onClick={writeBio}>
                Write with AI
              </Button>
            )}
          </div>
          <Textarea aria-label="About me" rows={4} maxLength={300} value={f.bio} onChange={(e) => setF({ ...f, bio: e.target.value })} />
          <div className="mt-1 text-right text-[12px] text-stone-2">{f.bio.length} / 300</div>
        </div>
      )}

      <div className="grid gap-4 rounded-xl border border-line bg-white p-4">
        <Field label="Mobile">{(id) => <Input id={id} type="tel" value={f.mobile} onChange={(e) => setF({ ...f, mobile: e.target.value })} />}</Field>
        <Field label="WhatsApp">{(id) => <Input id={id} type="tel" value={f.whatsapp} onChange={(e) => setF({ ...f, whatsapp: e.target.value })} />}</Field>
      </div>

      {p.links !== false && (
        <div className="rounded-xl border border-line bg-white p-4">
          <div className="mb-3 text-[15px] font-medium">Links</div>
          <div className="flex flex-col gap-3">
            {f.links.map((l: any, i: number) => (
              <div key={i} className="flex flex-col gap-2 rounded-lg bg-pearl p-3">
                <div className="flex gap-2">
                  <Select aria-label="Link type" value={l.type} onChange={(e) => setLink(i, { type: e.target.value, label: LINK_TYPES.find((t) => t.id === e.target.value)?.name })} className="flex-1">
                    {LINK_TYPES.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </Select>
                  <IconButton icon="trash" label="Remove link" onClick={() => setF({ ...f, links: f.links.filter((_: any, j: number) => j !== i) })} />
                </div>
                <Input aria-label="Button text" value={l.label} onChange={(e) => setLink(i, { label: e.target.value })} />
                <Input aria-label="URL" type="url" placeholder="https://" value={l.url} onChange={(e) => setLink(i, { url: e.target.value })} />
              </div>
            ))}
          </div>
          <Button size="sm" icon="plus" className="mt-3" onClick={() => setF({ ...f, links: [...f.links, { type: 'linkedin', label: 'LinkedIn', url: '' }] })}>
            Add link
          </Button>
        </div>
      )}

      {p.languages !== false && (
        <div dir="rtl" className="grid gap-3 rounded-xl border border-line bg-white p-4">
          <div className="text-[15px] font-medium">العربية</div>
          <Input aria-label="Arabic name" placeholder="الاسم" value={f.ar.name || ''} onChange={(e) => setF({ ...f, ar: { ...f.ar, name: e.target.value } })} />
          <Input aria-label="Arabic title" placeholder="المسمى الوظيفي" value={f.ar.title || ''} onChange={(e) => setF({ ...f, ar: { ...f.ar, title: e.target.value } })} />
          <Textarea aria-label="Arabic bio" rows={2} placeholder="نبذة" value={f.ar.bio || ''} onChange={(e) => setF({ ...f, ar: { ...f.ar, bio: e.target.value } })} />
        </div>
      )}

      <p className="text-[13px] text-stone-2">Name, title and office come from HR and cannot be changed here.</p>
      <Button variant="ink" size="lg" loading={busy === 'save'} onClick={save}>
        Save changes
      </Button>
    </div>
  );
}
