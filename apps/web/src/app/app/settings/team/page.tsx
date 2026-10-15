'use client';

import { useState } from 'react';
import { usePasswordLink } from '@/components/password-link';
import { useToast } from '@/components/toast';
import { Button, ErrorState, Field, Input, Loading, Modal, Select } from '@/components/ui';
import { api, isAdmin, useApi, useMe } from '@/lib/api';

interface TeamUser {
  id: string;
  ini: string;
  name: string;
  email: string;
  role: string;
  rawRole: string;
  scope: string;
  last: string;
  me: boolean;
}

interface TeamData {
  members: number;
  users: TeamUser[];
}

const ROLE_COLORS: Record<string, { bg: string; fg: string }> = {
  Owner: { bg: '#17171B', fg: '#E6D3A3' },
  Admin: { bg: '#F6EFE1', fg: '#876A33' },
  'Brand Manager': { bg: '#E6ECF6', fg: '#2F4A7A' },
  'HR Manager': { bg: '#E5F2EB', fg: '#1F7A55' },
  'Department Manager': { bg: '#EFEBE3', fg: '#4E4A44' },
};

const ROLE_RAW_TO_DISPLAY: Record<string, string> = {
  owner: 'Owner',
  admin: 'Admin',
  brand_manager: 'Brand Manager',
  hr_manager: 'HR Manager',
  dept_manager: 'Department Manager',
};

const ROLE_DISPLAY_TO_RAW: Record<string, string> = {
  Owner: 'owner',
  Admin: 'admin',
  'Brand Manager': 'brand_manager',
  'HR Manager': 'hr_manager',
  'Department Manager': 'dept_manager',
};

const Y = { t: '✓', c: '#1F7A55' };
const N = { t: '—', c: '#C9BFAD' };
const T = { t: 'Team', c: '#876A33' };

const PERMISSIONS = [
  { name: 'Create and edit cards', vals: [Y, Y, Y, T] },
  { name: 'Approve changes', vals: [Y, Y, Y, T] },
  { name: 'Edit brand kit', vals: [Y, Y, Y, N] },
  { name: 'Connect HR systems', vals: [Y, Y, N, N] },
  { name: 'Order NFC cards', vals: [Y, Y, N, T] },
  { name: 'See leads', vals: [Y, Y, N, T] },
  { name: 'Manage admins', vals: [Y, Y, N, N] },
  { name: 'Billing', vals: [Y, N, N, N] },
];

export default function Team() {
  const { data, error, mutate } = useApi<TeamData>('/settings/team');
  const { data: me } = useMe();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editUser, setEditUser] = useState<TeamUser | null>(null);
  const [inviteForm, setInviteForm] = useState({ name: '', email: '', role: 'admin', scope: 'Whole company' });
  const [editForm, setEditForm] = useState({ role: 'admin', scope: 'Whole company' });
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const passwordLink = usePasswordLink();
  const admin = isAdmin(me?.user.role);

  const handleInvite = async () => {
    setBusy(true);
    try {
      await api.post('/settings/team', inviteForm);
      toast(`Invitation sent to ${inviteForm.email}`, 'ok');
      setInviteOpen(false);
      setInviteForm({ name: '', email: '', role: 'admin', scope: 'Whole company' });
      await mutate();
    } catch (e: any) {
      toast(e.message || 'Failed to send invite', 'err');
    } finally {
      setBusy(false);
    }
  };

  const openEdit = (u: TeamUser) => {
    const rawRole = u.rawRole || ROLE_DISPLAY_TO_RAW[u.role] || 'admin';
    setEditForm({ role: rawRole, scope: u.scope || 'Whole company' });
    setEditUser(u);
  };

  const handleSaveEdit = async () => {
    if (!editUser) return;
    setBusy(true);
    try {
      if (editForm.role === 'owner' && !confirm(`Make ${editUser.name} the owner? You will become an Admin.`)) {
        setBusy(false);
        return;
      }
      await api.patch(`/settings/team/${editUser.id}`, { role: editForm.role, scope: editForm.scope });
      toast('Team member updated', 'ok');
      setEditUser(null);
      await mutate();
    } catch (e: any) {
      toast(e.message || 'Failed to update', 'err');
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async () => {
    if (!editUser) return;
    if (!confirm(`Remove ${editUser.name}'s dashboard access?`)) return;
    setBusy(true);
    try {
      await api.del(`/settings/team/${editUser.id}`);
      toast('Access removed', 'ok');
      setEditUser(null);
      await mutate();
    } catch (e: any) {
      toast(e.message || 'Failed to remove', 'err');
    } finally {
      setBusy(false);
    }
  };

  if (error) return <ErrorState error={error} retry={() => mutate()} />;
  if (!data) return <Loading />;

  const admins = data.users || [];

  return (
    <div className="flex w-full max-w-[1320px] flex-col gap-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div className="flex flex-col gap-1.5">
          <div className="text-[12px] font-medium tracking-[0.2em] text-[#876A33]">SETTINGS</div>
          <h1 className="m-0 font-display text-[46px] font-normal leading-[1.05] text-[#17171B]">Team and roles</h1>
          <p className="m-0 text-[15px] text-[#5E5952]">
            Who can manage cards, brand and integrations. Employees do not need a seat here.
          </p>
        </div>
        {admin && (
          <button
            type="button"
            onClick={() => setInviteOpen(true)}
            className="h-11 cursor-pointer rounded-lg bg-[#17171B] px-5 text-[14px] font-semibold text-white hover:bg-[#2E2E35]"
          >
            Invite an admin
          </button>
        )}
      </div>

      {/* Side-by-side layout */}
      <div className="flex flex-wrap items-start gap-5">
        {/* Left: People table */}
        <section className="min-w-0 flex-[3_1_560px] overflow-hidden rounded-[14px] border border-[#E6E0D5] bg-white">
          <div className="overflow-x-auto">
            <div className="min-w-[640px]">
              <div
                className="bg-[#FAF8F3] px-5 py-2.5 text-[11px] font-medium tracking-[0.14em] text-[#6E685F]"
                style={{ display: 'grid', gridTemplateColumns: '2.2fr 1.4fr 1.3fr 1fr 90px', gap: '14px' }}
              >
                <span>PERSON</span>
                <span>ROLE</span>
                <span>SCOPE</span>
                <span>LAST ACTIVE</span>
                <span></span>
              </div>
              {admins.map((a) => {
                const colors = ROLE_COLORS[a.role] || ROLE_COLORS[ROLE_RAW_TO_DISPLAY[a.role]] || { bg: '#EFEBE3', fg: '#4E4A44' };
                return (
                  <div
                    key={a.id}
                    className="items-center border-t border-[#F0EBE2] px-5 py-[13px] transition-colors hover:bg-[#FAF7F1]"
                    style={{ display: 'grid', gridTemplateColumns: '2.2fr 1.4fr 1.3fr 1fr 90px', gap: '14px' }}
                  >
                    <span className="flex items-center gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#F2EEE6] font-display text-[15px] font-semibold text-[#876A33]">
                        {a.ini}
                      </span>
                      <span className="flex flex-col">
                        <span className="font-semibold text-[#17171B]">{a.name}</span>
                        <span className="text-[12.5px] text-[#6E685F]">{a.email}</span>
                      </span>
                    </span>
                    <span>
                      <span
                        className="inline-block rounded-full px-2.5 py-1 text-[12.5px] font-medium"
                        style={{ backgroundColor: colors.bg, color: colors.fg }}
                      >
                        {a.role}
                      </span>
                    </span>
                    <span className="text-[13.5px] text-[#2A2A30]">{a.scope}</span>
                    <span className="text-[13px] text-[#6E685F]">{a.last}</span>
                    <button
                      type="button"
                      onClick={() => openEdit(a)}
                      className="h-8 justify-self-end rounded-lg border border-[#E0D9CC] bg-white px-3 text-[12.5px] text-[#17171B] hover:border-ink cursor-pointer"
                    >
                      Edit
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Right: What each role can do */}
        <section className="min-w-0 flex-[2_1_360px] overflow-hidden rounded-[14px] border border-[#E6E0D5] bg-white">
          <div className="flex flex-col gap-0.5 px-[22px] py-5">
            <h2 className="m-0 text-[16px] font-semibold text-[#17171B]">What each role can do</h2>
            <span className="text-[13px] text-[#6E685F]">Department managers only see their own team</span>
          </div>
          <div className="overflow-x-auto">
            <div className="min-w-[380px]">
              <div
                className="bg-[#FAF8F3] px-[22px] py-2.5 text-center text-[10.5px] font-medium tracking-[0.1em] text-[#6E685F]"
                style={{ display: 'grid', gridTemplateColumns: '1.8fr repeat(4, 1fr)', gap: '6px' }}
              >
                <span className="text-left">PERMISSION</span>
                <span>OWNER</span>
                <span>ADMIN</span>
                <span>BRAND</span>
                <span>MANAGER</span>
              </div>
              {PERMISSIONS.map((p, idx) => (
                <div
                  key={idx}
                  className="items-center border-t border-[#F0EBE2] px-[22px] py-[11px] text-center text-[13.5px]"
                  style={{ display: 'grid', gridTemplateColumns: '1.8fr repeat(4, 1fr)', gap: '6px' }}
                >
                  <span className="text-left text-[#17171B]">{p.name}</span>
                  {p.vals.map((v, vIdx) => (
                    <span key={vIdx} className="font-semibold" style={{ color: v.c }}>
                      {v.t}
                    </span>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>

      {/* Invite Modal */}
      <Modal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        title="Invite an admin"
        footer={
          <>
            <Button onClick={() => setInviteOpen(false)}>Cancel</Button>
            <Button variant="ink" loading={busy} disabled={!inviteForm.name || !inviteForm.email} onClick={handleInvite}>
              Send invitation
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Field label="Name">
            {(id) => <Input id={id} value={inviteForm.name} onChange={(e) => setInviteForm({ ...inviteForm, name: e.target.value })} placeholder="Full name" />}
          </Field>
          <Field label="Work email">
            {(id) => <Input id={id} type="email" value={inviteForm.email} onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })} placeholder="name@company.com" />}
          </Field>
          <Field label="Role">
            {(id) => (
              <Select id={id} value={inviteForm.role} onChange={(e) => setInviteForm({ ...inviteForm, role: e.target.value })}>
                <option value="admin">Admin</option>
                <option value="brand_manager">Brand Manager</option>
                <option value="hr_manager">HR Manager</option>
                <option value="dept_manager">Department Manager</option>
              </Select>
            )}
          </Field>
          <Field label="Scope" hint="e.g. Whole company, or a specific department">
            {(id) => <Input id={id} value={inviteForm.scope} onChange={(e) => setInviteForm({ ...inviteForm, scope: e.target.value })} placeholder="Whole company" />}
          </Field>
        </div>
      </Modal>

      {/* Edit Modal */}
      <Modal
        open={!!editUser}
        onClose={() => setEditUser(null)}
        title={editUser ? `Edit ${editUser.name}` : 'Edit member'}
        footer={
          <div className="flex w-full items-center justify-between">
            {editUser && !editUser.me && editUser.role !== 'Owner' ? (
              <Button variant="ghost" className="text-red-600 hover:text-red-700" onClick={handleRemove}>
                Remove access
              </Button>
            ) : <div />}
            <div className="flex gap-2">
              <Button onClick={() => setEditUser(null)}>Cancel</Button>
              <Button variant="ink" loading={busy} onClick={handleSaveEdit}>
                Save changes
              </Button>
            </div>
          </div>
        }
      >
        {editUser && (
          <div className="flex flex-col gap-4">
            <div>
              <div className="text-[14px] font-semibold text-[#17171B]">{editUser.name}</div>
              <div className="text-[13px] text-[#6E685F]">{editUser.email}</div>
              {!editUser.me && (
                <button type="button" onClick={() => passwordLink.make(`/auth/reset-link/${editUser.id}`, editUser.name)} className="mt-2 text-[13px] text-gold-text underline underline-offset-4">
                  Make a password link
                </button>
              )}
            </div>
            <Field label="Role">
              {(id) => (
                <Select id={id} value={editForm.role} onChange={(e) => setEditForm({ ...editForm, role: e.target.value })} disabled={editUser.role === 'Owner' && me?.user.role !== 'owner'}>
                  {me?.user.role === 'owner' && <option value="owner">Owner</option>}
                  <option value="admin">Admin</option>
                  <option value="brand_manager">Brand Manager</option>
                  <option value="hr_manager">HR Manager</option>
                  <option value="dept_manager">Department Manager</option>
                </Select>
              )}
            </Field>
            <Field label="Scope">
              {(id) => <Input id={id} value={editForm.scope} onChange={(e) => setEditForm({ ...editForm, scope: e.target.value })} placeholder="Whole company" />}
            </Field>
          </div>
        )}
      </Modal>
      {passwordLink.modal}
    </div>
  );
}
