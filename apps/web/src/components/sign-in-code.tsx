'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { Button, Input } from './ui';

/**
 * The 6-digit code from the sign-in email. On an iPhone the installed app and Safari keep separate
 * sign-ins, so the email link would sign in Safari, not the app; typing the code signs in right here.
 */
export function SignInCode({ email }: { email: string }) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const r = await api.post<{ redirect: string }>('/auth/verify-code', { email, code });
      const next = new URLSearchParams(window.location.search).get('next');
      window.location.href = next?.startsWith('/') ? next : r.redirect;
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2">
      <label htmlFor="signin-code" className="text-[13px] font-medium text-[#3A3A42]">
        Or type the 6-digit code from the email
      </label>
      <div className="flex gap-2">
        <Input
          id="signin-code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={7}
          placeholder="123 456"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          className="h-12 flex-1 font-mono text-[18px] tracking-[0.3em]"
        />
        <Button type="submit" variant="ink" size="lg" loading={busy} disabled={code.length !== 6} className="h-12">
          Sign in
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-[14px] text-err">
          {error}
        </p>
      )}
    </form>
  );
}
