import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { serverGet } from '@/lib/server';
import { InactiveCard, PublicCard, PublicCardView } from './public-card';

type Params = Promise<{ company: string; slug: string }>;

const load = (company: string, slug: string) => serverGet<PublicCard>(`/public/card/${encodeURIComponent(company)}/${encodeURIComponent(slug)}`);

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { company, slug } = await params;
  const card = await load(company, slug);
  if (!card || card.status !== 'live') return { title: 'Card', robots: { index: false } };
  const title = `${card.fields.name} · ${card.companyName}`;
  return {
    title: { absolute: title },
    description: [card.fields.title, card.companyName].filter(Boolean).join(', '),
    openGraph: { title, description: card.fields.title || undefined },
    robots: { index: false },
  };
}

export default async function Page({ params }: { params: Params }) {
  const { company, slug } = await params;
  const card = await load(company, slug);
  if (!card) notFound();
  if (card.status !== 'live') return <InactiveCard companyName={card.companyName} />;
  return (
    <Suspense>
      <PublicCardView card={card} />
    </Suspense>
  );
}
