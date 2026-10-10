'use client';

import { useState } from 'react';
import { Icon } from '@/components/icons';
import { useToast } from '@/components/toast';
import { Avatar, Button, cx, Field, Input, Loading, Modal, PillTabs, Spinner, Textarea } from '@/components/ui';
import { api, qs, useApi, useMe } from '@/lib/api';
import { shrinkImage, toDataUrl } from '@/lib/image';
import { NoCard } from '../no-card';

export default function MobileLeads() {
  const [tab, setTab] = useState<'follow-up' | 'all'>('follow-up');
  const { data, error, mutate } = useApi<any>(`/me/leads${qs({ tab })}`, { shouldRetryOnError: false });
  const { data: me } = useMe();
  const [openId, setOpenId] = useState<string | null>(null);
  const [scan, setScan] = useState(false);
  const toast = useToast();
  const [sending, setSending] = useState(false);

  if (error) return <NoCard />;
  if (!data) return <Loading />;

  const sendDraft = async () => {
    setSending(true);
    try {
      await api.post(`/leads/${data.draft.id}/send`, { text: data.draft.text });
      toast(`Sent to ${data.draft.name}`);
      mutate();
    } catch (e) {
      toast((e as Error).message, 'err');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <header className="flex items-center justify-between">
        <h1 className="font-display text-[34px]">Leads</h1>
        <Button size="sm" icon="scan" onClick={() => setScan(true)}>
          Scan paper card
        </Button>
      </header>
      <PillTabs
        items={[
          { id: 'follow-up', name: 'To follow up', count: data.tabs.followUp },
          { id: 'all', name: 'All', count: data.tabs.all },
        ]}
        value={tab}
        onChange={setTab}
      />

      {data.rows.length === 0 ? (
        <p className="py-10 text-center text-[14px] text-stone-2">{tab === 'follow-up' ? 'All followed up. Well done.' : 'No leads yet. Share your card to start.'}</p>
      ) : (
        <ul className="m-0 flex list-none flex-col overflow-hidden rounded-2xl border border-linen bg-white p-0">
          {data.rows.map((l: any, i: number) => (
            <li key={l.id} className={i ? 'border-t border-[#F0EBE2]' : ''}>
              <button type="button" onClick={() => setOpenId(l.id)} className="flex w-full items-center gap-3 px-4 py-3.5 text-left">
                <Avatar name={l.name} size={40} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-semibold">{l.name}</span>
                  <span className="block truncate text-[13px] text-stone">{l.co}</span>
                  <span className="block text-[12px] text-stone-2">
                    {l.via} · {l.when}
                  </span>
                </span>
                {/* Gold dot: still waiting for a follow-up */}
                <span aria-label={l.status === 'new' ? 'Needs follow-up' : 'Followed up'} className={cx('h-2 w-2 shrink-0 rounded-full', l.status === 'new' ? 'bg-gold' : 'bg-linen')} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {data.draft && (
        <div className="flex flex-col gap-3 rounded-2xl border border-gold-line bg-[#FBF6EC] p-4">
          <div className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.2em] text-gold-text">
            <Icon name="sparkle" size={16} /> DRAFT FOR {data.draft.name.toUpperCase()}
          </div>
          <p className="m-0 line-clamp-4 whitespace-pre-wrap text-[14px] leading-relaxed text-ink">{data.draft.text}</p>
          <div className="grid grid-cols-2 gap-2.5">
            <Button variant="ink" onClick={sendDraft} loading={sending}>
              Send email
            </Button>
            <Button onClick={() => setOpenId(data.draft.id)}>Edit</Button>
          </div>
        </div>
      )}

      {openId && <LeadSheet id={openId} ai={!!me?.features.ai} onClose={() => { setOpenId(null); mutate(); }} />}
      <ScanSheet open={scan} ai={!!me?.features.ai} onClose={() => setScan(false)} onSaved={() => mutate()} />
    </div>
  );
}

function LeadSheet({ id, ai, onClose }: { id: string; ai: boolean; onClose: () => void }) {
  const { data, mutate } = useApi<any>(`/leads/${id}`);
  const [text, setText] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const toast = useToast();
  const value = text ?? data?.draft ?? '';

  const write = async () => {
    setBusy('draft');
    try {
      const r = await api.post(`/leads/${id}/draft`, {});
      setText(r.draft);
    } catch (e) {
      toast((e as Error).message, 'err');
    } finally {
      setBusy(null);
    }
  };
  const send = async () => {
    setBusy('send');
    try {
      await api.post(`/leads/${id}/send`, { text: value });
      toast('Sent');
      mutate();
      onClose();
    } catch (e) {
      toast((e as Error).message, 'err');
    } finally {
      setBusy(null);
    }
  };

  return (
    <Modal open onClose={onClose} title={data?.name || 'Lead'}>
      {!data ? (
        <Loading />
      ) : (
        <div className="flex flex-col gap-4">
          <div className="text-[14px] text-stone">{[data.jobTitle, data.company].filter(Boolean).join(' · ')}</div>
          <div className="grid grid-cols-2 gap-2">
            {data.phone && (
              <a href={`tel:${data.phone}`} className="flex h-11 items-center justify-center gap-2 rounded-md border border-line text-[14px]">
                <Icon name="phone" size={17} /> Call
              </a>
            )}
            {data.phone && (
              <a href={`https://wa.me/${data.phone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className="flex h-11 items-center justify-center gap-2 rounded-md border border-line text-[14px]">
                <Icon name="whatsapp" size={17} /> WhatsApp
              </a>
            )}
          </div>
          <div className="text-[13px] text-stone-2">{data.met}</div>
          {data.note && <p className="rounded-md bg-pearl p-3 text-[14px] italic">{data.note}</p>}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="eyebrow">Follow-up</span>
              <Button size="sm" variant="gold" icon={ai ? 'sparkle' : 'edit'} loading={busy === 'draft'} onClick={write}>
                {value ? 'Rewrite' : 'Write draft'}
              </Button>
            </div>
            <Textarea aria-label="Follow-up" rows={7} value={value} onChange={(e) => setText(e.target.value)} />
          </div>
          <Button variant="ink" size="lg" icon="send" disabled={!value || !data.email} loading={busy === 'send'} onClick={send}>
            {data.email ? 'Send email' : 'No email address'}
          </Button>
        </div>
      )}
    </Modal>
  );
}

function ScanSheet({ open, ai, onClose, onSaved }: { open: boolean; ai: boolean; onClose: () => void; onSaved: () => void }) {
  const empty = { name: '', company: '', jobTitle: '', email: '', phone: '', note: '' };
  const [f, setF] = useState(empty);
  const [busy, setBusy] = useState<string | null>(null);
  const toast = useToast();

  const read = async (file?: File) => {
    if (!file) return;
    setBusy('scan');
    try {
      // A smaller photo reads just as well and keeps the request under the server limit
      const photo = await shrinkImage(file, 1600, 2_500_000);
      const type = photo.type === 'image/png' || photo.type === 'image/webp' ? photo.type : 'image/jpeg';
      const out = await api.post('/leads/scan', { image: await toDataUrl(photo), mediaType: type });
      setF({ ...f, ...Object.fromEntries(Object.entries(out).filter(([k]) => k in empty)) });
      toast('Details read from the card. Check them, then save.');
    } catch (e) {
      toast((e as Error).message, 'err');
    } finally {
      setBusy(null);
    }
  };
  const save = async () => {
    setBusy('save');
    try {
      await api.post('/leads', { ...f, via: 'paper' });
      toast('Lead saved');
      setF(empty);
      onSaved();
      onClose();
    } catch (e) {
      toast((e as Error).message, 'err');
    } finally {
      setBusy(null);
    }
  };
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
  return (
    <Modal open={open} onClose={onClose} title="Paper business card" footer={<Button variant="ink" loading={busy === 'save'} disabled={!f.name} onClick={save}>Save lead</Button>}>
      <div className="flex flex-col gap-4">
        {ai && (
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-line-strong bg-pearl py-6 text-[14px]">
            {busy === 'scan' ? <Spinner /> : <Icon name="scan" className="text-gold-text" />}
            {busy === 'scan' ? 'Reading the card…' : 'Take a photo of the card'}
            <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => read(e.target.files?.[0])} />
          </label>
        )}
        <Field label="Name">{(id) => <Input id={id} value={f.name} onChange={set('name')} />}</Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Company">{(id) => <Input id={id} value={f.company} onChange={set('company')} />}</Field>
          <Field label="Title">{(id) => <Input id={id} value={f.jobTitle} onChange={set('jobTitle')} />}</Field>
        </div>
        <Field label="Email">{(id) => <Input id={id} type="email" value={f.email} onChange={set('email')} />}</Field>
        <Field label="Phone">{(id) => <Input id={id} type="tel" value={f.phone} onChange={set('phone')} />}</Field>
        <Field label="Note">{(id) => <Textarea id={id} rows={2} value={f.note} onChange={set('note')} placeholder="Where you met, what you discussed" />}</Field>
      </div>
    </Modal>
  );
}
