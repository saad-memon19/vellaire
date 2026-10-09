'use client';

import { useState } from 'react';
import { Icon } from '@/components/icons';
import { Button, cx, ErrorState, Field, Input, Loading, Modal, PageHeader, Select, Textarea } from '@/components/ui';
import { api, useApi } from '@/lib/api';
import { EmptyRow, GridRow, GridTable, Pill, RowButton, Section, useAction } from '../parts';

const EMAIL_COLS = '1.6fr 2fr 1fr 1fr 100px';
const REGIONS = [
  { id: 'all', name: 'Every region' },
  { id: 'me', name: 'Middle East' },
  { id: 'eu', name: 'Europe' },
  { id: 'us', name: 'Americas' },
];
const PLANS = [
  { id: 'all', name: 'Every plan' },
  { id: 'starter', name: 'Starter' },
  { id: 'professional', name: 'Professional' },
  { id: 'enterprise', name: 'Enterprise' },
];
const blank = { message: '', link: '', audience: { roles: 'admins', region: 'all', plan: 'all' }, startsAt: '' };
type Draft = typeof blank;

export default function Announcements() {
  const { data, error, mutate } = useApi<any>('/console/announcements');
  const { busy, run } = useAction(mutate);
  const [draft, setDraft] = useState<Draft>(blank);
  const [edit, setEdit] = useState<any>(null);
  const [email, setEmail] = useState<any>(null);

  const publish = (mode: 'now' | 'schedule' | 'draft') =>
    run(
      mode,
      () => api.post('/console/announcements', { ...draft, publish: mode, startsAt: draft.startsAt ? new Date(draft.startsAt).toISOString() : undefined }),
      mode === 'now' ? 'Published. Customers see it on their next page load.' : mode === 'schedule' ? 'Scheduled' : 'Saved as a draft',
    ).then((r) => r && setDraft(blank));

  if (error) return <ErrorState error={error} retry={() => mutate()} />;
  return (
    <div className="flex flex-col gap-5.5 [&>header]:mb-0">
      <PageHeader eyebrow="Support" title="Announcements and emails" desc="Banners shown inside customer dashboards, and the emails Vellaire sends." />
      {!data ? (
        <Loading />
      ) : (
        <>
          <div className="flex flex-wrap items-start gap-4">
            <Section title="In-app announcements" className="min-w-0 flex-[3_1_520px]">
              {data.announcements.length === 0 && <EmptyRow>No announcements yet</EmptyRow>}
              {data.announcements.map((a: any) => (
                <div key={a.id} className="flex flex-wrap items-center gap-3.5 border-t border-[#F0EBE2] px-5 py-3.5">
                  <span className="flex min-w-0 flex-[1_1_260px] flex-col gap-0.5">
                    <span className="font-semibold">{a.message}</span>
                    <span className="text-[12.5px] text-stone-2">
                      {a.who} · {a.when}
                    </span>
                  </span>
                  <Pill status={a.status} />
                  <RowButton className="h-8.5" onClick={() => setEdit(a)}>
                    Edit
                  </RowButton>
                </div>
              ))}
            </Section>
            <Composer draft={draft} setDraft={setDraft} busy={busy} onPublish={publish} />
          </div>
          <Section
            title="Email templates"
            sub={
              data.mailReady
                ? 'Emails Vellaire sends automatically. You can change the heading or add a closing note.'
                : 'Email is not set up yet: add RESEND_API_KEY on the server. Until then emails print to the API log.'
            }
          >
            <GridTable cols={EMAIL_COLS} minWidth={860} head={['Email', 'Sent when', 'Last 30 days', 'Delivered', '']}>
              {data.emails.map((e: any) => (
                <GridRow key={e.key} cols={EMAIL_COLS}>
                  <span className="flex flex-col">
                    <span className="font-semibold">{e.name}</span>
                    {e.edited && <span className="text-[12px] text-gold-text">Customised</span>}
                  </span>
                  <span className="text-[#4E4A44]">{e.when}</span>
                  <span className="tabular-nums">{e.sent.toLocaleString()}</span>
                  <span className="tabular-nums">{e.delivered === null ? '—' : `${e.delivered}%`}</span>
                  <span className="flex justify-end">
                    <RowButton onClick={() => setEmail(e)}>Edit</RowButton>
                  </span>
                </GridRow>
              ))}
            </GridTable>
          </Section>
        </>
      )}
      {edit && <EditAnnouncement item={edit} onClose={() => setEdit(null)} onSaved={mutate} />}
      {email && <EditEmail email={email} onClose={() => setEmail(null)} onSaved={mutate} />}
    </div>
  );
}

function AudienceFields({ value, onChange }: { value: Draft['audience']; onChange: (a: Draft['audience']) => void }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-[13px] font-medium">Show to</span>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Who sees it">
        {(['admins', 'everyone'] as const).map((r) => (
          <button
            key={r}
            type="button"
            role="radio"
            aria-checked={value.roles === r}
            onClick={() => onChange({ ...value, roles: r })}
            className={cx('h-8 rounded-full border px-3 text-[12.5px]', value.roles === r ? 'border-ink bg-ink text-white' : 'border-[#E0D9CC] bg-white')}
          >
            {r === 'admins' ? 'Company admins' : 'Everyone'}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Select aria-label="Region" value={value.region} onChange={(e) => onChange({ ...value, region: e.target.value })}>
          {REGIONS.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </Select>
        <Select aria-label="Plan" value={value.plan} onChange={(e) => onChange({ ...value, plan: e.target.value })}>
          {PLANS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
      </div>
    </div>
  );
}

function Preview({ message, link }: { message: string; link?: string }) {
  return (
    <div className="flex items-center gap-2.5 rounded-[10px] border border-gold-line bg-[#FBF6EC] px-3.5 py-3 text-[13.5px]">
      <Icon name="dMega" size={16} className="shrink-0 text-gold-text" />
      <span className="flex-1">{message || 'Your message appears here.'}</span>
      {link && <span className="font-medium text-gold-text">Learn more</span>}
    </div>
  );
}

function Composer({ draft, setDraft, busy, onPublish }: { draft: Draft; setDraft: (d: Draft) => void; busy: string | null; onPublish: (m: 'now' | 'schedule' | 'draft') => void }) {
  const ready = draft.message.trim().length >= 4;
  return (
    <Section className="min-w-0 flex-[2_1_380px]">
      <div className="flex flex-col gap-3.5 p-5">
        <h2 className="text-[16px] font-semibold">New announcement</h2>
        <Field label="Message">
          {(id) => <Textarea id={id} rows={3} maxLength={240} value={draft.message} onChange={(e) => setDraft({ ...draft, message: e.target.value })} />}
        </Field>
        <Field label="Link (optional)" hint="A page in the dashboard, like /app/signatures, or a full web address">
          {(id) => <Input id={id} value={draft.link} onChange={(e) => setDraft({ ...draft, link: e.target.value })} />}
        </Field>
        <AudienceFields value={draft.audience} onChange={(audience) => setDraft({ ...draft, audience })} />
        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium">Preview</span>
          <Preview message={draft.message} link={draft.link} />
        </div>
        <Field label="Start on (to schedule)">
          {(id) => <Input id={id} type="datetime-local" value={draft.startsAt} onChange={(e) => setDraft({ ...draft, startsAt: e.target.value })} />}
        </Field>
        <div className="flex flex-wrap gap-2">
          <Button className="flex-1" disabled={!ready} loading={busy === 'draft'} onClick={() => onPublish('draft')}>
            Save draft
          </Button>
          <Button className="flex-1" disabled={!ready || !draft.startsAt} loading={busy === 'schedule'} onClick={() => onPublish('schedule')}>
            Schedule
          </Button>
          <Button variant="ink" className="flex-1" disabled={!ready} loading={busy === 'now'} onClick={() => onPublish('now')}>
            Publish now
          </Button>
        </div>
      </div>
    </Section>
  );
}

function EditAnnouncement({ item, onClose, onSaved }: { item: any; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({
    message: item.message,
    link: item.link,
    audience: { roles: item.audience?.roles || 'admins', region: item.audience?.region || 'all', plan: item.audience?.plan || 'all' },
  });
  const { busy, run } = useAction(onSaved);
  const save = (action?: 'publish' | 'archive' | 'draft') =>
    run(
      action || 'save',
      () => api.patch(`/console/announcements/${item.id}`, { ...f, action }),
      action === 'archive' ? 'Archived' : action === 'publish' ? 'Published' : 'Saved',
    ).then((r) => r && onClose());
  const targeted = item.audience?.companyIds?.length > 0;
  return (
    <Modal
      open
      onClose={onClose}
      title="Edit announcement"
      footer={
        <>
          {item.status !== 'archived' ? (
            <Button loading={busy === 'archive'} onClick={() => save('archive')}>
              Archive
            </Button>
          ) : null}
          {item.status !== 'live' && (
            <Button loading={busy === 'publish'} onClick={() => save('publish')}>
              Publish now
            </Button>
          )}
          <Button variant="ink" loading={busy === 'save'} onClick={() => save()}>
            Save
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Message">{(id) => <Textarea id={id} rows={3} maxLength={240} value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} />}</Field>
        <Field label="Link (optional)">{(id) => <Input id={id} value={f.link} onChange={(e) => setF({ ...f, link: e.target.value })} />}</Field>
        {targeted ? (
          <p className="text-[13px] text-stone">Shown only to {item.who.toLowerCase()}.</p>
        ) : (
          <AudienceFields value={f.audience} onChange={(audience) => setF({ ...f, audience })} />
        )}
        <Preview message={f.message} link={f.link} />
      </div>
    </Modal>
  );
}

function EditEmail({ email, onClose, onSaved }: { email: any; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ heading: email.copy?.heading || '', note: email.copy?.note || '' });
  const { busy, run } = useAction(onSaved);
  const save = () => run('save', () => api.patch(`/console/emails/${email.key}`, f), 'Email updated. The next send uses it.').then((r) => r && onClose());
  return (
    <Modal
      open
      onClose={onClose}
      title={email.name}
      footer={
        <>
          <Button onClick={() => setF({ heading: '', note: '' })}>Restore default</Button>
          <Button variant="ink" loading={busy === 'save'} onClick={save}>
            Save
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-[14px] text-stone">Sent when: {email.when.toLowerCase()}. The body stays the same so every detail is always right.</p>
        <Field label="Heading" hint="Leave empty to keep the standard heading">
          {(id) => <Input id={id} maxLength={120} value={f.heading} onChange={(e) => setF({ ...f, heading: e.target.value })} />}
        </Field>
        <Field label="Closing note" hint="Added as the last paragraph, for example a support number">
          {(id) => <Textarea id={id} rows={3} maxLength={400} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} />}
        </Field>
      </div>
    </Modal>
  );
}
