'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { AuthLayout, LinkSent } from '@/components/auth-layout';
import { Icon } from '@/components/icons';
import { Button, Input } from '@/components/ui';
import { api } from '@/lib/api';

export default function SignUpPage() {
  return (
    <AuthLayout
      cardText="Your name here"
      quote={
        <>
          Set up in minutes.
          <br />
          Branded cards for your whole company.
        </>
      }
    >
      <div className="w-full max-w-105">
        <Suspense>
          <SignUpForm />
        </Suspense>
      </div>
    </AuthLayout>
  );
}

const field = (label: string, input: React.ReactNode, id: string) => (
  <div className="flex min-w-0 flex-col gap-2">
    <label htmlFor={id} className="text-[13px] font-medium text-[#3A3A42]">
      {label}
    </label>
    {input}
  </div>
);

function SignUpForm() {
  const params = useSearchParams();
  const [f, setF] = useState({ firstName: '', lastName: '', email: params.get('email') || '', company: '', coupon: params.get('code') || '' });
  const [agree, setAgree] = useState(false);
  const [showCode, setShowCode] = useState(!!params.get('code'));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(params.get('error') === 'provider' ? 'That sign-up option is not set up yet. Use your work email instead.' : params.get('error') || '');
  const [sent, setSent] = useState<{ devLink?: string } | null>(null);
  const [providers, setProviders] = useState({ google: false, microsoft: false });
  useEffect(() => {
    api
      .get('/auth/providers')
      .then(setProviders)
      .catch(() => {});
  }, []);

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  const input = (k: keyof typeof f, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => <Input id={`su-${k}`} value={f[k]} onChange={set(k)} className="h-12" {...props} />;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      setSent(await api.post('/auth/signup', { ...f, coupon: f.coupon || undefined, agree }));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  /** Google and Microsoft give us the name and email; the company name comes from this form. */
  const oauth = (p: 'google' | 'microsoft') => {
    if (!providers[p]) return setError('That sign-up option is not set up yet. Use your work email instead.');
    if (f.company.trim().length < 2) return setError('Type your company name first, then continue with Google or Microsoft.');
    if (!agree) return setError('Please agree to the terms to continue.');
    window.location.href = `/api/auth/oauth/${p}?company=${encodeURIComponent(f.company.trim())}${f.coupon ? `&coupon=${encodeURIComponent(f.coupon)}` : ''}`;
  };

  if (sent)
    return (
      <LinkSent
        message={`Your workspace for ${f.company} is ready. We sent a sign-in link to ${f.email}.`}
        devLink={sent.devLink}
        onBack={() => setSent(null)}
        backLabel="Change details"
      />
    );

  return (
    <form onSubmit={submit} className="flex flex-col gap-5.5">
      <div className="flex flex-col gap-2.5">
        <h1 className="font-display text-[44px] font-normal leading-[1.05]">Create your account</h1>
        <p className="text-[15px] text-stone">Start with your company. You can invite your team after setup. Free for 14 days.</p>
      </div>
      <div className="grid grid-cols-2 gap-3.5">
        {field('First name', input('firstName', { required: true, autoComplete: 'given-name' }), 'su-firstName')}
        {field('Last name', input('lastName', { required: true, autoComplete: 'family-name' }), 'su-lastName')}
      </div>
      {field('Work email', input('email', { type: 'email', required: true, autoComplete: 'email', placeholder: 'name@company.com' }), 'su-email')}
      {field('Company', input('company', { required: true, autoComplete: 'organization' }), 'su-company')}
      {showCode ? (
        field('Partner or coupon code', input('coupon', { className: 'h-12 font-mono uppercase', autoComplete: 'off' }), 'su-coupon')
      ) : (
        <button type="button" onClick={() => setShowCode(true)} className="-mt-2 self-start text-[13.5px] text-gold-text hover:text-ink">
          Have a partner or coupon code?
        </button>
      )}
      <label className="flex cursor-pointer items-start gap-2.5 text-[13.5px] leading-normal text-[#4E4A44]">
        <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5 h-4.25 w-4.25 accent-ink" />
        {/* TODO: link these once the Terms and Privacy policy pages are written */}
        <span>I agree to the Vellaire Terms and Privacy policy</span>
      </label>
      {error && (
        <p role="alert" className="-mt-2 text-[14px] text-err">
          {error}
        </p>
      )}
      <Button type="submit" variant="ink" size="lg" loading={busy} disabled={!agree} className="h-12.5">
        Create account <Icon name="arrow" size={18} className="text-gold-soft" />
      </Button>
      <div className="grid grid-cols-2 gap-2.5">
        <Button size="lg" onClick={() => oauth('google')}>
          Sign up with Google
        </Button>
        <Button size="lg" onClick={() => oauth('microsoft')}>
          Sign up with Microsoft
        </Button>
      </div>
      <p className="text-[14px] text-stone">
        Already have an account?{' '}
        <Link href="/signin" className="text-gold-text hover:text-ink">
          Sign in
        </Link>
      </p>
    </form>
  );
}
