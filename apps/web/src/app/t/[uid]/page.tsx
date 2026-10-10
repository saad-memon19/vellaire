import { notFound, redirect } from 'next/navigation';
import { serverGet } from '@/lib/server';
import { InactiveCard } from '../../c/[company]/[slug]/public-card';

/** NFC chips are written with /t/<uid>; a tap lands here and goes to the live card. */
export default async function Tap({ params }: { params: Promise<{ uid: string }> }) {
  const { uid } = await params;
  const r = await serverGet<{ active: boolean; url?: string; companyName?: string; companySlug?: string; website?: string | null; logo?: string | null; teamPage?: boolean }>(`/public/nfc/${encodeURIComponent(uid)}`);
  if (!r) notFound();
  if (!r.active || !r.url) return <InactiveCard companyName={r.companyName} companySlug={r.companySlug} website={r.website} logo={r.logo} teamPage={r.teamPage} />;
  // Card links are absolute; keep the user on this host when it is the app itself
  const u = new URL(r.url);
  redirect(u.pathname.startsWith('/c/') ? `${u.pathname}${u.search}` : r.url);
}
