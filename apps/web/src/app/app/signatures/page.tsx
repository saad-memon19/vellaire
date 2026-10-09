'use client';

import { useEffect, useState } from 'react';
import { Icon } from '@/components/icons';
import { useToast } from '@/components/toast';
import { Avatar, Button, Callout, copyText, Input, Loading, PageHeader, Panel, PanelHeader, Spinner } from '@/components/ui';
import { api, qs, useApi } from '@/lib/api';

export default function Signatures() {
  const [q, setQ] = useState('');
  const { data } = useApi<any>(`/cards${qs({ status: 'live', q, limit: 12 })}`);
  const [sel, setSel] = useState<any>(null);
  const [html, setHtml] = useState('');
  const toast = useToast();

  useEffect(() => {
    if (!sel && data?.items?.[0]) setSel(data.items[0]);
  }, [data, sel]);
  useEffect(() => {
    if (!sel) return;
    setHtml('');
    api.get(`/cards/${sel.id}/signature`).then((r) => setHtml(r.html));
  }, [sel]);

  const copy = async () => {
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'text/html': new Blob([html], { type: 'text/html' }), 'text/plain': new Blob([html], { type: 'text/plain' }) })]);
    } catch {
      await copyText(html);
    }
    toast('Signature copied');
  };

  return (
    <div>
      <PageHeader eyebrow="Sharing" title="Email signatures" desc="A signature for every card, in your brand, linking to the online card. Opens from signatures are tracked." />
      <div className="grid gap-6 xl:grid-cols-[340px_1fr]">
        <Panel pad={false}>
          <div className="border-b border-line p-4">
            <div className="relative">
              <Icon name="search" size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-2" />
              <Input aria-label="Search" placeholder="Search people" value={q} onChange={(e) => setQ(e.target.value)} className="pl-10" />
            </div>
          </div>
          {!data ? (
            <Loading />
          ) : (
            <ul className="max-h-[560px] overflow-y-auto p-2">
              {data.items.map((c: any) => (
                <li key={c.id}>
                  <button type="button" onClick={() => setSel(c)} className={`flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left ${sel?.id === c.id ? 'bg-gold-tint' : 'hover:bg-pearl'}`}>
                    <Avatar name={c.name} size={32} />
                    <span className="min-w-0">
                      <span className="block truncate text-[14px] font-medium">{c.name}</span>
                      <span className="block truncate text-[12px] text-stone-2">{c.title}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <div className="flex flex-col gap-6">
          <Panel>
            <PanelHeader title={sel ? `${sel.name}'s signature` : 'Signature'} action={<Button variant="ink" icon="copy" disabled={!html} onClick={copy}>Copy signature</Button>} />
            <div className="rounded-lg border border-line bg-white p-6">{html ? <div dangerouslySetInnerHTML={{ __html: html }} /> : <Spinner />}</div>
          </Panel>
          <Panel>
            <PanelHeader title="Install it" />
            <ol className="flex list-decimal flex-col gap-2 pl-5 text-[14px] text-stone">
              <li>Copy the signature above.</li>
              <li>
                <b className="font-medium text-ink">Outlook:</b> Settings → Mail → Compose and reply → Email signature → paste.
              </li>
              <li>
                <b className="font-medium text-ink">Gmail:</b> Settings → See all settings → General → Signature → paste.
              </li>
            </ol>
            <div className="mt-4">
              <Callout icon="info">Employees can also copy their own signature from the Vellaire app.</Callout>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
