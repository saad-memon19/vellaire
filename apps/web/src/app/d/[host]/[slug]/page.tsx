import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { serverGet } from '@/lib/server';
import { InactiveCard, PublicCard, PublicCardView } from '../../../c/[company]/[slug]/public-card';

/** Company card domains (cards.meridian.com/sara-khan) are rewritten here by the middleware. */
export default async function Page({ params }: { params: Promise<{ host: string; slug: string }> }) {
  const { host, slug } = await params;
  const card = await serverGet<PublicCard>(`/public/host/${encodeURIComponent(host)}/${encodeURIComponent(slug)}`);
  if (!card) notFound();
  if (card.status !== 'live') return <InactiveCard companyName={card.companyName} />;
  return (
    <Suspense>
      <PublicCardView card={card} />
    </Suspense>
  );
}
