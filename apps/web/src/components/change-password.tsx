'use client';

import { useState } from 'react';
import { api, useApi } from '@/lib/api';
import { PasswordField, passwordOk } from './password-field';
import { useToast } from './toast';
import { Button, Input, Modal } from './ui';

/** Set a first password, or change it (needs the current one). Shared by the dashboard, console and app. */
export function ChangePassword({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data, mutate } = useApi<{ hasPassword: boolean }>(open ? '/auth/password' : null);
  const [current, setCurrent] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const toast = useToast();
  if (!open) return null;
  const has = !!data?.hasPassword;

  const close = () => {
    setCurrent('');
    setPassword('');
    setError('');
    onClose();
  };
  const save = async () => {
    setBusy(true);
    setError('');
    try {
      await api.post('/auth/change-password', { current: has ? current : undefined, password });
      await mutate();
      toast(has ? 'Password changed' : 'Password set. Use it with your email to sign in.');
      close();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={close}
      title={has ? 'Change password' : 'Set a password'}
      footer={
        <>
          <Button onClick={close}>Cancel</Button>
          <Button variant="ink" loading={busy} disabled={!data || !passwordOk(password) || (has && !current)} onClick={save}>
            Save password
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {!has && data && <p className="text-[14px] text-stone">You sign in with email links today. Add a password to sign in with your email and password too.</p>}
        {has && (
          <div className="flex flex-col gap-2">
            <label htmlFor="cp-current" className="text-[13px] font-medium text-[#3A3A42]">
              Current password
            </label>
            <Input id="cp-current" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} className="h-12" />
          </div>
        )}
        <PasswordField id="cp-new" label="New password" value={password} onChange={setPassword} />
        {error && (
          <p role="alert" className="text-[14px] text-err">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}
