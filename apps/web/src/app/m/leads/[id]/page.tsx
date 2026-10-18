'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/icons';
import { useToast } from '@/components/toast';
import { Button, cx, ErrorState, Loading } from '@/components/ui';
import { api, useApi, useMe } from '@/lib/api';
import { downloadReminder, downloadVcard, sendFollowUp } from '../follow-up';

/** One lead: contact actions, their details, the follow-up draft and a private note. Design: LeadDetail. */
export default function LeadDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: l, error, mutate } = useApi<any>(`/leads/${id}`);
  const { data: me } = useMe();
  const toast = useToast();
  const [text, setText] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [menu, setMenu] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const savedNote = useRef('');

  useEffect(() => {
    if (l && note === null) {
      setNote(l.myNote);
      savedNote.current = l.myNote;
    }
  }, [l, note]);

  if (error) return <ErrorState error={error} retry={() => mutate()} />;
  if (!l) return <Loading />;
  const draft = text ?? l.draft;

  const write = async () => {
    setBusy('draft');
    try {
      setText((await api.post(`/leads/${id}/draft`, {})).draft);
    } catch (e) {
      toast((e as Error).message, 'err');
    } finally {
      setBusy(null);
    }
  };
  const send = async () => {
    setBusy('send');
    try {
      const how = await sendFollowUp(l, draft, me?.company?.name);
      toast(how === 'sent' ? `Sent to ${l.name.split(' ')[0]}` : 'Opened in your mail app. Marked as followed up.');
      mutate();
    } catch (e) {
      toast((e as Error).message, 'err');
    } finally {
      setBusy(null);
    }
  };
  const saveNote = async () => {
    if (note === null || note === savedNote.current) return;
    try {
      await api.patch(`/leads/${id}`, { myNote: note });
      savedNote.current = note;
      toast('Note saved');
    } catch (e) {
      toast((e as Error).message, 'err');
    }
  };
  const setStatus = async (status: 'new' | 'followed_up') => {
    setMenu(false);
    await api.patch(`/leads/${id}`, { status });
    toast(status === 'new' ? 'Marked to follow up' : 'Marked as followed up');
    mutate();
  };

  const met = `${new Date(l.createdAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} · ${l.via}`;
  const actions = [
    { label: 'Call', icon: 'phone', href: l.phone ? `tel:${l.phone}` : undefined },
    { label: 'Email', icon: 'mail', href: l.email ? `mailto:${l.email}` : undefined },
    { label: 'WhatsApp', icon: 'whatsapp', href: l.phone ? `https://wa.me/${l.phone.replace(/\D/g, '')}` : undefined },
  ] as const;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Link href="/m/leads" aria-label="Back" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-linen bg-white text-ink">
          <Icon name="left" size={20} />
        </Link>
        <h1 className="m-0 flex-1 font-display text-[28px] font-medium">Lead</h1>
        <div className="relative">
          <button type="button" aria-label="More" aria-expanded={menu} onClick={() => setMenu(!menu)} className="flex h-11 w-11 items-center justify-center rounded-xl border border-linen bg-white text-ink">
            <Icon name="more" size={20} />
          </button>
          {menu && (
            <div className="absolute right-0 top-12 z-20 w-56 overflow-hidden rounded-xl border border-linen bg-white shadow-lg">
              {l.status === 'new' ? (
                <button type="button" onClick={() => setStatus('followed_up')} className="block w-full px-4 py-3 text-left text-[14px] hover:bg-pearl">
                  Mark as followed up
                </button>
              ) : (
                <button type="button" onClick={() => setStatus('new')} className="block w-full px-4 py-3 text-left text-[14px] hover:bg-pearl">
                  Mark to follow up
                </button>
              )}
              <button type="button" onClick={() => router.push('/m/leads')} className="block w-full border-t border-[#F0EBE2] px-4 py-3 text-left text-[14px] hover:bg-pearl">
                Back to all leads
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3.5">
        <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-[#F2EEE6] font-display text-[24px] font-semibold text-gold-text">{l.ini}</span>
        <span className="flex min-w-0 flex-col gap-[3px]">
          <span className="font-display text-[26px] font-medium leading-tight">{l.name}</span>
          {(l.jobTitle || l.company) && <span className="text-[13px] text-stone">{[l.jobTitle, l.company].filter(Boolean).join(' · ')}</span>}
          <span className={cx('text-[12px]', l.consent ? 'text-ok' : 'text-stone-2')}>{l.consent ? 'Agreed to be contacted' : 'Did not agree to be contacted'}</span>
        </span>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {actions.map((a) =>
          a.href ? (
            <a key={a.label} href={a.href} target={a.label === 'WhatsApp' ? '_blank' : undefined} rel="noreferrer" className="flex h-[62px] flex-col items-center justify-center gap-1 rounded-[14px] border border-linen bg-white text-[11px] text-[#4E4A44]">
              <Icon name={a.icon} size={20} className="text-gold-text" />
              {a.label}
            </a>
          ) : (
            <span key={a.label} aria-disabled="true" className="flex h-[62px] flex-col items-center justify-center gap-1 rounded-[14px] border border-linen bg-white text-[11px] text-[#4E4A44] opacity-40">
              <Icon name={a.icon} size={20} className="text-gold-text" />
              {a.label}
            </span>
          ),
        )}
        <button type="button" onClick={() => downloadVcard(l)} className="flex h-[62px] flex-col items-center justify-center gap-1 rounded-[14px] border border-linen bg-white text-[11px] text-[#4E4A44]">
          <Icon name="download" size={20} className="text-gold-text" />
          Save
        </button>
      </div>

      <dl className="m-0 grid grid-cols-[84px_1fr] gap-x-2.5 gap-y-[9px] rounded-2xl border border-linen bg-white px-4 py-3.5 text-[13.5px]">
        <dt className="text-stone-2">Email</dt>
        <dd className="m-0 break-all">{l.email || '—'}</dd>
        <dt className="text-stone-2">Phone</dt>
        <dd className="m-0">{l.phone || '—'}</dd>
        <dt className="text-stone-2">Met</dt>
        <dd className="m-0">{met}</dd>
        {l.note && (
          <>
            <dt className="text-stone-2">{l.paper ? 'Where you met' : 'Their note'}</dt>
            <dd className="m-0 leading-[1.45]">{l.note}</dd>
          </>
        )}
      </dl>

      <section className="flex flex-col gap-2.5 rounded-2xl border border-gold-line bg-[#FBF6EC] px-4 py-3.5">
        <span className="flex items-center gap-2 text-[10.5px] font-semibold tracking-[0.2em] text-gold-text">
          <Icon name="sparkle" size={16} /> {me?.features.ai ? 'AI FOLLOW-UP' : 'FOLLOW-UP'}
        </span>
        {editing ? (
          <textarea aria-label="Follow-up" rows={6} value={draft} onChange={(e) => setText(e.target.value)} className="rounded-xl border border-[#E0D9CC] bg-white p-3 text-[14px] leading-relaxed outline-none focus:border-gold" />
        ) : draft ? (
          <p className="m-0 whitespace-pre-wrap text-[13.5px] leading-[1.55] text-[#2A2A30]">{draft}</p>
        ) : (
          <p className="m-0 text-[13.5px] text-stone">No draft yet.</p>
        )}
        {draft ? (
          <div className="grid grid-cols-2 gap-2">
            <Button variant="ink" loading={busy === 'send'} disabled={!l.email || !l.consent} onClick={send}>
              {!l.email ? 'No email' : 'Send email'}
            </Button>
            <Button onClick={() => setEditing(!editing)}>{editing ? 'Done' : 'Edit'}</Button>
          </div>
        ) : (
          <Button variant="ink" icon="sparkle" loading={busy === 'draft'} onClick={write}>
            Write a follow-up
          </Button>
        )}
        {!l.consent && <span className="text-[12px] text-stone">They did not agree to be contacted, so Vellaire will not send it.</span>}
      </section>

      <label className="flex flex-col gap-1.5 text-[13px] font-medium">
        My notes
        <textarea rows={2} value={note ?? ''} placeholder="Add a private note" onChange={(e) => setNote(e.target.value)} onBlur={saveNote} className="resize-none rounded-xl border border-[#E0D9CC] bg-white p-3 text-[14px] font-normal outline-none focus:border-gold" />
      </label>

      <Button size="lg" icon="calendar" onClick={() => downloadReminder(l.name)}>
        Set a reminder
      </Button>
    </div>
  );
}
