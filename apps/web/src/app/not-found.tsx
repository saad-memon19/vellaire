import Link from 'next/link';
import { Seal } from '@/components/icons';

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-pearl px-6 text-center">
      <Seal size={44} className="text-gold" />
      <h1 className="font-display text-[40px]">This page does not exist</h1>
      <p className="text-[15px] text-stone">The link may be old, or the card was moved.</p>
      <Link href="/" className="mt-2 inline-flex h-11 items-center rounded-md bg-ink px-5 text-cream">
        Go to Vellaire
      </Link>
    </main>
  );
}
