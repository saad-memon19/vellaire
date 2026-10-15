'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { AuthLayout } from '@/components/auth-layout';
import { Icon } from '@/components/icons';
import { PasswordField, passwordOk } from '@/components/password-field';
import { Button, Input } from '@/components/ui';
import { api } from '@/lib/api';

/** Opened from a reset email, or from a password link an admin shared. Sets the password and signs in. */
export default function ResetPasswordPage() {
  return (
    <AuthLayout cardText="Welcome back" quote="Your identity, impeccably shared.">
      <div className="w-full max-w-100">
        <Suspense>
          <ResetForm />
        </Suspense>
      </div>
    </AuthLayout>
  );
}

function ResetForm() {
  const token = useSearchParams().get('token') || '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) return setError('The two passwords do not match.');
    setBusy(true);
    setError('');
    try {
      const r = await api.post<{ redirect: string }>('/auth/reset', { token, password });
      window.location.href = r.redirect;
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  if (!token)
    return (
      <div className="flex flex-col gap-4">
        <h1 className="font-display text-[44px] font-normal leading-[1.05]">Link not complete</h1>
        <p className="text-[15px] text-stone">Open the full link from your email, or ask for a new one.</p>
        <Link href="/forgot-password" className="self-start text-[14px] text-gold-text underline underline-offset-4">
          Get a new link
        </Link>
      </div>
    );

  return (
    <form onSubmit={submit} className="flex flex-col gap-6">
      <div className="flex flex-col gap-2.5">
        <h1 className="font-display text-[44px] font-normal leading-[1.05]">Choose a password</h1>
        <p className="text-[15px] text-stone">You will use it with your work email to sign in, on the web and in the app.</p>
      </div>
      <PasswordField id="new-password" label="New password" value={password} onChange={setPassword} />
      <div className="flex flex-col gap-2">
        <label htmlFor="confirm-password" className="text-[13px] font-medium text-[#3A3A42]">
          Type it again
        </label>
        <Input id="confirm-password" type="password" required autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className="h-12" />
      </div>
      {error && (
        <p role="alert" className="-mt-2 text-[14px] text-err">
          {error}
        </p>
      )}
      <Button type="submit" variant="ink" size="lg" loading={busy} disabled={!passwordOk(password) || !confirm} className="h-12.5">
        Save and sign in <Icon name="arrow" size={18} className="text-gold-soft" />
      </Button>
    </form>
  );
}
