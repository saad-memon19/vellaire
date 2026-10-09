'use client';

import { useState } from 'react';
import { useToast } from '@/components/toast';
import { Button, cx, Empty, ErrorState, Field, Input, Loading, Modal, PageHeader, Panel, Select, StatusBadge, Textarea } from '@/components/ui';
import { api, useApi } from '@/lib/api';

export default function Support() {
  const { data, error, mutate } = useApi<any[]>('/support');
  const [openId, setOpenId] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [f, setF] = useState({ subject: '', body: '', priority: 'normal' });
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const t = data?.find((x) => x.id === openId) || data?.[0];

  const create = async () => {
    setBusy(true);
    try {
      const r = await api.post('/support', f);
      toast(`Request #${r.number} sent. We usually answer within a few hours.`);
      setNewOpen(false);
      setF({ subject: '', body: '', priority: 'normal' });
      await mutate();
      setOpenId(r.id);
    } catch (e) {
      toast((e as Error).message, 'err');
    } finally {
      setBusy(false);
    }
  };
  const send = async () => {
    if (!t) return;
    setBusy(true);
    try {
      await api.post(`/support/${t.id}/reply`, { body: reply });
      setReply('');
      mutate();
    } finally {
      setBusy(false);
    }
  };

  if (error) return <ErrorState error={error} retry={() => mutate()} />;
  return (
    <div>
      <PageHeader title="Help and support" desc="Ask the Vellaire team anything. Replies arrive here and by email." actions={<Button variant="ink" icon="plus" onClick={() => setNewOpen(true)}>New request</Button>} />
      {!data ? (
        <Loading />
      ) : data.length === 0 ? (
        <Panel>
          <Empty icon="inbox" title="No requests yet" desc="Something not working, or a question about your plan? We are here." action={<Button variant="ink" onClick={() => setNewOpen(true)}>New request</Button>} />
        </Panel>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
          <Panel pad={false}>
            <ul className="p-2">
              {data.map((x) => (
                <li key={x.id}>
                  <button type="button" onClick={() => setOpenId(x.id)} className={cx('w-full rounded-md px-3 py-3 text-left', t?.id === x.id ? 'bg-gold-tint' : 'hover:bg-pearl')}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-[14px] font-medium">{x.subject}</span>
                      <StatusBadge status={x.status} />
                    </div>
                    <div className="text-[12px] text-stone-2">
                      #{x.number} · {x.when}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </Panel>
          {t && (
            <Panel>
              <h2 className="font-display text-[28px]">{t.subject}</h2>
              <div className="mt-5 flex flex-col gap-4">
                {t.messages.map((m: any, i: number) => (
                  <div key={i} className={cx('max-w-[85%] rounded-xl px-4 py-3 text-[14px]', m.kind === 'customer' ? 'self-end bg-ink text-cream' : m.kind === 'system' ? 'self-center bg-pearl text-[13px] text-stone' : 'bg-gold-tint')}>
                    <div className={cx('mb-1 text-[12px]', m.kind === 'customer' ? 'text-cream/70' : 'text-stone-2')}>
                      {m.author} · {m.when}
                    </div>
                    <div className="whitespace-pre-wrap">{m.body}</div>
                  </div>
                ))}
              </div>
              {t.status !== 'closed' && (
                <div className="mt-6 flex flex-col gap-2">
                  <Textarea aria-label="Reply" rows={3} value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Write a reply" />
                  <Button variant="ink" className="self-end" icon="send" disabled={!reply} loading={busy} onClick={send}>
                    Send
                  </Button>
                </div>
              )}
            </Panel>
          )}
        </div>
      )}
      <Modal
        open={newOpen}
        onClose={() => setNewOpen(false)}
        title="New request"
        footer={
          <>
            <Button onClick={() => setNewOpen(false)}>Cancel</Button>
            <Button variant="ink" loading={busy} disabled={f.subject.length < 3 || f.body.length < 3} onClick={create}>
              Send
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Field label="Subject">{(id) => <Input id={id} value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} />}</Field>
          <Field label="How urgent?">
            {(id) => (
              <Select id={id} value={f.priority} onChange={(e) => setF({ ...f, priority: e.target.value })}>
                <option value="low">Whenever you can</option>
                <option value="normal">Normal</option>
                <option value="high">Soon · it blocks our work</option>
                <option value="urgent">Urgent · cards are down</option>
              </Select>
            )}
          </Field>
          <Field label="Details">{(id) => <Textarea id={id} rows={5} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} />}</Field>
        </div>
      </Modal>
    </div>
  );
}
