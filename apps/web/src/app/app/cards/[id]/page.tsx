'use client';

import Link from 'next/link';
import { use, useState } from 'react';
import { CardFace } from '@/components/card/card-face';
import { OnlineCard, PhoneFrame } from '@/components/card/online-card';
import { BarList, chartColors } from '@/components/charts';
import { Icon, IconName } from '@/components/icons';
import { useToast } from '@/components/toast';
import { Avatar, Badge, Button, copyText, cx, Empty, ErrorState, LinkButton, Loading, Modal, Panel, PanelHeader, StatusBadge, Table, Tabs, Td, Textarea } from '@/components/ui';
import { api, isManager, useApi, useMe } from '@/lib/api';
import { LAYOUTS, THEMES } from '@/lib/catalog';

type Tab = 'overview' | 'details' | 'devices' | 'leads' | 'history';

export default function CardDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data, error, mutate } = useApi<any>(`/cards/${id}`);
  const { data: me } = useMe();
  const [tab, setTab] = useState<Tab>('overview');
  const [share, setShare] = useState(false);
  const [more, setMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  if (error) return <ErrorState error={error} retry={() => mutate()} />;
  if (!data) return <Loading />;
  const c = data.card;
  const canEdit = isManager(me?.user.role);
  const first = (c.fields.name || '').split(' ')[0];

  const act = async (fn: () => Promise<any>, ok: string) => {
    setBusy(true);
    setMore(false);
    try {
      await fn();
      toast(ok);
      mutate();
    } catch (e) {
      toast((e as Error).message, 'err');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="-mt-2 flex flex-col gap-6">
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-[13px] text-stone-2">
        <Link href="/app/cards" className="text-stone-2 hover:text-ink">
          All cards
        </Link>
        <span>/</span>
        <span className="text-ink">{c.fields.name}</span>
      </nav>

      <header className="flex flex-wrap items-center justify-between gap-5">
        <div className="flex items-center gap-4">
          {/* Gold ring avatar, as in the design */}
          <span className="h-16 w-16 shrink-0 rounded-full p-0.5" style={{ background: 'linear-gradient(140deg, #E6D3A3, #9C7A44)' }}>
            {c.fields.photoUrl ? (
              <img src={c.fields.photoUrl} alt="" className="h-full w-full rounded-full border-2 border-white object-cover" />
            ) : (
              <span className="flex h-full w-full items-center justify-center rounded-full border-2 border-white bg-[#F2EEE6] font-display text-[22px] font-semibold text-gold-text">
                {(c.fields.name || '?').split(' ').map((p: string) => p[0]).slice(0, 2).join('')}
              </span>
            )}
          </span>
          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="m-0 font-display text-[40px] font-normal leading-none">{c.fields.name}</h1>
              <StatusBadge status={c.status} />
            </div>
            <p className="m-0 text-[14px] text-stone">
              {[c.fields.title, c.fields.office?.split('·')[0]?.trim(), c.employee?.source && c.employee.source !== 'manual' ? `synced from ${data.sourceLabel}` : null].filter(Boolean).join(' · ')}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2.5">
          {canEdit && (
            <div className="relative">
              <Button onClick={() => setMore((m) => !m)} aria-expanded={more}>
                More
              </Button>
              {more && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setMore(false)} />
                  <div className="vl-fade absolute right-0 top-12 z-40 w-60 rounded-xl border border-line bg-white p-2 shadow-xl">
                    <a href={c.url} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-md px-3 py-2 text-[14px] hover:bg-pearl">
                      <Icon name="external" size={16} /> Open public card
                    </a>
                    <a href={`/api/cards/${c.id}/qr?format=png`} className="flex items-center gap-3 rounded-md px-3 py-2 text-[14px] hover:bg-pearl">
                      <Icon name="download" size={16} /> QR code (PNG)
                    </a>
                    {c.status === 'deactivated' ? (
                      <button onClick={() => act(() => api.post(`/cards/${c.id}/reactivate`), 'Card switched back on')} className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-[14px] hover:bg-pearl">
                        <Icon name="refresh" size={16} /> Reactivate card
                      </button>
                    ) : c.status === 'draft' ? (
                      <button
                        onClick={() =>
                          confirm('Delete this draft?') &&
                          act(async () => {
                            await api.del(`/cards/${c.id}`);
                            window.location.href = '/app/cards';
                          }, 'Draft deleted')
                        }
                        className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-[14px] text-err hover:bg-err-bg"
                      >
                        <Icon name="trash" size={16} /> Delete draft
                      </button>
                    ) : (
                      <button
                        onClick={() => confirm(`Switch off ${first}'s card? The link, wallet pass and NFC card stop working.`) && act(() => api.post(`/cards/${c.id}/deactivate`), 'Card switched off')}
                        className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-[14px] text-err hover:bg-err-bg"
                      >
                        <Icon name="lock" size={16} /> Deactivate card
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
          <Button icon="share" onClick={() => setShare(true)}>
            Share
          </Button>
          {canEdit && (
            <LinkButton href={`/app/create?card=${c.id}&step=2`} variant="ink" icon="edit">
              {c.status === 'draft' ? 'Continue editing' : 'Edit card'}
            </LinkButton>
          )}
        </div>
      </header>

      <Tabs
        items={[
          { id: 'overview', name: 'Overview' },
          { id: 'details', name: 'Details' },
          { id: 'devices', name: 'Devices' },
          { id: 'leads', name: `Leads · ${data.leadCount}` },
          { id: 'history', name: 'History' },
        ]}
        value={tab}
        onChange={setTab}
      />

      {busy && <Loading className="py-4" />}

      {tab === 'overview' && (
        <div className="flex flex-wrap items-start gap-5">
          <div className="flex min-w-0 flex-[1_1_380px] flex-col gap-4">
            <div className="flex flex-col items-center gap-4 rounded-2xl bg-sand p-7">
              <CardFace layout={c.layout} theme={c.theme} fields={c.fields} translations={c.translations} brand={c.brand} width="min(100%, 380px)" />
              <span className="text-[13px] text-stone">
                {LAYOUTS.find((l) => l.id === c.layout)?.name} · {THEMES.find((t) => t.id === c.theme)?.name}
              </span>
            </div>
            <div className="flex items-center gap-4 rounded-[14px] border border-linen bg-white p-[18px]">
              <img src={`/api/cards/${c.id}/qr`} alt={`QR code for ${c.fields.name}`} className="h-[92px] w-[92px] shrink-0 rounded-[10px] border border-linen p-2" />
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <span className="truncate font-mono text-[12.5px] text-ink">{c.displayUrl}</span>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => copyText(c.url)?.then(() => toast('Link copied'))} className="h-[34px] rounded-lg border border-[#E0D9CC] bg-white px-3 text-[13px] text-ink hover:border-ink">
                    Copy link
                  </button>
                  <a href={`/api/cards/${c.id}/qr?format=download`} className="inline-flex h-[34px] items-center rounded-lg border border-[#E0D9CC] bg-white px-3 text-[13px] text-ink hover:border-ink">
                    Download QR
                  </a>
                </div>
              </div>
            </div>
            <div className="overflow-hidden rounded-[14px] border border-linen bg-white">
              <div className="px-[18px] py-4 text-[15px] font-semibold">Where this card lives</div>
              {data.devices.map((d: any, i: number) => (
                <div key={i} className="flex items-center gap-3 border-t border-[#F0EBE2] px-[18px] py-3">
                  <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[9px] bg-gold-tint text-gold-text">
                    <Icon name={({ nfc: 'nfc', wallet: 'dWallet', signature: 'dMail', sync: 'dSync', link: 'dGlobe' } as Record<string, IconName>)[d.kind] || 'link'} size={18} />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-px">
                    <span className="font-medium">{d.name}</span>
                    <span className="truncate text-[12.5px] text-stone-2">{d.sub}</span>
                  </span>
                  <StatusBadge status={d.state} />
                </div>
              ))}
            </div>
          </div>

          <div className="flex min-w-0 flex-[2_1_520px] flex-col gap-4">
            <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(160px, 100%), 1fr))' }}>
              {data.stats.map((s: any) => (
                <div key={s.label} className="flex flex-col gap-2.5 rounded-[14px] border border-linen bg-white p-[18px]">
                  <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-stone-2">{s.label}</span>
                  <span className="font-display text-[36px] font-medium leading-none">{s.value}</span>
                  <span className={cx('text-[12.5px]', s.delta.startsWith('-') ? 'text-err' : 'text-ok')}>{s.delta}</span>
                </div>
              ))}
            </div>
            <section className="flex flex-col gap-4 rounded-[14px] border border-linen bg-white p-[22px]">
              <div className="flex items-baseline justify-between">
                <h2 className="m-0 text-[16px] font-semibold">How people open {first}&rsquo;s card</h2>
                <span className="text-[13px] text-stone-2">Last 30 days</span>
              </div>
              <BarList items={data.channels.map((ch: any) => ({ name: ch.name, value: ch.pct, label: `${ch.pct}%` }))} color={chartColors.GOLD} fade scale="percent" />
            </section>
            <section className="overflow-hidden rounded-[14px] border border-linen bg-white">
              <div className="flex items-center justify-between px-[22px] py-[18px]">
                <h2 className="m-0 text-[16px] font-semibold">Latest leads</h2>
                <button type="button" onClick={() => setTab('leads')} className="text-[13px] font-medium text-gold-text hover:text-ink">
                  All {data.leadCount} leads
                </button>
              </div>
              {data.leads.length === 0 ? (
                <p className="border-t border-[#F0EBE2] px-[22px] py-6 text-[14px] text-stone-2">No leads yet</p>
              ) : (
                data.leads.map((l: any) => (
                  <Link key={l.id} href={`/app/leads?open=${l.id}`} className="flex items-center gap-3.5 border-t border-[#F0EBE2] px-[22px] py-[13px] text-ink hover:bg-[#FAF7F1]">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#F2EEE6] text-[12.5px] font-semibold text-gold-text">{l.ini}</span>
                    <span className="flex min-w-0 flex-1 flex-col gap-px">
                      <span className="font-medium">{l.name}</span>
                      <span className="truncate text-[12.5px] text-stone-2">{l.co}</span>
                    </span>
                    <span className="rounded-full border border-linen px-2.5 py-[3px] text-[12px] text-[#4E4A44]">{l.via}</span>
                    <span className="w-[70px] text-right text-[12.5px] text-stone-2">{l.when}</span>
                  </Link>
                ))
              )}
            </section>
          </div>
        </div>
      )}

      {tab === 'details' && <Details card={c} canEdit={canEdit} />}
      {tab === 'devices' && <Devices cardId={c.id} devices={data.devices} onChange={mutate} canEdit={canEdit} />}
      {tab === 'leads' && <CardLeads id={c.id} />}
      {tab === 'history' && <History id={c.id} />}

      <ShareModal open={share} onClose={() => setShare(false)} card={c} />
    </div>
  );
}

function Details({ card, canEdit }: { card: any; canEdit: boolean }) {
  const rows = [
    ['Name', card.fields.name],
    ['Title', card.fields.title],
    ['Department', card.fields.department],
    ['Office', card.fields.office],
    ['Email', card.fields.email],
    ['Work phone', card.fields.phone],
    ['Mobile', card.fields.mobile],
    ['WhatsApp', card.fields.whatsapp],
    ['Website', card.fields.website],
    ['Address', card.fields.address],
  ];
  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
      <Panel>
        <PanelHeader title="Card details" sub="Fields marked From HR follow your HR system automatically." action={canEdit && <LinkButton size="sm" href={`/app/create?card=${card.id}&step=3`} icon="edit">Edit details</LinkButton>} />
        <dl className="grid gap-x-8 sm:grid-cols-2">
          {rows.map(([k, v]) => {
            const key = String(k).toLowerCase().replace('work phone', 'phone');
            return (
              <div key={k} className="flex flex-col gap-1 border-b border-linen py-3">
                <dt className="flex items-center gap-2 text-[12px] uppercase tracking-[0.12em] text-stone-2">
                  {k}
                  {card.syncedFields.includes(key) && <Badge tone="gold" className="!py-0.5 !text-[10px] normal-case tracking-normal">From HR</Badge>}
                </dt>
                <dd className="text-[15px]">{v || <span className="text-stone-2">—</span>}</dd>
              </div>
            );
          })}
        </dl>
        {card.fields.bio && (
          <div className="mt-5">
            <div className="eyebrow mb-2">About</div>
            <p className="text-[15px] leading-relaxed text-[#4E4A44]">{card.fields.bio}</p>
          </div>
        )}
        {Object.keys(card.translations || {}).length > 0 && (
          <div className="mt-5">
            <div className="eyebrow mb-2">Languages</div>
            {Object.entries(card.translations).map(([lang, t]: any) => (
              <div key={lang} dir={lang === 'ar' ? 'rtl' : 'ltr'} className="rounded-md bg-pearl px-4 py-3 text-[15px]">
                <b className="font-medium">{t.name}</b> {t.title && `· ${t.title}`}
              </div>
            ))}
          </div>
        )}
      </Panel>
      <PhoneFrame height={600}>
        <OnlineCard card={card} preview />
      </PhoneFrame>
    </div>
  );
}

function Devices({ cardId, devices, onChange, canEdit }: { cardId: string; devices: any[]; onChange: () => void; canEdit: boolean }) {
  const toast = useToast();
  const nfc = devices.filter((d) => d.id);
  const set = async (id: string, status: string) => {
    try {
      await api.patch(`/nfc/devices/${id}`, { status });
      toast(status === 'active' ? 'NFC card switched on' : 'NFC card switched off');
      onChange();
    } catch (e) {
      toast((e as Error).message, 'err');
    }
  };
  return (
    <Panel>
      <PanelHeader title="Devices" sub="Everywhere this card can be opened" action={canEdit && <LinkButton size="sm" href={`/app/nfc?order=${cardId}`} icon="plus">Order NFC card</LinkButton>} />
      <ul className="flex flex-col divide-y divide-linen">
        {devices.map((d, i) => (
          <li key={i} className="flex flex-wrap items-center gap-3 py-4">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-pearl text-gold-text">
              <Icon name={d.name.startsWith('NFC') ? 'nfc' : d.name.startsWith('Wallet') ? 'wallet' : d.name.startsWith('Email') ? 'mail' : 'globe'} size={18} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-medium">{d.name}</span>
              <span className="block text-[13px] text-stone-2">{d.sub}</span>
            </span>
            <StatusBadge status={d.state} />
            {d.id && canEdit && (
              <div className="flex gap-2">
                {d.state === 'Active' ? (
                  <>
                    <Button size="sm" onClick={() => set(d.id, 'disabled')}>Switch off</Button>
                    <Button size="sm" variant="danger" onClick={() => set(d.id, 'lost')}>Report lost</Button>
                  </>
                ) : (
                  <Button size="sm" onClick={() => set(d.id, 'active')}>Switch on</Button>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
      {!nfc.length && <p className="mt-2 text-[13px] text-stone-2">No NFC card yet. Order one engraved from your brand kit.</p>}
    </Panel>
  );
}

function CardLeads({ id }: { id: string }) {
  const { data } = useApi<any[]>(`/cards/${id}/leads`);
  if (!data) return <Loading />;
  if (!data.length) return <Panel><Empty icon="leads" title="No leads yet" desc="When someone shares their details from this card, they appear here." /></Panel>;
  return (
    <Panel pad={false}>
      <Table head={['Lead', 'Email', 'Via', 'When', 'Status']}>
        {data.map((l) => (
          <tr key={l.id} className="hover:bg-pearl">
            <Td>
              <Link href={`/app/leads?open=${l.id}`} className="flex items-center gap-3">
                <Avatar name={l.name} size={32} />
                <span>
                  <span className="block font-medium">{l.name}</span>
                  <span className="block text-[13px] text-stone-2">{l.co}</span>
                </span>
              </Link>
            </Td>
            <Td className="text-stone">{l.email}</Td>
            <Td className="text-stone">{l.via}</Td>
            <Td className="text-stone">{l.when}</Td>
            <Td>
              <StatusBadge status={l.status} />
            </Td>
          </tr>
        ))}
      </Table>
    </Panel>
  );
}

function History({ id }: { id: string }) {
  const { data } = useApi<any[]>(`/cards/${id}/history`);
  if (!data) return <Loading />;
  return (
    <Panel>
      <PanelHeader title="History" sub="Every change to this card, newest first" />
      {data.length === 0 ? (
        <p className="py-6 text-center text-[14px] text-stone-2">No history yet</p>
      ) : (
        <ol className="relative ml-2 border-l border-line">
          {data.map((h) => (
            <li key={h.id} className="mb-5 ml-5">
              <span className="absolute -left-[5px] mt-1.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-gold" />
              <div className="text-[14px]">{h.text}</div>
              <div className="text-[12px] text-stone-2">
                {h.actor} · {new Date(h.at).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </div>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}

function ShareModal({ open, onClose, card }: { open: boolean; onClose: () => void; card: any }) {
  const toast = useToast();
  const [sig, setSig] = useState<string | null>(null);
  const loadSig = async () => setSig((await api.get(`/cards/${card.id}/signature`)).html);
  return (
    <Modal open={open} onClose={onClose} title="Share this card" wide>
      <div className="grid gap-6 sm:grid-cols-[200px_1fr]">
        <div className="flex flex-col items-center gap-3">
          <img src={`/api/cards/${card.id}/qr`} alt={`QR code for ${card.fields.name}`} className="w-full rounded-lg border border-line bg-white p-3" />
          <LinkButton size="sm" href={`/api/cards/${card.id}/qr?format=png`} icon="download" className="w-full">
            PNG for print
          </LinkButton>
        </div>
        <div className="flex flex-col gap-5">
          <div>
            <div className="mb-2 text-[13px] font-medium">Card link</div>
            <div className="flex gap-2">
              <div className="flex h-11 min-w-0 flex-1 items-center rounded-md border border-line bg-pearl px-3 font-mono text-[13px]">
                <span className="truncate">{card.displayUrl}</span>
              </div>
              <Button icon="copy" onClick={() => copyText(card.url)?.then(() => toast('Link copied'))}>
                Copy
              </Button>
            </div>
            <p className="mt-2 text-[12px] text-stone-2">This link never changes, even when the title does.</p>
          </div>
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[13px] font-medium">Email signature</span>
              {!sig && (
                <Button size="sm" onClick={loadSig}>
                  Show
                </Button>
              )}
            </div>
            {sig && (
              <>
                <div className="rounded-md border border-line bg-white p-4" dangerouslySetInnerHTML={{ __html: sig }} />
                <div className="mt-2 flex gap-2">
                  <Button
                    size="sm"
                    icon="copy"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.write([new ClipboardItem({ 'text/html': new Blob([sig], { type: 'text/html' }), 'text/plain': new Blob([sig], { type: 'text/plain' }) })]);
                      } catch {
                        await copyText(sig);
                      }
                      toast('Signature copied. Paste it into Outlook or Gmail settings.');
                    }}
                  >
                    Copy signature
                  </Button>
                </div>
              </>
            )}
          </div>
          <div>
            <div className="mb-2 text-[13px] font-medium">Send to {card.fields.name?.split(' ')[0]}</div>
            <Textarea readOnly rows={2} value={`Your card is ready: ${card.url}`} />
          </div>
        </div>
      </div>
    </Modal>
  );
}
