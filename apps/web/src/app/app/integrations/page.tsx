'use client';

import Link from 'next/link';
import { Icon } from '@/components/icons';
import { Callout, ErrorState, LinkButton, Loading, PageHeader, Panel, StatusBadge } from '@/components/ui';
import { useApi } from '@/lib/api';

const MARK: Record<string, string> = { workday: 'W', sap: 'SAP', bamboohr: 'B', entra: 'E' };

export default function Integrations() {
  const { data, error, mutate } = useApi<any>('/integrations');
  if (error) return <ErrorState error={error} retry={() => mutate()} />;
  return (
    <div>
      <PageHeader
        eyebrow="Automation"
        title="HR integrations"
        desc="Connect your HR system once. Every joiner, promotion and departure then flows to their card, wallet pass and NFC card."
        actions={<LinkButton href="/app/integrations/activity" icon="activity">Sync activity</LinkButton>}
      />
      {!data ? (
        <Loading />
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            {data.providers.map((p: any) => (
              <Panel key={p.id} className="flex flex-col gap-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-ink font-display text-[16px] text-gold-soft">{MARK[p.id]}</span>
                    <div>
                      <h2 className="text-[16px] font-medium">{p.name}</h2>
                      <p className="text-[13px] text-stone-2">{p.desc}</p>
                    </div>
                  </div>
                  <StatusBadge status={p.status} />
                </div>
                {p.error && (
                  <Callout tone={p.status === 'paused' ? 'warn' : 'err'} icon="alert">
                    {p.error}
                  </Callout>
                )}
                <div className="mt-auto flex items-center justify-between gap-3 border-t border-linen pt-3">
                  <span className="text-[13px] text-stone-2">{p.status === 'not_connected' ? 'Not connected' : `${p.people.toLocaleString()} people · last sync ${p.lastSync || 'never'}`}</span>
                  <LinkButton size="sm" variant={p.status === 'not_connected' ? 'ink' : 'outline'} href={`/app/integrations/${p.id}`}>
                    {p.status === 'not_connected' ? 'Set up' : 'Manage'}
                  </LinkButton>
                </div>
              </Panel>
            ))}
          </div>
          <Panel className="mt-4 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-pearl text-gold-text">
                <Icon name="upload" />
              </span>
              <div>
                <div className="text-[16px] font-medium">CSV import</div>
                <div className="text-[13px] text-stone-2">No HR system? Upload a spreadsheet. {data.csvPeople ? `${data.csvPeople} people came from CSV.` : ''}</div>
              </div>
            </div>
            <LinkButton size="sm" href="/app/employees?import=1">
              Import CSV
            </LinkButton>
          </Panel>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {[
              ['Joiners', 'A card is created from the department’s template, approved if your policy requires it, and delivered with a welcome pack.'],
              ['Movers', 'New title, new office, new number — the card, wallet pass and signature update. The NFC card keeps working.'],
              ['Leavers', 'On the last day, the card turns off, wallet passes are voided and the NFC chip is disabled. Leads stay with the company.'],
            ].map(([t, d]) => (
              <div key={t} className="rounded-xl border border-line bg-white p-5">
                <div className="font-display text-[22px] text-gold-text">{t}</div>
                <p className="mt-1 text-[14px] text-stone">{d}</p>
              </div>
            ))}
          </div>
          <p className="mt-4 text-[13px] text-stone-2">
            Connected systems sync every hour. A sync that would switch off more than your guard limit pauses for review. <Link href="/app/integrations/activity" className="text-gold-text underline">See activity</Link>
          </p>
        </>
      )}
    </div>
  );
}
