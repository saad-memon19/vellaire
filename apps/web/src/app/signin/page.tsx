'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { AuthLayout, LinkSent } from '@/components/auth-layout';
import { Icon } from '@/components/icons';
import { Button, Input } from '@/components/ui';
import { api } from '@/lib/api';

const ERRORS: Record<string, string> = {
  provider: 'That sign-in option is not set up yet. Use your work email instead.',
  state: 'The sign-in attempt expired. Please try again.',
  token: 'The provider did not confirm your sign-in. Please try again.',
  'no-account': 'We could not find a Vellaire account for that email.',
};

/** While demo access is on, show one-click entry; the email form sits behind a link. */
function DemoOrForm() {
  const [demo, setDemo] = useState<boolean | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get<{ enabled: boolean }>('/auth/demo')
      .then((r) => setDemo(r.enabled))
      .catch(() => setDemo(false));
  }, []);

  if (demo === null) return null;
  if (!demo || showForm) {
    return (
      <>
        <SignInForm />
        {demo && (
          <button type="button" onClick={() => setShowForm(false)} className="mt-6 text-[14px] text-gold-text underline underline-offset-4">
            Back to demo access
          </button>
        )}
      </>
    );
  }

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

  const options: { as: string; title: string; sub: string; icon: string }[] = [
    { as: 'owner', title: 'Company dashboard', sub: 'Sara Khan · Owner at Meridian Capital', icon: 'home' },
    { as: 'employee', title: 'Employee app', sub: 'A Meridian employee with a live card', icon: 'card' },
    { as: 'console', title: 'Owner console', sub: 'Vellaire staff · customers and revenue', icon: 'shield' },
  ];

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2.5">
        <h1 className="font-display text-[44px] font-normal leading-[1.05]">Explore Vellaire</h1>
        <p className="text-[15px] text-stone">Demo access. Choose where to go — no email needed.</p>
      </div>
      <div className="flex flex-col gap-3">
        {options.map((o) => (
          <button
            key={o.as}
            type="button"
            disabled={!!busy}
            onClick={() => enter(o.as)}
            className="flex items-center gap-4 rounded-xl border border-line bg-white p-4 text-left transition-colors hover:border-ink disabled:opacity-60"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gold-tint text-gold-text">
              <Icon name={o.icon} size={20} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[16px] font-medium">{o.title}</span>
              <span className="block text-[13px] text-stone-2">{o.sub}</span>
            </span>
            {busy === o.as ? <span className="text-[13px] text-stone">Opening…</span> : <Icon name="arrow" size={18} className="text-gold-text" />}
          </button>
        ))}
      </div>
      {error && (
        <p role="alert" className="text-[14px] text-err">
          {error}
        </p>
      )}
      <button type="button" onClick={() => setShowForm(true)} className="self-start text-[14px] text-gold-text underline underline-offset-4">
        Sign in with email instead
      </button>
    </div>
  );
}

function SignInForm() {
  const params = useSearchParams();
  const [email, setEmail] = useState(params.get('email') || '');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<{ message: string; devLink?: string } | null>(null);
  const [error, setError] = useState(ERRORS[params.get('error') || ''] || '');
  const [providers, setProviders] = useState({ google: false, microsoft: false });

  useEffect(() => {
    api
      .get('/auth/providers')
      .then(setProviders)
      .catch(() => {});
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      setSent(await api.post('/auth/start', { email }));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const oauth = (p: 'google' | 'microsoft') => {
    if (!providers[p]) {
      setError(ERRORS.provider);
      return;
    }
    window.location.href = `/api/auth/oauth/${p}`;
  };

  if (sent) return <LinkSent email={email} message={sent.message} devLink={sent.devLink} onBack={() => setSent(null)} backLabel="Use a different email" />;

  return (
    <form onSubmit={submit} className="flex flex-col gap-8">
      <div className="flex flex-col gap-2.5">
        <h1 className="font-display text-[44px] font-normal leading-[1.05]">Sign in</h1>
        <p className="text-[15px] text-stone">Use your work email. If your company uses single sign-on, we will take you there.</p>
      </div>
      <div className="flex flex-col gap-2">
        <label htmlFor="email" className="text-[13px] font-medium text-[#3A3A42]">
          Work email
        </label>
        <Input id="email" type="email" required autoComplete="email" placeholder="name@company.com" value={email} onChange={(e) => setEmail(e.target.value)} className="h-12" />
      </div>
      {error && (
        <p role="alert" className="-mt-4 text-[14px] text-err">
          {error}
        </p>
      )}
      <Button type="submit" variant="ink" size="lg" loading={busy} className="h-[50px]">
        Continue <Icon name="arrow" size={18} className="text-gold-soft" />
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
        <Button size="lg" type="submit" disabled={!email}>
          Email me a magic link
        </Button>
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

export default function SignInPage() {
  return (
    <AuthLayout cardText="Welcome back" quote="Your identity, impeccably shared.">
      <div className="w-full max-w-100">
        <Suspense>
          <DemoOrForm />
        </Suspense>
      </div>
    </AuthLayout>
  );
}
