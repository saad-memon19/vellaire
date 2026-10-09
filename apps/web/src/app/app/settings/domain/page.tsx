'use client';

import { useEffect, useState } from 'react';
import { useToast } from '@/components/toast';
import { Badge, Button, Callout, copyText, ErrorState, Field, Input, Loading, PageHeader, Panel, PanelHeader, Table, Td } from '@/components/ui';
import { api, isAdmin, useApi, useMe } from '@/lib/api';

export default function Domain() {
  const { data, error, mutate } = useApi<any>('/settings');
  const { data: me } = useMe();
  const [host, setHost] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const toast = useToast();
  useEffect(() => {
    if (data) setHost(data.domain.host);
  }, [data]);

  if (error) return <ErrorState error={error} retry={() => mutate()} />;
  if (!data) return <Loading />;
  const d = data.domain;
  const admin = isAdmin(me?.user.role);

  const save = async () => {
    setBusy('save');
    try {
      await api.patch('/settings/domain', { host });
      toast(host ? 'Domain saved. Add the DNS records below.' : 'Domain removed');
      mutate();
    } catch (e) {
      toast((e as Error).message, 'err');
    } finally {
      setBusy(null);
    }
  };
  const verify = async () => {
    setBusy('verify');
    try {
      const r = await api.post('/settings/domain/verify');
      toast(r.message, r.verified ? 'ok' : 'info');
      mutate();
    } catch (e) {
      toast((e as Error).message, 'err');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div>
      <PageHeader eyebrow="Settings" title="Company domain" desc="Serve every card from your own address, like cards.yourcompany.com/sara-khan." />
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <Panel>
          <PanelHeader title="Card domain" action={d.host && (d.verified ? <Badge tone="ok">Verified</Badge> : <Badge tone="warn">Waiting for DNS</Badge>)} />
          <div className="flex flex-wrap items-end gap-2">
            <Field label="Domain" className="min-w-[240px] flex-1">
              {(id) => <Input id={id} placeholder="cards.yourcompany.com" value={host} disabled={!admin} onChange={(e) => setHost(e.target.value)} />}
            </Field>
            {admin && (
              <Button onClick={save} loading={busy === 'save'} disabled={host === d.host}>
                Save
              </Button>
            )}
          </div>
          {d.host && !d.verified && (
            <>
              <p className="mb-3 mt-6 text-[14px] text-stone">Add these two records at your DNS provider, then verify. Changes can take up to an hour.</p>
              <Table head={['Type', 'Name', 'Value', '']}>
                {[
                  ['CNAME', d.host, d.cname],
                  ['TXT', d.txtName, d.txtValue],
                ].map(([t, n, v]) => (
                  <tr key={t}>
                    <Td className="font-medium">{t}</Td>
                    <Td className="font-mono text-[13px]">{n}</Td>
                    <Td className="max-w-[260px] truncate font-mono text-[13px]">{v}</Td>
                    <Td>
                      <Button size="sm" variant="ghost" icon="copy" onClick={() => copyText(v)?.then(() => toast('Copied'))}>
                        Copy
                      </Button>
                    </Td>
                  </tr>
                ))}
              </Table>
              {admin && (
                <Button variant="ink" className="mt-4" loading={busy === 'verify'} onClick={verify}>
                  Verify domain
                </Button>
              )}
            </>
          )}
          {d.verified && <div className="mt-5"><Callout tone="ok" icon="checkCircle">Card links now use https://{d.host}/. Old links keep working.</Callout></div>}
        </Panel>
        <Panel>
          <PanelHeader title="Until then" />
          <p className="text-[14px] text-stone">Cards use your Vellaire address:</p>
          <p className="mt-2 break-all font-mono text-[13px]">{d.defaultUrl}name</p>
        </Panel>
      </div>
    </div>
  );
}
