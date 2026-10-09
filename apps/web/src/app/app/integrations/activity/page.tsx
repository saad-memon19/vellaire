'use client';

import { Empty, ErrorState, Loading, PageHeader, Panel, StatusBadge, Table, Td } from '@/components/ui';
import { useApi } from '@/lib/api';

export default function SyncActivity() {
  const { data, error, mutate } = useApi<any[]>('/integrations/activity');
  if (error) return <ErrorState error={error} retry={() => mutate()} />;
  return (
    <div>
      <PageHeader eyebrow="Automation" title="Sync activity" desc="Every HR sync, newest first. Paused syncs wait for you in HR integrations." back={{ href: '/app/integrations', label: 'HR integrations' }} />
      <Panel pad={false}>
        {!data ? (
          <Loading />
        ) : data.length === 0 ? (
          <Empty icon="sync" title="No syncs yet" desc="Connect an HR system to start." />
        ) : (
          <Table head={['When', 'System', 'Status', 'Created', 'Updated', 'Switched off', 'Skipped', 'Notes']}>
            {data.map((r) => (
              <tr key={r.id} className="align-top hover:bg-pearl">
                <Td className="whitespace-nowrap">
                  {new Date(r.at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  <div className="text-[12px] text-stone-2">{r.trigger}</div>
                </Td>
                <Td>{r.provider}</Td>
                <Td>
                  <StatusBadge status={r.status} />
                </Td>
                <Td className="tabular-nums">{r.created}</Td>
                <Td className="tabular-nums">{r.updated}</Td>
                <Td className="tabular-nums">{r.deactivated}</Td>
                <Td className="tabular-nums">{r.skipped}</Td>
                <Td className="max-w-xs text-[13px] text-stone">{r.issues.join(' ')}</Td>
              </tr>
            ))}
          </Table>
        )}
      </Panel>
    </div>
  );
}
