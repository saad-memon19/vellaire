'use client';

import { Callout, ErrorState, LinkButton, Loading, PageHeader } from '@/components/ui';
import { api, useApi } from '@/lib/api';
import { EmptyRow, GridRow, GridTable, Kpis, Meter, Pill, RowButton, Section, useAction } from '../parts';

const FEATURE_COLS = '1.8fr 0.9fr 1.6fr 1.1fr 0.9fr 110px';
const COMPANY_COLS = '2fr 1.2fr 1.8fr 1.4fr';

export default function AiUsage() {
  const { data, error, mutate } = useApi<any>('/console/ai');
  const { busy, run } = useAction(mutate);

  if (error) return <ErrorState error={error} retry={() => mutate()} />;
  return (
    <div className="flex flex-col gap-5.5 [&>header]:mb-0">
      <PageHeader
        eyebrow="Operations"
        title="AI usage and cost"
        desc="How much each AI feature is used, what it costs, and how people rate the results. Customer data is never used for training."
        actions={
          <LinkButton href="/console/plans" variant="ink">
            Edit limits
          </LinkButton>
        }
      />
      {!data ? (
        <Loading />
      ) : (
        <>
          {data.provider === 'none' && (
            <Callout tone="gold" icon="info">
              AI is switched off on the server (AI_PROVIDER=none), so new requests are not made. The numbers below are what was recorded this month.
            </Callout>
          )}
          <Kpis items={data.kpis} />
          <Section title="By feature">
            <GridTable cols={FEATURE_COLS} minWidth={900} head={['Feature', 'Uses', data.priced ? 'Share of cost' : 'Share of use', 'Rated helpful', 'Status', '']}>
              {data.features.map((f: any) => (
                <GridRow key={f.key} cols={FEATURE_COLS}>
                  <span className="font-semibold">{f.name}</span>
                  <span className="tabular-nums">{f.uses.toLocaleString()}</span>
                  <Meter pct={f.share} />
                  <span className={f.helpful === null ? 'text-stone-2' : f.helpful >= 85 ? 'font-medium text-ok' : 'font-medium text-warn'}>
                    {f.helpful === null ? 'No ratings' : `${f.helpful}%`}
                  </span>
                  <span>
                    <Pill status={f.on ? 'on' : 'off'} />
                  </span>
                  <span className="flex justify-end">
                    <RowButton
                      disabled={busy === f.key}
                      onClick={() => run(f.key, () => api.patch(`/console/ai/features/${f.key}`, { on: !f.on }), `${f.name} turned ${f.on ? 'off' : 'on'}`)}
                    >
                      {f.on ? 'Turn off' : 'Turn on'}
                    </RowButton>
                  </span>
                </GridRow>
              ))}
            </GridTable>
          </Section>
          <Section title="Highest use this month" sub="Credits are included per live card, per month, by plan">
            <GridTable cols={COMPANY_COLS} minWidth={700} head={['Company', 'Plan', 'Credits used', 'Top feature']}>
              {data.companies.length === 0 && <EmptyRow>No AI requests this month</EmptyRow>}
              {data.companies.map((c: any) => (
                <GridRow key={c.company} cols={COMPANY_COLS}>
                  <span className="font-semibold">{c.company}</span>
                  <span>{c.plan}</span>
                  {c.pct === null ? (
                    <span className="text-[13px] text-stone-2">{c.used.toLocaleString()} · no limit</span>
                  ) : (
                    <Meter pct={c.pct} level={c.pct >= 90 ? 'err' : c.pct >= 75 ? 'warn' : 'ok'} />
                  )}
                  <span className="text-[#4E4A44]">{c.top}</span>
                </GridRow>
              ))}
            </GridTable>
          </Section>
        </>
      )}
    </div>
  );
}
