'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useToast } from '@/components/toast';
import { Button, ErrorState, Field, Input, Loading, Modal, PageHeader, Panel, Select, Table, Td } from '@/components/ui';
import { api, isManager, useApi, useMe } from '@/lib/api';

export default function Departments() {
  const { data, error, mutate } = useApi<any[]>('/departments');
  const { data: templates } = useApi<any[]>('/templates');
  const { data: me } = useMe();
  const [edit, setEdit] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const canEdit = isManager(me?.user.role);

  const save = async () => {
    setBusy(true);
    try {
      await api.post('/departments', { name: edit.name, head: edit.head || undefined, templateId: edit.templateId || undefined });
      toast('Department saved');
      setEdit(null);
      mutate();
    } catch (e) {
      toast((e as Error).message, 'err');
    } finally {
      setBusy(false);
    }
  };

  if (error) return <ErrorState error={error} retry={() => mutate()} />;
  return (
    <div>
      <PageHeader
        eyebrow="People"
        title="Departments"
        desc="Each department can have its own card template. New joiners get it automatically."
        actions={canEdit && <Button variant="ink" icon="plus" onClick={() => setEdit({ name: '', head: '', templateId: '' })}>Add department</Button>}
      />
      <Panel pad={false}>
        {!data ? (
          <Loading />
        ) : (
          <Table head={['Department', 'Head', 'People', 'Live cards', 'Template', '']}>
            {data.map((d) => (
              <tr key={d.name} className="hover:bg-pearl">
                <Td className="font-medium">
                  <Link href={`/app/employees?department=${encodeURIComponent(d.name)}`} className="hover:text-gold-text">
                    {d.name}
                  </Link>
                </Td>
                <Td className="text-stone">{d.head || '—'}</Td>
                <Td className="tabular-nums">{d.people.toLocaleString()}</Td>
                <Td className="tabular-nums">{d.liveCards.toLocaleString()}</Td>
                <Td className="text-stone">{d.template?.name || 'Company default'}</Td>
                <Td className="text-right">
                  {canEdit && (
                    <Button size="sm" variant="ghost" onClick={() => setEdit({ name: d.name, head: d.head, templateId: d.template?.id || '', existing: true })}>
                      Edit
                    </Button>
                  )}
                </Td>
              </tr>
            ))}
          </Table>
        )}
      </Panel>
      <Modal
        open={!!edit}
        onClose={() => setEdit(null)}
        title={edit?.existing ? `Edit ${edit.name}` : 'Add department'}
        footer={
          <>
            <Button onClick={() => setEdit(null)}>Cancel</Button>
            <Button variant="ink" disabled={!edit?.name} loading={busy} onClick={save}>
              Save
            </Button>
          </>
        }
      >
        {edit && (
          <div className="flex flex-col gap-4">
            <Field label="Name">{(id) => <Input id={id} value={edit.name} disabled={edit.existing} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />}</Field>
            <Field label="Head of department">{(id) => <Input id={id} value={edit.head} onChange={(e) => setEdit({ ...edit, head: e.target.value })} />}</Field>
            <Field label="Card template">
              {(id) => (
                <Select id={id} value={edit.templateId} onChange={(e) => setEdit({ ...edit, templateId: e.target.value })}>
                  <option value="">Company default</option>
                  {templates?.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          </div>
        )}
      </Modal>
    </div>
  );
}
