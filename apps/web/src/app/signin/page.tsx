'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { AuthLayout, LinkSent } from '@/components/auth-layout';
import { Icon } from '@/components/icons';
import { Button, Input } from '@/components/ui';
import { api } from '@/lib/api';

const ERRORS: Record<string, string> = {
  provider: 'That sign-in option is not set up yet. Use your email and password instead.',
  state: 'The sign-in attempt expired. Please try again.',
  token: 'The provider did not confirm your sign-in. Please try again.',
  'no-account': 'We could not find a Vellaire account for that email.',
};

/** Where to go after signing in: the page that sent you here, else your own home. */
const goNext = (redirect: string) => {
  const next = new URLSearchParams(window.location.search).get('next');
  window.location.href = next?.startsWith('/') && !next.startsWith('//') ? next : redirect;
};

function SignInForm() {
  const params = useSearchParams();
  const [email, setEmail] = useState(params.get('email') || '');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState<'password' | 'link' | null>(null);
  const [sent, setSent] = useState<{ message: string; devLink?: string } | null>(null);
  const [error, setError] = useState(ERRORS[params.get('error') || ''] || '');
  const [providers, setProviders] = useState({ google: false, microsoft: false, email: false });

  useEffect(() => {
    api
      .get('/auth/providers')
      .then(setProviders)
      .catch(() => {});
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy('password');
    setError('');
    try {
      const r = await api.post<{ redirect: string }>('/auth/password', { email, password });
      goNext(r.redirect);
    } catch (err) {
      setError((err as Error).message);
      setBusy(null);
    }
  }

  async function emailLink() {
    if (!email) return setError('Type your email first.');
    setBusy('link');
    setError('');
    try {
      setSent(await api.post('/auth/start', { email }));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const oauth = (p: 'google' | 'microsoft') => {
    if (!providers[p]) return setError(ERRORS.provider);
    window.location.href = `/api/auth/oauth/${p}`;
  };

  if (sent) return <LinkSent email={email} message={sent.message} devLink={sent.devLink} onBack={() => setSent(null)} backLabel="Use a different email" />;

  return (
    <form onSubmit={submit} className="flex flex-col gap-6">
      <div className="flex flex-col gap-2.5">
        <h1 className="font-display text-[44px] font-normal leading-[1.05]">Sign in</h1>
        <p className="text-[15px] text-stone">Use your work email and password.</p>
      </div>
      <div className="flex flex-col gap-2">
        <label htmlFor="email" className="text-[13px] font-medium text-[#3A3A42]">
          Work email
        </label>
        <Input id="email" type="email" required autoComplete="email" placeholder="name@company.com" value={email} onChange={(e) => setEmail(e.target.value)} className="h-12" />
      </div>
      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between">
          <label htmlFor="password" className="text-[13px] font-medium text-[#3A3A42]">
            Password
          </label>
          <Link href={`/forgot-password${email ? `?email=${encodeURIComponent(email)}` : ''}`} className="text-[13px] text-gold-text hover:text-ink">
            Forgot password?
          </Link>
        </div>
        <Input id="password" type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className="h-12" />
      </div>
      {error && (
        <p role="alert" className="-mt-2 text-[14px] text-err">
          {error}
        </p>
      )}
      <Button type="submit" variant="ink" size="lg" loading={busy === 'password'} className="h-12.5">
        Sign in <Icon name="arrow" size={18} className="text-gold-soft" />
      </Button>
      <div className="flex items-center gap-4 text-[12px] tracking-[0.14em] text-[#8A857B]">
        <div className="h-px flex-1 bg-[#E2DCD0]" />
        OR
        <div className="h-px flex-1 bg-[#E2DCD0]" />
      </div>
      <div className="flex flex-col gap-3">
        <Button size="lg" onClick={() => oauth('google')}>
          Continue with Google
        </Button>
        <Button size="lg" onClick={() => oauth('microsoft')}>
          Continue with Microsoft
        </Button>
        {providers.email && (
          <Button size="lg" loading={busy === 'link'} onClick={emailLink}>
            Email me a sign-in link
          </Button>
        )}
      </div>
      <div className="flex flex-wrap justify-between gap-2 text-[14px] text-stone">
        <span>
          New to Vellaire?{' '}
          <Link href="/signup" className="text-gold-text hover:text-ink">
            Create an account
          </Link>
        </span>
        <a href="mailto:support@vellaire.app" className="text-gold-text hover:text-ink">
          Trouble signing in
        </a>
      </div>
    </form>
  );
}

/** One-click demo accounts, only while demo access is on (development, or DEMO_LOGIN=1 on the server). */
function DemoAccess() {
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get<{ enabled: boolean }>('/auth/demo')
      .then((r) => setEnabled(r.enabled))
      .catch(() => {});
  }, []);
  if (!enabled) return null;

  const enter = async (as: string) => {
    setBusy(as);
    setError('');
    try {
      const r = await api.post<{ redirect: string }>('/auth/demo', { as });
      window.location.href = r.redirect;
    } catch (e) {
      setError((e as Error).message);
      setBusy(null);
    }
  };

  const options = [
    { as: 'owner', title: 'Company dashboard' },
    { as: 'employee', title: 'Employee app' },
    { as: 'console', title: 'Owner console' },
  ];
  return (
    <div className="mt-10 rounded-xl border border-dashed border-gold-line bg-gold-tint p-4">
      <div className="text-[13px] font-medium text-gold-text">Demo access</div>
      <p className="mt-0.5 text-[13px] text-stone">Open a demo account without a password. Turn this off before launch.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {options.map((o) => (
          <Button key={o.as} size="sm" loading={busy === o.as} disabled={!!busy} onClick={() => enter(o.as)}>
            {o.title}
          </Button>
        ))}
      </div>
      {error && (
        <p role="alert" className="mt-2 text-[13px] text-err">
          {error}
        </p>
      )}
    </div>
  );
}

export default function SignInPage() {
  return (
    <AuthLayout cardText="Welcome back" quote="Your identity, impeccably shared.">
      <div className="w-full max-w-100">
        <Suspense>
          <SignInForm />
        </Suspense>
        <DemoAccess />
      </div>
    </AuthLayout>
  );
}
