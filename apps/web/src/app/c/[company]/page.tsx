import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { serverGet } from '@/lib/server';
import { TeamDirectory, TeamPage } from './team-directory';

type Params = Promise<{ company: string }>;

const load = (company: string) => serverGet<TeamPage>(`/public/team/${encodeURIComponent(company)}`);

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const team = await load((await params).company);
  if (!team) return { title: 'Team', robots: { index: false } };
  return { title: { absolute: `Meet the team · ${team.company.name}` }, robots: { index: false } };
}

export default async function Page({ params }: { params: Params }) {
  const team = await load((await params).company);
  if (!team) notFound();
  return <TeamDirectory team={team} />;
}
