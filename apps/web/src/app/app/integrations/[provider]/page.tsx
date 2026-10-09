'use client';

import Link from 'next/link';
import { use, useEffect, useState } from 'react';
import { Icon } from '@/components/icons';
import { useToast } from '@/components/toast';
import { Badge, Button, Callout, copyText, cx, ErrorState, Field, Input, Loading, Panel, PanelHeader, Select, Table, Td } from '@/components/ui';
import { api, isAdmin, useApi, useMe } from '@/lib/api';

export default function Connect({ params }: { params: Promise<{ provider: string }> }) {
  const { provider } = use(params);
  const { data, error, mutate } = useApi<any>(`/integrations/${provider}`);
  const { data: me } = useMe();
  const [step, setStep] = useState<number | null>(null);
  const toast = useToast();

  useEffect(() => {
    if (data && step === null) setStep(data.connected ? Math.max(Math.min(data.step, 4), 2) : 1);
  }, [data, step]);

  if (error) return <ErrorState error={error} retry={() => mutate()} />;
  if (!data || step === null) return <Loading />;
  const p = data.provider;
  const admin = isAdmin(me?.user.role);

  const go = async (s: number) => {
    setStep(s);
    if (admin) await api.patch(`/integrations/${provider}`, { step: s }).catch(() => {});
  };

  const disconnect = async () => {
    if (!confirm(`Disconnect ${p.name}? Existing cards stay as they are; syncing stops.`)) return;
    await api.post(`/integrations/${provider}/disconnect`);
    toast(`${p.name} disconnected`);
    mutate();
    setStep(1);
  };

  return (
    <div>
      <nav aria-label="Breadcrumb" className="mb-4 flex items-center gap-2 text-[13px] text-stone">
        <Link href="/app/integrations" className="hover:text-ink">
          HR integrations
        </Link>
        <span>/</span>
        <span className="text-ink">{p.name}</span>
      </nav>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-[40px] leading-tight">Connect {p.name}</h1>
            {data.connected && <Badge tone="ok">{p.scim ? 'Provisioning on' : 'Signed in'}</Badge>}
            {data.status === 'paused' && <Badge tone="warn">Paused</Badge>}
          </div>
          <p className="mt-1 max-w-2xl text-[15px] text-stone">Tell Vellaire which {p.name} field fills which part of the card. Once saved, new hires get cards automatically.</p>
        </div>
        <div className="flex gap-2">
          {data.connected && admin && (
            <Button variant="ghost" onClick={disconnect}>
              Disconnect
            </Button>
          )}
          <Link href="/app/integrations" className="inline-flex h-11 items-center rounded-md border border-line-strong bg-white px-4 text-[14px] font-medium hover:border-ink">
            Save and finish later
          </Link>
        </div>
      </header>

      {data.lastError && (
        <div className="mb-6">
          <Callout tone={data.status === 'paused' ? 'warn' : 'err'} icon="alert">
            {data.lastError}
          </Callout>
        </div>
      )}

      {!p.scim && (
        <ol className="mb-6 grid grid-cols-2 gap-x-3 gap-y-2 sm:grid-flow-col sm:grid-cols-none" aria-label="Steps">
          {/* "Choose system" is always done here: it is the integrations list we came from */}
          {['Choose system', ...data.steps].map((s: string, n: number) => {
            const done = n < step;
            const reached = n <= step;
            const can = n === 0 || n === 1 || data.connected;
            const cls = cx(
              'flex w-full items-center gap-2.5 border-t-2 pt-3 text-left text-[13.5px]',
              reached ? 'border-gold text-ink' : 'border-linen text-stone-2',
              step === n && 'font-semibold',
            );
            const body = (
              <>
                <span
                  className={cx(
                    'flex h-5.5 w-5.5 shrink-0 items-center justify-center rounded-full text-[11px]',
                    done ? 'bg-gold text-white' : step === n ? 'border border-gold text-gold-text' : 'border border-[#D9D2C4]',
                  )}
                >
                  {done ? <Icon name="check" size={12} strokeWidth={2.2} /> : n + 1}
                </span>
                {s}
              </>
            );
            return (
              <li key={s}>
                {n === 0 ? (
                  <Link href="/app/integrations" className={cls}>
                    {body}
                  </Link>
                ) : (
                  <button type="button" disabled={!can} onClick={() => go(n)} aria-current={step === n ? 'step' : undefined} className={cx(cls, !can && 'opacity-50')}>
                    {body}
                  </button>
                )}
              </li>
            );
          })}
        </ol>
      )}

      {p.scim ? (
        <ScimSetup data={data} admin={admin} onChange={mutate} />
      ) : step === 1 ? (
        <SignIn
          data={data}
          provider={provider}
          admin={admin}
          onDone={() => {
            mutate();
            setStep(2);
          }}
        />
      ) : step === 2 ? (
        <Mapping data={data} provider={provider} admin={admin} onChange={mutate} onNext={() => go(3)} />
      ) : step === 3 ? (
        <Rules
          data={data}
          provider={provider}
          admin={admin}
          onNext={() => {
            mutate();
            go(4);
          }}
        />
      ) : (
        <Review data={data} provider={provider} admin={admin} onDone={mutate} />
      )}
    </div>
  );
}

function SignIn({ data, provider, admin, onDone }: { data: any; provider: string; admin: boolean; onDone: () => void }) {
  const [f, setF] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const connect = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await api.post(`/integrations/${provider}/connect`, f);
      toast(`Connected · ${r.workers.toLocaleString()} workers found`);
      onDone();
    } catch (err) {
      toast((err as Error).message, 'err');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Panel className="max-w-2xl">
      <PanelHeader title={`Sign in to ${data.provider.name}`} sub="Credentials are stored encrypted and only used to read worker records." />
      {data.connected && (
        <div className="mb-4">
          <Callout tone="ok" icon="checkCircle">
            Already connected{data.accountName ? ` as ${data.accountName}` : ''}. Enter new credentials only to replace them.
          </Callout>
        </div>
      )}
      <form onSubmit={connect} className="flex flex-col gap-4">
        {data.provider.fields.map((fl: any) => (
          <Field key={fl.key} label={fl.label}>
            {(id) => (
              <Input
                id={id}
                type={fl.secret ? 'password' : 'text'}
                placeholder={fl.placeholder}
                value={f[fl.key] || ''}
                onChange={(e) => setF({ ...f, [fl.key]: e.target.value })}
                required={!data.connected}
                disabled={!admin}
              />
            )}
          </Field>
        ))}
        <div className="flex gap-2">
          <Button type="submit" variant="ink" loading={busy} disabled={!admin}>
            {data.connected ? 'Reconnect and refresh fields' : 'Connect'}
          </Button>
        </div>
      </form>
    </Panel>
  );
}

function Mapping({ data, provider, admin, onChange, onNext }: { data: any; provider: string; admin: boolean; onChange: () => void; onNext: () => void }) {
  const [rows, setRows] = useState<any[]>(data.mapping);
  const [busy, setBusy] = useState<string | null>(null);
  const toast = useToast();
  useEffect(() => setRows(data.mapping), [data.mapping]);
  const aiOpen = rows.filter((r) => r.match === 'ai' && !r.accepted).length;
  const unmatched = rows.filter((r) => !r.dst).length;

  const update = (i: number, patch: any) => setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const save = async (next = false) => {
    setBusy('save');
    try {
      await api.patch(`/integrations/${provider}`, { mapping: rows });
      onChange();
      if (next) onNext();
      else toast('Mapping saved');
    } catch (e) {
      toast((e as Error).message, 'err');
    } finally {
      setBusy(null);
    }
  };
  const acceptAi = async () => {
    setBusy('accept');
    await api.post(`/integrations/${provider}/accept-ai`);
    setRows(rows.map((r) => (r.match === 'ai' ? { ...r, accepted: true } : r)));
    onChange();
    setBusy(null);
  };
  const aiMatch = async () => {
    setBusy('ai');
    try {
      const r = await api.post(`/integrations/${provider}/ai-match`);
      toast(`${r.matched} fields matched by AI. Review the gold rows.`);
      onChange();
    } catch (e) {
      toast((e as Error).message, 'err');
    } finally {
      setBusy(null);
    }
  };

  return (
    <Panel pad={false}>
      <div className="flex flex-wrap items-start justify-between gap-3 p-5">
        <div>
          <h2 className="text-[16px] font-semibold">Map {data.provider.name} fields to card fields</h2>
          <p className="text-[13px] text-stone-2">
            {aiOpen ? 'Gold rows were matched by AI. Review, then accept.' : 'Common fields are matched automatically. Adjust anything that looks wrong.'}
          </p>
        </div>
        <div className="flex gap-2">
          {data.aiEnabled && unmatched > 0 && admin && (
            <Button size="sm" variant="gold" icon="sparkle" loading={busy === 'ai'} onClick={aiMatch}>
              Match the rest with AI
            </Button>
          )}
          {aiOpen > 0 && admin && (
            <Button size="sm" icon="sparkle" loading={busy === 'accept'} onClick={acceptAi} className="border-gold-line bg-[#FBF6EC] text-gold-text hover:border-gold">
              Accept {aiOpen} AI matches
            </Button>
          )}
        </div>
      </div>
      <Table head={[`${data.provider.name} field`, { label: '', className: 'w-8' }, 'Card field', 'Source of truth', 'Match']}>
        {rows.map((r, i) => (
          <tr key={r.src} className={cx('border-t border-[#F0EBE2]', r.match === 'ai' && !r.accepted && 'bg-[#FBF6EC]')}>
            <Td>
              <div className="font-mono text-[12.5px]">{r.src}</div>
              <div className="truncate text-[12px] text-stone-2">{r.sample || '—'}</div>
            </Td>
            <Td className="px-0 text-[#B5AEA2]">
              <Icon name="arrow" size={15} />
            </Td>
            <Td>
              <Select
                aria-label={`Card field for ${r.src}`}
                value={r.dst}
                disabled={!admin}
                onChange={(e) =>
                  update(i, {
                    dst: e.target.value,
                    match: 'manual',
                    accepted: true,
                  })
                }
                className="min-w-[170px] [&>select]:h-9 [&>select]:text-[13px]"
              >
                <option value="">Do not use</option>
                {data.targets.map((t: any) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </Select>
            </Td>
            <Td>
              <div
                role="radiogroup"
                aria-label={`Source of truth for ${r.src}`}
                className={cx('inline-flex rounded-md border border-linen bg-pearl p-0.5', (!admin || !r.dst) && 'opacity-50')}
              >
                {(
                  [
                    ['hr', data.provider.name],
                    ['employee', 'Employee'],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    role="radio"
                    aria-checked={r.sourceOfTruth === id}
                    disabled={!admin || !r.dst}
                    onClick={() => update(i, { sourceOfTruth: id })}
                    className={cx('h-7 rounded px-2.5 text-[12px]', r.sourceOfTruth === id ? 'bg-ink text-white' : 'text-stone hover:text-ink')}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </Td>
            <Td className="whitespace-nowrap text-[12.5px]">
              {!r.dst ? (
                <span className="text-stone-2">Not used</span>
              ) : r.match === 'ai' ? (
                <span className="flex items-center gap-2 text-gold-text">
                  AI match
                  {!r.accepted && admin && (
                    <button type="button" className="font-medium underline hover:text-ink" onClick={() => update(i, { accepted: true })}>
                      Accept
                    </button>
                  )}
                </span>
              ) : r.match === 'auto' ? (
                <span className="text-ok">Exact match</span>
              ) : (
                <span className="text-stone">Set manually</span>
              )}
            </Td>
          </tr>
        ))}
      </Table>
      <div className="flex flex-wrap justify-end gap-2 border-t border-line p-4">
        {admin && (
          <>
            <Button onClick={() => save(false)} loading={busy === 'save'}>
              Save
            </Button>
            <Button variant="ink" iconRight="arrow" onClick={() => save(true)} loading={busy === 'save'}>
              Continue to rules
            </Button>
          </>
        )}
      </div>
    </Panel>
  );
}

const COUNTRIES = ['United Arab Emirates', 'Saudi Arabia', 'Qatar', 'Kuwait', 'Bahrain', 'Oman', 'Egypt', 'Jordan', 'United Kingdom', 'Pakistan', 'India'];

function Rules({ data, provider, admin, onNext }: { data: any; provider: string; admin: boolean; onNext: () => void }) {
  const [r, setR] = useState(() => ({
    templateByCountry: data.rules.templateByCountry?.length ? data.rules.templateByCountry : [],
    skipWorkerTypes: data.rules.skipWorkerTypes || [],
    joinersToApproval: data.rules.joinersToApproval ?? true,
  }));
  const [guard, setGuard] = useState(data.guardPct);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const save = async () => {
    setBusy(true);
    try {
      await api.patch(`/integrations/${provider}`, {
        rules: r,
        guardPct: guard,
      });
      onNext();
    } catch (e) {
      toast((e as Error).message, 'err');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Panel className="max-w-3xl">
      <PanelHeader title="Rules" sub="Decide what happens to each worker before a card is made" />
      <div className="flex flex-col gap-4">
        {r.templateByCountry.map((rule: any, i: number) => (
          <div key={i} className="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-pearl p-3 text-[14px]">
            <span className="font-medium">If</span>
            <Badge>Country</Badge>
            <span>is</span>
            <Select
              aria-label="Country"
              value={rule.countries[0] || ''}
              disabled={!admin}
              onChange={(e) =>
                setR({
                  ...r,
                  templateByCountry: r.templateByCountry.map((x: any, j: number) => (j === i ? { ...x, countries: [e.target.value] } : x)),
                })
              }
              className="w-52"
            >
              {COUNTRIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Select>
            <span>use layout</span>
            <Select
              aria-label="Layout"
              value={rule.layout}
              disabled={!admin}
              onChange={(e) =>
                setR({
                  ...r,
                  templateByCountry: r.templateByCountry.map((x: any, j: number) => (j === i ? { ...x, layout: e.target.value } : x)),
                })
              }
              className="w-48"
            >
              {data.layouts.map((l: any) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </Select>
            {admin && (
              <button
                type="button"
                aria-label="Remove rule"
                className="ml-auto text-stone hover:text-err"
                onClick={() =>
                  setR({
                    ...r,
                    templateByCountry: r.templateByCountry.filter((_: any, j: number) => j !== i),
                  })
                }
              >
                <Icon name="trash" size={16} />
              </button>
            )}
          </div>
        ))}
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-pearl p-3 text-[14px]">
          <span className="font-medium">Skip workers whose</span>
          <Badge>Worker type</Badge>
          <span>is</span>
          <Input
            aria-label="Worker types to skip"
            value={r.skipWorkerTypes.join(', ')}
            disabled={!admin}
            onChange={(e) =>
              setR({
                ...r,
                skipWorkerTypes: e.target.value
                  .split(',')
                  .map((s) => s.trim())
                  .filter(Boolean),
              })
            }
            className="w-64"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-pearl p-3 text-[14px]">
          <span className="font-medium">New joiners go to</span>
          <Select
            aria-label="New joiners"
            value={r.joinersToApproval ? 'approval' : 'publish'}
            disabled={!admin}
            onChange={(e) => setR({ ...r, joinersToApproval: e.target.value === 'approval' })}
            className="w-52"
          >
            <option value="approval">Approval queue</option>
            <option value="publish">Publish on start date</option>
          </Select>
          <span>before publishing</span>
        </div>
        {admin && (
          <Button
            size="sm"
            icon="plus"
            className="self-start"
            onClick={() =>
              setR({
                ...r,
                templateByCountry: [...r.templateByCountry, { countries: ['Saudi Arabia'], layout: 'arabic' }],
              })
            }
          >
            Add rule
          </Button>
        )}
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line p-4">
          <span className="text-[14px]">
            <span className="font-medium">Sync guard</span>
            <span className="block text-[13px] text-stone-2">Pause any sync that would switch off more than this share of cards</span>
          </span>
          <span className="flex items-center gap-2">
            <Input aria-label="Guard percent" type="number" min={1} max={100} value={guard} disabled={!admin} onChange={(e) => setGuard(Number(e.target.value))} className="w-20" />
            %
          </span>
        </div>
      </div>
      {admin && (
        <div className="mt-6 flex justify-end">
          <Button variant="ink" iconRight="arrow" loading={busy} onClick={save}>
            Continue to review
          </Button>
        </div>
      )}
    </Panel>
  );
}

function Review({ data, provider, admin, onDone }: { data: any; provider: string; admin: boolean; onDone: () => void }) {
  const [plan, setPlan] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<any>(null);
  const toast = useToast();

  useEffect(() => {
    if (!admin) return;
    api
      .post(`/integrations/${provider}/dry-run`)
      .then(setPlan)
      .catch((e) => toast(e.message, 'err'));
  }, [provider, admin, toast]);

  const start = async (force = false) => {
    setBusy(true);
    try {
      const r = await api.post(`/integrations/${provider}/sync`, { force });
      setResult(r);
      toast(r.status === 'paused' ? 'Sync paused by the guard' : 'Sync finished', r.status === 'paused' ? 'info' : 'ok');
      onDone();
      setPlan(await api.post(`/integrations/${provider}/dry-run`));
    } catch (e) {
      toast((e as Error).message, 'err');
    } finally {
      setBusy(false);
    }
  };

  if (!admin) return <Callout>Only admins can run a sync.</Callout>;
  if (!plan) return <Loading />;
  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
      <Panel>
        <PanelHeader title="Dry run preview" sub="Nothing changes until you start the sync." />
        <div className="grid gap-3 sm:grid-cols-4">
          {[
            [plan.create, 'to create'],
            [plan.update, 'to update'],
            [plan.leave, 'to switch off'],
            [plan.skipped, 'skipped'],
          ].map(([n, l]) => (
            <div key={l as string} className="rounded-lg bg-pearl p-4">
              <div className="font-display text-[34px] leading-none">{Number(n).toLocaleString()}</div>
              <div className="mt-1 text-[13px] text-stone">{l}</div>
            </div>
          ))}
        </div>
        <div className="mt-5 flex flex-col gap-3">
          {plan.issues.map((i: string) => (
            <Callout key={i} tone="warn" icon="alert">
              {i}
            </Callout>
          ))}
          {plan.guardTripped ? (
            <Callout tone="err" icon="shield">
              {plan.guardMessage}
            </Callout>
          ) : (
            <Callout tone="gold" icon="shield">
              Sync guard is on. Syncs that would remove more than {plan.guardPct}% of cards pause for your review.
            </Callout>
          )}
        </div>
        <div className="mt-6 grid gap-5 md:grid-cols-2">
          {(
            [
              ['New cards', plan.preview.create.map((x: any) => `${x.name}${x.title ? ` · ${x.title}` : ''}`)],
              ['Updates', plan.preview.update.map((x: any) => `${x.name} · ${x.changes.join(', ')}`)],
              ['Switched off (left)', plan.preview.leave.map((x: any) => `${x.name}${x.title ? ` · ${x.title}` : ''}`)],
              ['Skipped', plan.preview.skipped.map((x: any) => `${x.name} · ${x.reason}`)],
            ] as const
          ).map(([t, list]) =>
            list.length ? (
              <div key={t}>
                <div className="eyebrow mb-2">{t}</div>
                <ul className="flex flex-col gap-1 text-[14px] text-stone">
                  {list.map((x: string) => (
                    <li key={x} className="truncate">
                      {x}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null,
          )}
        </div>
      </Panel>
      <aside className="flex flex-col gap-4 xl:sticky xl:top-24 xl:self-start">
        <Panel>
          <Button variant="ink" size="lg" className="w-full" icon="sync" loading={busy} onClick={() => start(false)}>
            Start sync
          </Button>
          {plan.guardTripped && (
            <Button variant="danger" className="mt-2 w-full" disabled={busy} onClick={() => confirm('Run the sync anyway and switch off these cards?') && start(true)}>
              Override guard and sync
            </Button>
          )}
          <p className="mt-3 text-[13px] text-stone-2">
            After this, {data.provider.name} syncs every hour on its own.
            {data.lastSync ? ` Last sync ${data.lastSync}.` : ''}
          </p>
        </Panel>
        {result && (
          <Panel>
            <PanelHeader title={result.status === 'paused' ? 'Sync paused' : 'Sync finished'} />
            <ul className="flex flex-col gap-1 text-[14px]">
              <li>{result.created} cards created</li>
              <li>{result.updated} people updated</li>
              <li>{result.deactivated} cards switched off</li>
              <li>{result.skipped} skipped</li>
            </ul>
            <Link href="/app/integrations/activity" className="mt-3 inline-block text-[14px] text-gold-text underline">
              See sync activity
            </Link>
          </Panel>
        )}
      </aside>
    </div>
  );
}

function ScimSetup({ data, admin, onChange }: { data: any; admin: boolean; onChange: () => void }) {
  const [token, setToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const create = async () => {
    if (data.scimConfigured && !confirm('Create a new token? The old one stops working.')) return;
    setBusy(true);
    try {
      const r = await api.post('/integrations/scim/token');
      setToken(r.token);
      onChange();
    } catch (e) {
      toast((e as Error).message, 'err');
    } finally {
      setBusy(false);
    }
  };
  const Copy = ({ v, label }: { v: string; label: string }) => (
    <div>
      <div className="mb-1.5 text-[13px] font-medium">{label}</div>
      <div className="flex gap-2">
        <div className="flex h-11 min-w-0 flex-1 items-center rounded-md border border-line bg-pearl px-3 font-mono text-[13px]">
          <span className="truncate">{v}</span>
        </div>
        <Button icon="copy" onClick={() => copyText(v)?.then(() => toast('Copied'))}>
          Copy
        </Button>
      </div>
    </div>
  );
  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
      <Panel>
        <PanelHeader title="Automatic provisioning with SCIM" sub="Entra ID creates, updates and removes people in Vellaire as you change them in Microsoft." />
        <div className="flex flex-col gap-5">
          <Copy v={data.scimUrl} label="Tenant URL" />
          {token ? (
            <>
              <Copy v={token} label="Secret token" />
              <Callout tone="warn" icon="lock">
                Copy the token now. For your security it is shown only once.
              </Callout>
            </>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="ink" icon="lock" loading={busy} disabled={!admin} onClick={create}>
                {data.scimConfigured ? 'Create a new token' : 'Create token'}
              </Button>
              {data.scimConfigured && <span className="text-[13px] text-ok">A token is active</span>}
            </div>
          )}
        </div>
      </Panel>
      <Panel>
        <PanelHeader title="In the Entra admin centre" />
        <ol className="flex list-decimal flex-col gap-2 pl-5 text-[14px] text-stone">
          <li>Enterprise applications → New application → Create your own (non-gallery).</li>
          <li>Provisioning → Automatic. Paste the Tenant URL and Secret token, then Test connection.</li>
          <li>Map userPrincipalName to userName, and department, jobTitle as needed.</li>
          <li>Assign the groups who should get cards and turn provisioning on.</li>
        </ol>
      </Panel>
    </div>
  );
}
