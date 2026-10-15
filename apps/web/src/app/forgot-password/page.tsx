'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { AuthLayout } from '@/components/auth-layout';
import { Icon } from '@/components/icons';
import { Button, Input } from '@/components/ui';
import { api } from '@/lib/api';

export default function ForgotPasswordPage() {
  return (
    <AuthLayout cardText="Welcome back" quote="Your identity, impeccably shared.">
      <div className="w-full max-w-100">
        <Suspense>
          <ForgotForm />
        </Suspense>
      </div>
    </AuthLayout>
  );
}

function ForgotForm() {
  const params = useSearchParams();
  const [email, setEmail] = useState(params.get('email') || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ sent: boolean; message: string; devLink?: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      setResult(await api.post('/auth/forgot', { email }));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const back = (
    <Link href="/signin" className="self-start text-[14px] text-gold-text underline underline-offset-4">
      Back to sign in
    </Link>
  );

  if (result)
    return (
      <div className="vl-fade flex flex-col gap-6">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-gold-tint text-gold-text">
          <Icon name={result.sent ? 'mail' : 'info'} size={22} />
        </span>
        <div>
          <h1 className="font-display text-[44px] font-normal leading-[1.05]">{result.sent ? 'Check your email' : 'Ask your admin'}</h1>
          <p className="mt-2 text-[15px] text-stone">{result.message}</p>
        </div>
        {result.devLink && (
          <div className="rounded-lg border border-dashed border-gold-line bg-gold-tint p-4 text-[14px]">
            <div className="mb-2 font-medium text-gold-text">Development mode</div>
            <p className="mb-3 text-stone">No email service is connected, so here is your reset link.</p>
            <a href={result.devLink} className="inline-flex h-11 items-center gap-2 rounded-md bg-ink px-4 text-cream">
              Choose a new password <Icon name="arrow" size={17} className="text-gold-soft" />
            </a>
          </div>
        )}
        {back}
      </div>
    );

  return (
    <form onSubmit={submit} className="flex flex-col gap-6">
      <div className="flex flex-col gap-2.5">
        <h1 className="font-display text-[44px] font-normal leading-[1.05]">Forgot password</h1>
        <p className="text-[15px] text-stone">Type your work email and we will send you a link to choose a new password.</p>
      </div>
      <div className="flex flex-col gap-2">
        <label htmlFor="email" className="text-[13px] font-medium text-[#3A3A42]">
          Work email
        </label>
        <Input id="email" type="email" required autoComplete="email" placeholder="name@company.com" value={email} onChange={(e) => setEmail(e.target.value)} className="h-12" />
      </div>
      {error && (
        <p role="alert" className="-mt-2 text-[14px] text-err">
          {error}
        </p>
      )}
      <Button type="submit" variant="ink" size="lg" loading={busy} className="h-12.5">
        Send reset link <Icon name="arrow" size={18} className="text-gold-soft" />
      </Button>
      {back}
    </form>
  );
}
