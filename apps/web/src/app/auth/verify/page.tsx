'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef, useState } from 'react';
import { Seal } from '@/components/icons';
import { Spinner } from '@/components/ui';
import { api } from '@/lib/api';

function Verify() {
  const params = useSearchParams();
  const router = useRouter();
  const [error, setError] = useState('');
  const once = useRef(false);

  useEffect(() => {
    if (once.current) return;
    once.current = true;
    const token = params.get('token');
    if (!token) return setError('This link is incomplete.');
    api
      .post<{ redirect: string }>('/auth/verify', { token })
      .then((r) => router.replace(params.get('next') || r.redirect))
      .catch((e) => setError(e.message));
  }, [params, router]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-pearl px-6 text-center">
      <Seal size={44} className="text-gold" />
      {error ? (
        <>
          <h1 className="font-display text-[34px]">{error}</h1>
          <Link href="/signin" className="inline-flex h-11 items-center rounded-md bg-ink px-5 text-cream">
            Back to sign in
          </Link>
        </>
      ) : (
        <div className="flex items-center gap-3 text-stone">
          <Spinner /> Signing you in…
        </div>
      )}
    </main>
  );
}

export default function Page() {
  return (
    <Suspense>
      <Verify />
    </Suspense>
  );
}
