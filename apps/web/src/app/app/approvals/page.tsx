'use client';

import Link from 'next/link';
import { useState } from 'react';
import { mutate as globalMutate } from 'swr';
import { CardFace } from '@/components/card/card-face';
import { Icon } from '@/components/icons';
import { useToast } from '@/components/toast';
import { Avatar, Badge, Button, Empty, ErrorState, Loading, Modal, PageHeader, Panel, PanelHeader, Textarea, Toggle } from '@/components/ui';
import { api, isAdmin, useApi, useMe } from '@/lib/api';

export default function Approvals() {
  const { data, error, mutate } = useApi<any>('/approvals');
  const { data: settings, mutate: reSettings } = useApi<any>('/settings');
  const { data: me } = useMe();
  const [busy, setBusy] = useState<string | null>(null);
  const [reject, setReject] = useState<any>(null);
  const [note, setNote] = useState('');
  const toast = useToast();

  const refresh = () => {
    mutate();
    globalMutate('/auth/me');
  };
  const approve = async (c: any) => {
    setBusy(c.id);
    try {
      await api.post(`/approvals/${c.id}/approve`);
      toast(c.pendingPhoto ? 'Photo approved' : `${c.fields.name}'s card approved`);
      refresh();
    } catch (e) {
      toast((e as Error).message, 'err');
    } finally {
      setBusy(null);
    }
  };
  const doReject = async () => {
    setBusy(reject.id);
    try {
      await api.post(`/approvals/${reject.id}/reject`, { note });
      toast('Sent back');
      setReject(null);
      setNote('');
      refresh();
    } catch (e) {
      toast((e as Error).message, 'err');
    } finally {
      setBusy(null);
    }
  };
  const setPolicy = async (k: string, v: boolean) => {
    await api.patch('/settings/company', { [k]: v });
    reSettings();
    toast('Policy updated');
  };

  if (error) return <ErrorState error={error} retry={() => mutate()} />;
  return (
    <div>
      <PageHeader eyebrow="People" title="Approvals" desc="Cards and photo changes that wait for a Brand Manager before they go live." />
      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <div className="flex flex-col gap-4">
          {!data ? (
            <Loading />
          ) : data.pending.length === 0 ? (
            <Panel>
              <Empty icon="checkCircle" title="Nothing to approve" desc="New cards and photo changes that need review will appear here." />
            </Panel>
          ) : (
            data.pending.map((c: any) => (
              <Panel key={c.id} className="grid gap-5 md:grid-cols-[260px_1fr]">
                {c.pendingPhoto ? (
                  <div className="flex items-center justify-center gap-4 rounded-lg bg-pearl p-4">
                    <div className="text-center">
                      <Avatar name={c.fields.name} src={c.fields.photoUrl} size={72} />
                      <div className="mt-1 text-[12px] text-stone-2">Now</div>
                    </div>
                    <Icon name="arrow" className="text-stone-2" />
                    <div className="text-center">
                      <Avatar name={c.fields.name} src={c.pendingPhoto} size={72} />
                      <div className="mt-1 text-[12px] text-stone-2">New</div>
                    </div>
                  </div>
                ) : (
                  <CardFace layout={c.layout} theme={c.theme} fields={c.fields} translations={c.translations} brand={c.brand} width="100%" />
                )}
                <div className="flex flex-col gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/app/cards/${c.id}`} className="text-[17px] font-medium hover:text-gold-text">
                      {c.fields.name}
                    </Link>
                    <Badge tone="warn">{c.pendingPhoto ? 'Photo change' : 'New card'}</Badge>
                  </div>
                  <div className="text-[14px] text-stone">{[c.fields.title, c.fields.department, c.fields.office].filter(Boolean).join(' · ')}</div>
                  <div className="text-[13px] text-stone-2">
                    {c.reason} · requested by {c.requestedBy} · {c.when}
                    {c.publishAt && ` · goes live ${new Date(c.publishAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} once approved`}
                  </div>
                  <div className="mt-auto flex flex-wrap gap-2">
                    <Button variant="ink" icon="check" loading={busy === c.id} onClick={() => approve(c)}>
                      Approve
                    </Button>
                    <Button onClick={() => setReject(c)}>Send back</Button>
                  </div>
                </div>
              </Panel>
            ))
          )}
        </div>
        <div className="flex flex-col gap-6">
          {settings && isAdmin(me?.user.role) && (
            <Panel>
              <PanelHeader title="Approval policy" />
              <label className="flex items-center justify-between gap-3 py-2 text-[14px]">
                <span>
                  Cards created by non-managers
                  <span className="block text-[12px] text-stone-2">Need approval before going live</span>
                </span>
                <Toggle checked={settings.settings.approvalRequired} onChange={(v) => setPolicy('approvalRequired', v)} label="Approve new cards" />
              </label>
              <label className="flex items-center justify-between gap-3 py-2 text-[14px]">
                <span>
                  Employee photo changes
                  <span className="block text-[12px] text-stone-2">Card stays live with the old photo meanwhile</span>
                </span>
                <Toggle checked={settings.settings.photoApproval} onChange={(v) => setPolicy('photoApproval', v)} label="Approve photos" />
              </label>
              <p className="mt-2 text-[12px] text-stone-2">New joiners from HR follow the rule in HR integrations → Rules.</p>
            </Panel>
          )}
          <Panel>
            <PanelHeader title="Recent decisions" />
            {!data?.recent.length ? (
              <p className="text-[14px] text-stone-2">None yet</p>
            ) : (
              <ul className="flex flex-col divide-y divide-linen">
                {data.recent.map((r: any) => (
                  <li key={r.id} className="py-2.5 text-[13px]">
                    {r.text}
                    <div className="text-stone-2">{r.when}</div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
      <Modal
        open={!!reject}
        onClose={() => setReject(null)}
        title="Send back"
        footer={
          <>
            <Button onClick={() => setReject(null)}>Cancel</Button>
            <Button variant="ink" loading={busy === reject?.id} onClick={doReject}>
              Send back
            </Button>
          </>
        }
      >
        <Textarea aria-label="Note" rows={3} placeholder="What should change? (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
      </Modal>
    </div>
  );
}
