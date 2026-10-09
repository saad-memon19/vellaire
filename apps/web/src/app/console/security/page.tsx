'use client';

import { useState } from 'react';
import { Icon } from '@/components/icons';
import { Button, cx, ErrorState, Field, Input, LinkButton, Loading, Modal, PageHeader, Select } from '@/components/ui';
import { api, qs, useApi } from '@/lib/api';
import { EmptyRow, GridRow, GridTable, Kpis, RowButton, Section, useAction } from '../parts';

const LOG_COLS = '1fr 1.3fr 2.6fr 1.5fr 1fr';
const KINDS = [
  { id: 'export_person', name: 'Export all data for one person' },
  { id: 'delete_person', name: 'Delete one person’s data' },
  { id: 'delete_company', name: 'Delete a company workspace' },
];

export default function Security() {
  const [q, setQ] = useState('');
  const { data, error, mutate } = useApi<any>(`/console/security${qs({ q })}`);
  const { busy, run } = useAction(mutate);
  const [newRequest, setNewRequest] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<any>(null);

  const reject = (r: any) =>
    confirm(`Reject this request? ${r.company} should be told why.`) &&
    run(r.id, () => api.post(`/console/data-requests/${r.id}/resolve`, { decision: 'reject' }), 'Request rejected');
  const approve = (r: any) =>
    r.kind === 'delete_company'
      ? setConfirmDelete(r)
      : confirm(`Delete this person's details everywhere? Their card turns off and this cannot be undone.`) &&
        run(r.id, () => api.post(`/console/data-requests/${r.id}/resolve`, { decision: 'approve' }), 'Personal data deleted');

  if (error) return <ErrorState error={error} retry={() => mutate()} />;
  return (
    <div className="flex flex-col gap-5.5 [&>header]:mb-0">
      <PageHeader
        eyebrow="Platform"
        title="Security and audit"
        desc="Every sensitive action by your team, impersonation sessions and data requests."
        actions={
          <>
            <LinkButton href={`/api/console/security/export${qs({ q })}`} icon="dDownload">
              Export evidence
            </LinkButton>
            <Button
              variant="ink"
              loading={busy === 'review'}
              onClick={() =>
                confirm('Confirm every staff account still needs console access?') && run('review', () => api.post('/console/security/access-review'), 'Access review recorded')
              }
            >
              Complete access review
            </Button>
          </>
        }
      />
      {!data ? (
        <Loading />
      ) : (
        <>
          <Kpis items={data.kpis} />
          <Section
            title="Data requests with deadlines"
            sub="GDPR and local privacy laws: answer within one month"
            action={
              <Button size="sm" onClick={() => setNewRequest(true)}>
                Log a request
              </Button>
            }
          >
            {data.requests.length === 0 && <EmptyRow>No open requests</EmptyRow>}
            {data.requests.map((r: any) => (
              <div key={r.id} className="flex flex-wrap items-center gap-3.5 border-t border-[#F0EBE2] px-5 py-3">
                <span className="flex min-w-0 flex-[1_1_260px] flex-col gap-0.5">
                  <span className="font-semibold">{r.title}</span>
                  <span className="text-[12.5px] text-stone-2">{r.company}</span>
                </span>
                <span className={cx('text-[13px] font-semibold', r.urgent ? 'text-err' : 'text-[#4E4A44]')}>{r.due}</span>
                <RowButton className="h-8.5" disabled={busy === r.id} onClick={() => reject(r)}>
                  Reject
                </RowButton>
                {r.kind === 'export_person' ? (
                  <a
                    href={`/api/console/data-requests/${r.id}/export`}
                    onClick={() => setTimeout(() => mutate(), 1500)}
                    className="flex h-8.5 items-center rounded-lg bg-ink px-3 text-[12.5px] font-medium text-white hover:bg-[#2E2E35]"
                  >
                    Download export
                  </a>
                ) : (
                  <button
                    type="button"
                    disabled={busy === r.id}
                    onClick={() => approve(r)}
                    className="h-8.5 rounded-lg bg-err px-3 text-[12.5px] font-medium text-white hover:opacity-90 disabled:opacity-50"
                  >
                    {r.kind === 'delete_company' ? 'Delete workspace' : 'Approve deletion'}
                  </button>
                )}
              </div>
            ))}
          </Section>
          <Section
            title="Audit log"
            action={
              <label className="flex h-9 items-center gap-2 rounded-lg border border-linen bg-pearl px-2.5 text-stone-2">
                <Icon name="dSearch" size={16} />
                <input
                  type="search"
                  aria-label="Search actions"
                  placeholder="Search actions"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  className="w-45 bg-transparent text-[13.5px] text-ink outline-none"
                />
              </label>
            }
          >
            <GridTable cols={LOG_COLS} minWidth={900} head={['When', 'Who', 'Action', 'Target', 'From']}>
              {data.log.length === 0 && <EmptyRow>No actions match</EmptyRow>}
              {data.log.map((l: any) => (
                <GridRow key={l.id} cols={LOG_COLS}>
                  <span className="text-[13px] text-stone-2">{l.when}</span>
                  <span className="font-medium">{l.who}</span>
                  <span>{l.action}</span>
                  <span className="text-[#4E4A44]">{l.target}</span>
                  <span className="font-mono text-[12px] text-stone-2">{l.ip}</span>
                </GridRow>
              ))}
            </GridTable>
          </Section>
        </>
      )}
      {newRequest && data && <RequestModal companies={data.companies} onClose={() => setNewRequest(false)} onSaved={mutate} />}
      {confirmDelete && <DeleteWorkspace request={confirmDelete} onClose={() => setConfirmDelete(null)} onSaved={mutate} />}
    </div>
  );
}

function RequestModal({ companies, onClose, onSaved }: { companies: any[]; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ companyId: '', kind: KINDS[0]!.id, subjectEmail: '' });
  const { busy, run } = useAction(onSaved);
  const forPerson = f.kind !== 'delete_company';
  const save = () =>
    run('save', () => api.post('/console/data-requests', { ...f, subjectEmail: forPerson ? f.subjectEmail : undefined }), 'Request logged · due in 30 days').then(
      (r) => r && onClose(),
    );
  return (
    <Modal
      open
      onClose={onClose}
      title="Log a data request"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="ink" loading={busy === 'save'} disabled={!f.companyId || (forPerson && !f.subjectEmail.includes('@'))} onClick={save}>
            Log request
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Request">
          {(id) => (
            <Select id={id} value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}>
              {KINDS.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Company">
          {(id) => (
            <Select id={id} value={f.companyId} onChange={(e) => setF({ ...f, companyId: e.target.value })}>
              <option value="">Choose a company</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
        {forPerson && (
          <Field label="Person's work email">{(id) => <Input id={id} type="email" value={f.subjectEmail} onChange={(e) => setF({ ...f, subjectEmail: e.target.value })} />}</Field>
        )}
      </div>
    </Modal>
  );
}

function DeleteWorkspace({ request, onClose, onSaved }: { request: any; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState('');
  const { busy, run } = useAction(onSaved);
  const del = () =>
    run('delete', () => api.post(`/console/data-requests/${request.id}/resolve`, { decision: 'approve', confirmName: name }), `${request.company} deleted`).then(
      (r) => r && onClose(),
    );
  return (
    <Modal
      open
      onClose={onClose}
      title="Delete company workspace"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <button
            type="button"
            disabled={name !== request.company || busy === 'delete'}
            onClick={del}
            className="h-11 rounded-lg bg-err px-4 text-[14px] font-semibold text-white disabled:opacity-40"
          >
            Delete everything
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-[14px] leading-relaxed text-stone">
          Every card, employee, lead, NFC order, integration and ticket of <strong className="text-ink">{request.company}</strong> is deleted for good. Invoices and your team's
          audit trail are kept, as the law requires.
        </p>
        <Field label={`Type ${request.company} to confirm`}>{(id) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" />}</Field>
      </div>
    </Modal>
  );
}
