'use client';

import Link from 'next/link';
import { useState } from 'react';
import { CardFace } from '@/components/card/card-face';
import { Icon } from '@/components/icons';
import { Avatar, cx, Empty, ErrorState, FilterChip, LinkButton, Loading, PageHeader, Pagination, Panel, StatusBadge, Table, Tabs, Td } from '@/components/ui';
import { qs, useApi } from '@/lib/api';

/* Built to the "All cards" artboard. */

const STATUS: Record<string, [string, string, string]> = {
  live: ['Live', '#E5F2EB', '#1F7A55'],
  pending_approval: ['Pending', '#FBF0DC', '#8A5A12'],
  scheduled: ['Scheduled', '#E6ECF6', '#2F4A7A'],
  draft: ['Draft', '#EFEBE3', '#4E4A44'],
  deactivated: ['Off', '#F8E4E7', '#A3283A'],
};

export default function CardsPage() {
  const [status, setStatus] = useState('all');
  const [q, setQ] = useState('');
  const [department, setDepartment] = useState('');
  const [office, setOffice] = useState('');
  const [template, setTemplate] = useState('');
  const [source, setSource] = useState('');
  const [page, setPage] = useState(1);
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const { data, error, mutate } = useApi<any>(`/cards${qs({ status, q, department, office, template, source, page, limit: view === 'grid' ? 8 : 20 })}`);

  const reset = (fn: () => void) => {
    fn();
    setPage(1);
  };
  const city = (o?: string) => (o || '').split('·')[0]!.trim();

  return (
    <div className="flex flex-col gap-6 [&>header]:mb-0">
      <PageHeader
        eyebrow="Cards"
        title="All cards"
        desc={data ? `${data.tabs[0].count.toLocaleString()} cards across ${data.departments.length} departments and ${data.offices.length} offices.` : ' '}
        actions={
          <>
            <LinkButton href="/api/cards/qr-codes.zip" icon="dQr" download>
              Download all QR codes
            </LinkButton>
            <LinkButton href="/app/create" variant="ink" icon="plus">
              Create a card
            </LinkButton>
          </>
        }
      />

      {data && <Tabs items={data.tabs} value={status} onChange={(v) => reset(() => setStatus(v))} />}

      <div className="flex flex-wrap items-center gap-2.5">
        <label className="flex h-[42px] max-w-[360px] flex-[1_1_260px] items-center gap-2.5 rounded-lg border border-linen bg-white px-3 text-stone-2">
          <Icon name="dSearch" size={18} />
          <input type="search" aria-label="Search cards" placeholder="Search by name or title" value={q} onChange={(e) => reset(() => setQ(e.target.value))} className="min-w-0 flex-1 bg-transparent text-[14px] text-ink outline-none placeholder:text-stone-2" />
        </label>
        <FilterChip label="Department" value={department} onChange={(v) => reset(() => setDepartment(v))} options={(data?.departments || []).map((d: string) => ({ id: d, name: d }))} />
        <FilterChip label="Office" value={office} onChange={(v) => reset(() => setOffice(v))} options={(data?.offices || []).map((d: string) => ({ id: d, name: d }))} />
        <FilterChip label="Template" value={template} onChange={(v) => reset(() => setTemplate(v))} options={data?.templates || []} />
        <FilterChip label="Source" value={source} onChange={(v) => reset(() => setSource(v))} options={data?.sources || []} />
        <div className="ml-auto flex gap-1 rounded-lg border border-linen bg-white p-[3px]" role="group" aria-label="View">
          {(
            [
              ['grid', 'Grid view', 'grid'],
              ['list', 'List view', 'list'],
            ] as const
          ).map(([id, label, icon]) => (
            <button
              key={id}
              type="button"
              aria-label={label}
              aria-pressed={view === id}
              onClick={() => reset(() => setView(id))}
              className={cx('flex h-[34px] w-9 items-center justify-center rounded-md', view === id ? 'bg-[#F4EEE2] text-gold-text' : 'text-[#8E887E] hover:text-ink')}
            >
              <Icon name={icon} size={18} />
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <ErrorState error={error} retry={() => mutate()} />
      ) : !data ? (
        <Loading />
      ) : data.items.length === 0 ? (
        <Panel>
          <Empty icon="cards" title="No cards here" desc="Try another filter, or create the first card." action={<LinkButton href="/app/create" variant="ink" icon="plus">Create a card</LinkButton>} />
        </Panel>
      ) : view === 'grid' ? (
        <>
          <div className="grid gap-[18px]" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(250px, 100%), 1fr))' }}>
            {data.items.map((c: any) => {
              const [label, bg, fg] = STATUS[c.status] || STATUS.draft!;
              return (
                <article key={c.id} className="relative flex flex-col gap-3.5 rounded-[14px] border border-linen bg-white p-3.5 transition-[transform,border-color] duration-200 hover:-translate-y-0.5 hover:border-gold">
                  <Link href={`/app/cards/${c.id}`} aria-label={`Open ${c.name}`}>
                    <CardFace layout={c.layout} theme={c.theme} fields={{ name: c.name, title: c.title, photoUrl: c.photoUrl }} brand={data.brand} width="100%" />
                  </Link>
                  <div className="flex flex-col gap-1 px-0.5">
                    <div className="flex items-center justify-between gap-2">
                      <Link href={`/app/cards/${c.id}`} className="truncate text-[15px] font-semibold text-ink hover:text-gold-text">
                        {c.name}
                      </Link>
                      <span className="shrink-0 rounded-full px-2.5 py-[3px] text-[12px] font-medium" style={{ background: bg, color: fg }}>
                        {label}
                      </span>
                    </div>
                    <div className="truncate text-[13px] text-stone">{[c.title, city(c.office)].filter(Boolean).join(' · ')}</div>
                  </div>
                  <div className="flex items-center justify-between border-t border-[#F0EBE2] px-0.5 pt-2.5 text-[12.5px] text-stone-2">
                    <span className="flex items-center gap-1.5">
                      <Icon name="eye" size={15} /> {c.views.toLocaleString()} {c.views === 1 ? 'view' : 'views'}
                    </span>
                    <span>{c.source}</span>
                  </div>
                </article>
              );
            })}
          </div>
          <Pagination page={data.page} limit={data.limit} total={data.total} onPage={setPage} />
        </>
      ) : (
        <Panel pad={false}>
          <Table head={['Person', 'Department', 'Office', 'Status', 'Views · 30d', 'Source', 'Link']}>
            {data.items.map((c: any) => (
              <tr key={c.id} className="hover:bg-[#FAF7F1]">
                <Td>
                  <Link href={`/app/cards/${c.id}`} className="flex items-center gap-3">
                    <Avatar name={c.name} src={c.photoUrl} size={32} />
                    <span>
                      <span className="block font-medium">{c.name}</span>
                      <span className="block text-[13px] text-stone-2">{c.title}</span>
                    </span>
                  </Link>
                </Td>
                <Td className="text-stone">{c.dept}</Td>
                <Td className="text-stone">{c.office}</Td>
                <Td>
                  <StatusBadge status={c.status} />
                </Td>
                <Td className="tabular-nums">{c.views.toLocaleString()}</Td>
                <Td className="text-stone">{c.source}</Td>
                <Td className="font-mono text-[12px] text-stone">{c.url}</Td>
              </tr>
            ))}
          </Table>
          <Pagination page={data.page} limit={data.limit} total={data.total} onPage={setPage} />
        </Panel>
      )}
    </div>
  );
}
