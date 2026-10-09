'use client';

import { useState } from 'react';
import { useToast } from '@/components/toast';
import { Avatar, Badge, Button, ErrorState, Field, Input, Loading, Modal, PageHeader, Panel, Select, Table, Td } from '@/components/ui';
import { api, isAdmin, useApi, useMe } from '@/lib/api';

const ROLES: Record<string, { name: string; desc: string }> = {
  owner: { name: 'Owner', desc: 'Everything, including billing and ownership' },
  admin: { name: 'Admin', desc: 'People, cards, integrations, settings' },
  brand_manager: { name: 'Brand Manager', desc: 'Brand kit, templates, cards and approvals' },
  member: { name: 'Employee', desc: 'Their own card in the employee app' },
};

export default function Team() {
  const { data, error, mutate } = useApi<any>('/settings/team');
  const { data: me } = useMe();
  const [invite, setInvite] = useState(false);
  const [f, setF] = useState({ name: '', email: '', role: 'brand_manager' });
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const admin = isAdmin(me?.user.role);

  const send = async () => {
    setBusy(true);
    try {
      await api.post('/settings/team', f);
      toast(`Invitation sent to ${f.email}`);
      setInvite(false);
      setF({ name: '', email: '', role: 'brand_manager' });
      mutate();
    } catch (e) {
      toast((e as Error).message, 'err');
    } finally {
      setBusy(false);
    }
  };
  const changeRole = async (u: any, role: string) => {
    if (role === 'owner' && !confirm(`Make ${u.name} the owner? You become an Admin.`)) return mutate();
    try {
      await api.patch(`/settings/team/${u.id}`, { role });
      toast('Role updated');
      mutate();
    } catch (e) {
      toast((e as Error).message, 'err');
      mutate();
    }
  };
  const remove = async (u: any) => {
    if (!confirm(`Remove ${u.name}'s dashboard access?`)) return;
    try {
      await api.del(`/settings/team/${u.id}`);
      mutate();
    } catch (e) {
      toast((e as Error).message, 'err');
    }
  };

  if (error) return <ErrorState error={error} retry={() => mutate()} />;
  return (
    <div>
      <PageHeader
        eyebrow="Settings"
        title="Team and roles"
        desc="People who can use this dashboard. Employees with a card use the employee app and are not listed here."
        actions={admin && <Button variant="ink" icon="plus" onClick={() => setInvite(true)}>Invite</Button>}
      />
      <div className="mb-6 grid gap-3 md:grid-cols-4">
        {Object.entries(ROLES).map(([k, r]) => (
          <div key={k} className="rounded-xl border border-line bg-white p-4">
            <div className="text-[14px] font-medium">{r.name}</div>
            <div className="text-[13px] text-stone-2">{r.desc}</div>
          </div>
        ))}
      </div>
      <Panel pad={false}>
        {!data ? (
          <Loading />
        ) : (
          <Table head={['Person', 'Role', 'Status', 'Last sign-in', '']}>
            {data.users.map((u: any) => (
              <tr key={u.id} className="hover:bg-pearl">
                <Td>
                  <div className="flex items-center gap-3">
                    <Avatar name={u.name} size={34} />
                    <span>
                      <span className="block font-medium">
                        {u.name} {u.me && <span className="text-[12px] text-stone-2">(you)</span>}
                      </span>
                      <span className="block text-[13px] text-stone-2">{u.email}</span>
                    </span>
                  </div>
                </Td>
                <Td>
                  {admin && !u.me && (u.role !== 'owner' || me?.user.role === 'owner') ? (
                    <Select aria-label={`Role for ${u.name}`} value={u.role} onChange={(e) => changeRole(u, e.target.value)} className="w-44">
                      {me?.user.role === 'owner' && <option value="owner">Owner</option>}
                      <option value="admin">Admin</option>
                      <option value="brand_manager">Brand Manager</option>
                    </Select>
                  ) : (
                    ROLES[u.role]?.name
                  )}
                </Td>
                <Td>{u.status === 'invited' ? <Badge tone="warn">Invited</Badge> : u.status === 'disabled' ? <Badge>Disabled</Badge> : <Badge tone="ok">Active</Badge>}</Td>
                <Td className="text-stone">{u.lastLogin}</Td>
                <Td className="text-right">
                  {admin && !u.me && u.role !== 'owner' && (
                    <Button size="sm" variant="ghost" onClick={() => remove(u)}>
                      Remove
                    </Button>
                  )}
                </Td>
              </tr>
            ))}
          </Table>
        )}
      </Panel>
      {data && <p className="mt-3 text-[13px] text-stone-2">{data.members.toLocaleString()} employees can sign in to the employee app with their work email.</p>}

      <Modal
        open={invite}
        onClose={() => setInvite(false)}
        title="Invite to the dashboard"
        footer={
          <>
            <Button onClick={() => setInvite(false)}>Cancel</Button>
            <Button variant="ink" loading={busy} disabled={!f.name || !f.email} onClick={send}>
              Send invitation
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Field label="Name">{(id) => <Input id={id} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />}</Field>
          <Field label="Work email">{(id) => <Input id={id} type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />}</Field>
          <Field label="Role">
            {(id) => (
              <Select id={id} value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}>
                <option value="admin">Admin</option>
                <option value="brand_manager">Brand Manager</option>
              </Select>
            )}
          </Field>
        </div>
      </Modal>
    </div>
  );
}
