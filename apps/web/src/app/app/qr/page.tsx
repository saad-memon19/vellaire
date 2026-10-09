'use client';

import { useState } from 'react';
import { Icon } from '@/components/icons';
import { ErrorState, Input, LinkButton, Loading, PageHeader, Pagination, Panel } from '@/components/ui';
import { qs, useApi } from '@/lib/api';

export default function QrCodes() {
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const { data, error, mutate } = useApi<any>(`/cards${qs({ status: 'live', q, page, limit: 12 })}`);
  if (error) return <ErrorState error={error} retry={() => mutate()} />;
  return (
    <div>
      <PageHeader
        eyebrow="Sharing"
        title="QR codes"
        desc="Every live card has a QR code for print, slides and event badges. Scans are counted separately from taps."
        actions={
          <LinkButton href="/api/cards/qr-codes.zip" variant="ink" icon="download" download>
            Download all (ZIP)
          </LinkButton>
        }
      />
      <div className="relative mb-5 max-w-md">
        <Icon name="search" size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-2" />
        <Input aria-label="Search" placeholder="Search by name" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} className="pl-10" />
      </div>
      {!data ? (
        <Loading />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {data.items.map((c: any) => (
              <Panel key={c.id} className="flex flex-col items-center text-center">
                <img src={`/api/cards/${c.id}/qr`} alt={`QR code for ${c.name}`} loading="lazy" className="aspect-square w-40" />
                <div className="mt-3 text-[15px] font-medium">{c.name}</div>
                <div className="w-full truncate font-mono text-[12px] text-stone-2">{c.url}</div>
                <div className="mt-3 flex gap-2">
                  <LinkButton size="sm" href={`/api/cards/${c.id}/qr?format=download`}>
                    SVG
                  </LinkButton>
                  <LinkButton size="sm" href={`/api/cards/${c.id}/qr?format=png`}>
                    PNG
                  </LinkButton>
                </div>
              </Panel>
            ))}
          </div>
          <Pagination page={data.page} limit={data.limit} total={data.total} onPage={setPage} />
        </>
      )}
    </div>
  );
}
