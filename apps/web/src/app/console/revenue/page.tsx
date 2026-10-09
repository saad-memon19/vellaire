'use client';

import { ErrorState, Loading, PageHeader, Panel, PanelHeader, Stat, StatusBadge, Table, Td } from '@/components/ui';
import { useApi } from '@/lib/api';

export default function Revenue() {
  const { data, error, mutate } = useApi<any>('/console/revenue');
  if (error) return <ErrorState error={error} retry={() => mutate()} />;
  if (!data) return <Loading />;
  return (
    <div>
      <PageHeader eyebrow="Revenue" title="Revenue and invoices" desc="Recurring revenue by plan, and every invoice. Prices per seat are set in the API config." />
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <Stat label="MRR" value={`$${data.mrr.toLocaleString()}`} />
        <Stat label="ARR" value={`$${data.arr.toLocaleString()}`} />
        <Stat label="Failed invoices" value={data.failed} tone={data.failed ? 'down' : undefined} delta={data.failed ? 'needs follow-up' : 'none'} />
      </div>
      <Panel pad={false} className="mb-6">
        <div className="p-5 pb-0">
          <PanelHeader title="By plan" />
        </div>
        <Table head={['Plan', 'Companies', 'Seats', 'MRR']}>
          {data.byPlan.map((p: any) => (
            <tr key={p.id}>
              <Td className="font-medium">{p.name}</Td>
              <Td className="tabular-nums">{p.companies}</Td>
              <Td className="tabular-nums">{p.seats.toLocaleString()}</Td>
              <Td className="tabular-nums">${p.mrr.toLocaleString()}</Td>
            </tr>
          ))}
        </Table>
      </Panel>
      <Panel pad={false}>
        <div className="p-5 pb-0">
          <PanelHeader title="Latest invoices" />
        </div>
        <Table head={['Invoice', 'Company', 'Period', 'Amount', 'Status']}>
          {data.invoices.map((i: any) => (
            <tr key={i.id}>
              <Td className="font-mono text-[13px]">{i.number}</Td>
              <Td>{i.company}</Td>
              <Td>{i.period}</Td>
              <Td className="tabular-nums">{i.amount}</Td>
              <Td>
                <StatusBadge status={i.status} />
              </Td>
            </tr>
          ))}
        </Table>
      </Panel>
    </div>
  );
}
