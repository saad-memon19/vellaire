'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { CardFace } from '@/components/card/card-face';
import { OnlineCard, PhoneFrame } from '@/components/card/online-card';
import { Icon, IconName, Seal } from '@/components/icons';
import { useToast } from '@/components/toast';
import { Avatar, Badge, Button, cx, Field, IconButton, Input, LinkButton, Loading, Modal, Select, Spinner, Textarea, Toggle } from '@/components/ui';
import { api, qs, useApi, useMe } from '@/lib/api';
import { LANGS, LAYOUTS, LINK_TYPES, MATERIALS, resolveTheme, THEMES } from '@/lib/catalog';

const STEPS = ['Person', 'Design', 'Details', 'Publish'];

export default function Page() {
  return (
    <Suspense fallback={<Loading />}>
      <CreateCard />
    </Suspense>
  );
}

function CreateCard() {
  const params = useSearchParams();
  const router = useRouter();
  const cardId = params.get('card');
  const step = Math.min(Math.max(Number(params.get('step')) || 1, 1), 4);
  const { data: me } = useMe();
  const { data, mutate } = useApi<any>(cardId ? `/cards/${cardId}` : null);
  const card = data?.card;
  const [draft, setDraft] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  // Local editable copy of the card
  useEffect(() => {
    if (card && (!draft || draft.id !== card.id)) setDraft(structuredClone(card));
  }, [card, draft]);

  const go = (s: number, id = cardId) => router.push(`/app/create${qs({ card: id, step: s })}`);

  const save = async (silent = false) => {
    if (!draft) return true;
    setSaving(true);
    try {
      const { id, layout, theme, cover, fields, translations, links, delivery, slug } = draft;
      await api.patch(`/cards/${id}`, { layout, theme, cover, fields, translations, links, delivery, slug });
      await mutate();
      if (!silent) toast('Saved as draft');
      return true;
    } catch (e) {
      toast((e as Error).message, 'err');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const set = (patch: any) => setDraft((d: any) => ({ ...d, ...patch }));
  const setField = (k: string, v: string) => setDraft((d: any) => ({ ...d, fields: { ...d.fields, [k]: v } }));

  const company = me?.company;
  const isEdit = card && card.status !== 'draft';

  return (
    <div className="flex min-h-screen flex-col bg-pearl">
      {/* Wizard header, as designed: close · title · steps · save */}
      <header className="sticky top-0 z-20 flex flex-wrap items-center gap-7 border-b border-linen bg-white px-4 py-3.5 sm:px-8">
        <div className="flex items-center gap-4">
          <IconButton icon="x" label="Close" onClick={() => router.push(cardId ? `/app/cards/${cardId}` : '/app/cards')} className="border border-linen" />
          <div className="flex flex-col gap-px">
            <span className="font-display text-[24px] font-medium leading-[1.1]">{isEdit ? `Edit ${card.fields.name}'s card` : 'Create a card'}</span>
            <span className="text-[12px] text-stone-2">{company?.name}</span>
          </div>
        </div>
          <ol className="mx-auto flex items-center gap-1 sm:gap-3" aria-label="Steps">
            {STEPS.map((s, i) => {
              const n = i + 1;
              const reachable = n === 1 ? !cardId : !!cardId;
              return (
                <li key={s} className="flex items-center gap-1 sm:gap-3">
                  {i > 0 && <span className={cx('h-px w-4 sm:w-10', n <= step ? 'bg-gold' : 'bg-linen')} />}
                  <button
                    type="button"
                    disabled={!reachable || n === step}
                    onClick={async () => (await save(true)) && go(n)}
                    aria-current={n === step ? 'step' : undefined}
                    className={cx('flex items-center gap-2.5 text-[14px]', n === step ? 'font-semibold text-ink' : 'text-stone-2', reachable && n !== step && 'hover:text-ink')}
                  >
                    <span
                      className={cx(
                        'flex h-7 w-7 items-center justify-center rounded-full text-[12px] font-semibold',
                        n < step || (cardId && n === 1) ? 'bg-gold text-white' : n === step ? 'bg-ink text-white' : 'border border-line-strong',
                      )}
                    >
                      {n < step || (cardId && n === 1 && step > 1) ? <Icon name="check" size={14} /> : n}
                    </span>
                    <span className="hidden md:inline">{s}</span>
                  </button>
                </li>
              );
            })}
          </ol>
          <Button className="h-10" onClick={() => save()} loading={saving} disabled={!cardId}>
            {isEdit ? 'Save' : 'Save as draft'}
          </Button>
      </header>

      {step === 1 && !cardId ? (
        <StepPerson onCreated={(id) => go(2, id)} brand={{ companyName: company?.name }} />
      ) : !draft ? (
        <Loading />
      ) : (
        <WizardBody aside={<Preview draft={draft} step={step} />}>
          {step === 1 && <StepPersonDone card={draft} />}
          {step === 2 && <StepDesign draft={draft} set={set} company={company} />}
          {step === 3 && <StepDetails draft={draft} set={set} setField={setField} />}
          {step === 4 && <StepPublish draft={draft} set={set} employee={card.employee} isEdit={!!isEdit} />}
        </WizardBody>
      )}

      {(cardId || step > 1) && (
        <WizardFooter>
            <Button icon="back" className="h-[46px] px-5" onClick={async () => (step <= 2 ? router.push(cardId ? `/app/cards/${cardId}` : '/app/cards') : (await save(true)) && go(step - 1))}>
              {step <= 2 ? 'Cancel' : 'Back'}
            </Button>
            <span className="hidden text-[13px] text-stone-2 sm:block">
              Step {step} of 4 · {STEPS[step - 1]}
            </span>
            {step < 4 ? (
              <Button variant="ink" iconRight="arrow" loading={saving} onClick={async () => (await save(true)) && go(step + 1)}>
                Continue to {STEPS[step].toLowerCase()}
              </Button>
            ) : (
              <PublishButton draft={draft} save={save} isEdit={!!isEdit} />
            )}
        </WizardFooter>
      )}
    </div>
  );
}

/* Wizard layout: form column on the left, full-height sand preview on the right (as designed) */
function WizardBody({ children, aside }: { children: React.ReactNode; aside: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-wrap">
      <main className="flex min-w-0 flex-[3_1_560px] justify-center px-5 pb-32 pt-11 sm:px-12">
        <div className="flex w-full max-w-[720px] flex-col gap-7">{children}</div>
      </main>
      <aside aria-label="Live preview" className="flex min-w-0 flex-[2_1_380px] flex-col items-center gap-[22px] border-l border-line bg-sand px-6 py-11 sm:px-10">
        <div className="flex items-center justify-between self-stretch">
          <span className="text-[12px] font-medium tracking-[0.2em] text-stone-2">LIVE PREVIEW</span>
          <span className="text-[12px] text-stone-2">Updates as you type</span>
        </div>
        <div className="flex w-full max-w-[440px] flex-col items-center gap-[22px] xl:sticky xl:top-28">{aside}</div>
      </aside>
    </div>
  );
}

function WizardFooter({ children }: { children: React.ReactNode }) {
  return <footer className="sticky bottom-0 z-20 flex flex-wrap items-center justify-between gap-4 border-t border-linen bg-white px-4 py-3.5 sm:px-8">{children}</footer>;
}

/* ---------------- Step 1 · Person ---------------- */

function StepPerson({ onCreated, brand }: { onCreated: (id: string) => void; brand: any }) {
  const [mode, setMode] = useState<'existing' | 'new' | 'many'>('existing');
  const [filter, setFilter] = useState<'no-card' | 'all' | 'joined'>('no-card');
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState<any>(null);
  const [person, setPerson] = useState({ name: '', title: '', department: '', office: '', email: '', phone: '' });
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const { data } = useApi<any>(mode === 'existing' ? `/employees${qs({ filter: filter === 'all' ? '' : filter, q, limit: 8 })}` : null);

  const create = async () => {
    setBusy(true);
    try {
      const card = await api.post('/cards', mode === 'existing' ? { employeeId: selected.id } : { person: { ...person, email: person.email || undefined } });
      onCreated(card.id);
    } catch (e) {
      toast((e as Error).message, 'err');
      setBusy(false);
    }
  };

  const bulk = async () => {
    if (!confirm('Create and publish cards for everyone who does not have one yet?')) return;
    setBusy(true);
    try {
      const r = await api.post('/cards/bulk', { allWithoutCard: true, publish: true });
      toast(`${r.created} cards created`);
      window.location.href = '/app/cards';
    } catch (e) {
      toast((e as Error).message, 'err');
      setBusy(false);
    }
  };

  const options: { id: typeof mode; title: string; sub: string; icon: IconName }[] = [
    { id: 'existing', title: 'An existing employee', sub: `Choose from ${data?.people?.toLocaleString() || 'the'} people in your directory`, icon: 'users' },
    { id: 'new', title: 'Someone new', sub: 'Enter their details yourself', icon: 'plus' },
    { id: 'many', title: 'Many people at once', sub: 'Upload a CSV or pick a whole team', icon: 'grid' },
  ];
  const p = selected || person;
  const stats = data?.stats || [];
  const count = (id: string) => stats.find((s: any) => s.id === id)?.value;

  const renderBody = () => {
    return (
      <WizardBody aside={renderPersonPreview()}>
          <div>
            <div className="eyebrow mb-2 text-gold-text">Step 1 of 4</div>
            <h1 className="font-display text-[40px] leading-tight">Who is this card for?</h1>
            <p className="mt-1 text-[15px] text-stone">Pick an existing employee, add someone new, or create many cards at once.</p>
          </div>
          <fieldset>
            <legend className="mb-3 text-[13px] font-medium">Card holder</legend>
            <div className="grid gap-3 md:grid-cols-3">
              {options.map((o) => (
                <label key={o.id} className={cx('flex cursor-pointer flex-col gap-2 rounded-xl border bg-white p-4 transition-colors', mode === o.id ? 'border-ink ring-1 ring-ink' : 'border-line hover:border-line-strong')}>
                  <input type="radio" name="mode" className="sr-only" checked={mode === o.id} onChange={() => setMode(o.id)} />
                  <Icon name={o.icon} size={20} className="text-gold-text" />
                  <span className="text-[15px] font-medium">{o.title}</span>
                  <span className="text-[13px] text-stone-2">{o.sub}</span>
                </label>
              ))}
            </div>
          </fieldset>

          {mode === 'existing' && (
            <div className="rounded-xl border border-line bg-white p-5">
              <div className="mb-4 text-[15px] font-medium">Choose the employee</div>
              <div className="relative mb-3">
                <Icon name="search" size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-2" />
                <Input aria-label="Search people" placeholder="Search by name, title or email" value={q} onChange={(e) => setQ(e.target.value)} className="pl-10" />
              </div>
              <div className="mb-3 flex flex-wrap gap-2">
                {(
                  [
                    ['no-card', `Without a card · ${count('no-card') ?? ''}`],
                    ['all', `Everyone · ${data?.people?.toLocaleString() ?? ''}`],
                    ['joined', `Joined this month · ${data?.joined?.toLocaleString() ?? ''}`],
                  ] as const
                ).map(([id, label]) => (
                  <button key={id} type="button" onClick={() => setFilter(id)} className={cx('rounded-full px-3 py-1.5 text-[13px]', filter === id ? 'bg-ink text-cream' : 'bg-pearl text-stone hover:text-ink')}>
                    {label}
                  </button>
                ))}
              </div>
              {!data ? (
                <Loading className="py-8" />
              ) : data.rows.length === 0 ? (
                <p className="py-8 text-center text-[14px] text-stone-2">No one matches</p>
              ) : (
                <ul className="flex flex-col divide-y divide-linen">
                  {data.rows.map((r: any) => (
                    <li key={r.id}>
                      <label className={cx('flex cursor-pointer items-center gap-3 rounded-md px-2 py-3', selected?.id === r.id && 'bg-gold-tint')}>
                        <input type="radio" name="person" className="h-4 w-4 accent-ink" checked={selected?.id === r.id} onChange={() => setSelected(r)} />
                        <Avatar name={r.name} src={r.photoUrl} size={36} />
                        <span className="min-w-0 flex-1">
                          <span className="block text-[14px] font-medium">{r.name}</span>
                          <span className="block truncate text-[13px] text-stone-2">{[r.title, r.dept].filter(Boolean).join(' · ')}</span>
                        </span>
                        <span className="text-right text-[12px] text-stone-2">
                          {r.startDate && new Date(r.startDate) > new Date(Date.now() - 31 * 86400_000) ? `Joins ${new Date(r.startDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}` : ''}
                          <br />
                          {r.cardId ? <Badge tone="ok">Has a card</Badge> : <span>No card yet</span>}
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {mode === 'new' && (
            <div className="grid gap-4 rounded-xl border border-line bg-white p-5 sm:grid-cols-2">
              {(
                [
                  ['name', 'Full name'],
                  ['title', 'Job title'],
                  ['department', 'Department'],
                  ['office', 'Office'],
                  ['email', 'Work email'],
                  ['phone', 'Work phone'],
                ] as const
              ).map(([k, label]) => (
                <Field key={k} label={label}>
                  {(id) => <Input id={id} type={k === 'email' ? 'email' : 'text'} value={(person as any)[k]} onChange={(e) => setPerson({ ...person, [k]: e.target.value })} />}
                </Field>
              ))}
            </div>
          )}

          {mode === 'many' && (
            <div className="grid gap-3 md:grid-cols-2">
              <button type="button" onClick={bulk} disabled={busy} className="flex flex-col gap-2 rounded-xl border border-line bg-white p-5 text-left hover:border-gold-soft">
                <Icon name="users" className="text-gold-text" />
                <span className="text-[15px] font-medium">Everyone without a card</span>
                <span className="text-[13px] text-stone-2">Creates and publishes cards from each person&rsquo;s department template.</span>
              </button>
              <Link href="/app/employees?import=1" className="flex flex-col gap-2 rounded-xl border border-line bg-white p-5 hover:border-gold-soft">
                <Icon name="upload" className="text-gold-text" />
                <span className="text-[15px] font-medium">Upload a CSV</span>
                <span className="text-[13px] text-stone-2">Name, email, title, department, office. We match columns for you.</span>
              </Link>
            </div>
          )}
      </WizardBody>
    );
  };

  /* Right-hand preview: the card and, for a synced person, the fields that come from HR */
  const renderPersonPreview = () => {
    return (
      <>
            <CardFace fields={{ name: p.name, title: [p.title, p.dept || p.department].filter(Boolean).join(' · ') }} brand={brand} width="100%" />
            {selected && (
              <dl className="m-0 flex w-full flex-col gap-2 rounded-[14px] border border-linen bg-white p-5 text-[13px]">
                <dt className="mb-1 text-[13px] font-semibold">{selected.source !== 'Manual' ? `Synced from ${selected.source}` : 'Details'}</dt>
                {[
                  ['Name', selected.name],
                  ['Title', selected.title],
                  ['Department', selected.dept],
                  ['Office', selected.office],
                  ['Email', selected.email],
                ].map(([k, v]) => (
                  <div key={k} className="grid grid-cols-[96px_1fr] gap-3">
                    <dt className="text-stone-2">{k}</dt>
                    <dd className="m-0 truncate">{v || '—'}</dd>
                  </div>
                ))}
                {selected.source !== 'Manual' && (
                  <p className="m-0 mt-1 flex items-center gap-2 text-[12px] text-stone-2">
                    <Icon name="lock" size={14} /> These fields stay in sync with HR automatically.
                  </p>
                )}
              </dl>
            )}
      </>
    );
  };

  return (
    <>
      {renderBody()}
      <WizardFooter>
          <LinkButton href="/app/cards" icon="back" className="h-[46px] px-5">
            Cancel
          </LinkButton>
          <span className="hidden text-[13px] text-stone-2 sm:block">Step 1 of 4 · Person</span>
          {mode !== 'many' && (
            <Button
              variant="ink"
              iconRight="arrow"
              loading={busy}
              disabled={mode === 'existing' ? !selected || !!selected.cardId : person.name.trim().length < 2}
              onClick={create}
            >
              Continue to design
            </Button>
          )}
      </WizardFooter>
      {selected?.cardId && (
        <p className="mt-3 text-center text-[13px] text-stone">
          {selected.name} already has a card.{' '}
          <Link href={`/app/cards/${selected.cardId}`} className="text-gold-text underline">
            Open it
          </Link>
        </p>
      )}
    </>
  );
}

function StepPersonDone({ card }: { card: any }) {
  return (
    <div>
      <div className="eyebrow mb-2 text-gold-text">Step 1 of 4</div>
      <h1 className="font-display text-[40px]">{card.fields.name}</h1>
      <p className="mt-1 text-[15px] text-stone">The person for this card is chosen. Continue to the design.</p>
    </div>
  );
}

/* ---------------- Step 2 · Design ---------------- */

function StepDesign({ draft, set, company }: { draft: any; set: (p: any) => void; company: any }) {
  const toast = useToast();
  const { data: templates } = useApi<any[]>('/templates');
  const deptTemplate = templates?.find((t) => t.departments.includes(draft.fields.department)) || templates?.find((t) => t.isDefault);
  const upload = async (f?: File) => {
    if (!f) return;
    try {
      const r = await api.upload(f);
      set({ cover: r.url });
    } catch (e) {
      toast((e as Error).message, 'err');
    }
  };
  return (
    <div className="flex flex-col gap-8">
      <div>
        <div className="eyebrow mb-2 text-gold-text">Step 2 of 4</div>
        <h1 className="font-display text-[40px] leading-tight">Choose a design</h1>
        <p className="mt-1 text-[15px] text-stone">Your brand kit is applied automatically. Pick a layout and a finish.</p>
      </div>
      <fieldset>
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <legend className="text-[15px] font-medium">Layout</legend>
          {deptTemplate && (
            <span className="text-[13px] text-stone-2">
              Default for {draft.fields.department || 'your company'}: {deptTemplate.layoutName}
            </span>
          )}
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {LAYOUTS.map((l) => (
            <label key={l.id} className={cx('flex cursor-pointer flex-col gap-3 rounded-xl border bg-white p-3 transition-colors', draft.layout === l.id ? 'border-ink ring-1 ring-ink' : 'border-line hover:border-line-strong')}>
              <input type="radio" name="layout" className="sr-only" checked={draft.layout === l.id} onChange={() => set({ layout: l.id })} />
              <CardFace layout={l.id} theme={draft.theme} fields={draft.fields} translations={draft.translations} brand={draft.brand} width="100%" />
              <span>
                <span className="block text-[14px] font-medium">{l.name}</span>
                <span className="block text-[12px] text-stone-2">{l.desc}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <legend className="text-[15px] font-medium">Colour theme</legend>
          <span className="text-[13px] text-stone-2">Approved by your Brand Manager</span>
        </div>
        <div className="flex flex-wrap gap-3">
          {THEMES.map((t) => {
            const r = resolveTheme(t.id, draft.brand);
            return (
              <label key={t.id} className={cx('flex cursor-pointer items-center gap-3 rounded-full border bg-white py-1.5 pl-1.5 pr-4', draft.theme === t.id ? 'border-ink ring-1 ring-ink' : 'border-line hover:border-line-strong')}>
                <input type="radio" name="theme" className="sr-only" checked={draft.theme === t.id} onChange={() => set({ theme: t.id })} />
                <span className="flex h-8 w-8 items-center justify-center rounded-full" style={{ background: r.bg, boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.08)' }}>
                  <span className="h-3 w-3 rounded-full" style={{ background: r.accent }} />
                </span>
                <span className="text-[14px]">{t.name}</span>
              </label>
            );
          })}
        </div>
      </fieldset>
      <fieldset>
        <legend className="mb-3 text-[15px] font-medium">Cover for the online card</legend>
        <div className="flex flex-wrap gap-3">
          {[
            ['brand', 'Brand default'],
            ['linework', 'Gold linework'],
          ].map(([id, name]) => (
            <label key={id} className={cx('flex cursor-pointer items-center gap-2 rounded-md border bg-white px-4 py-2.5 text-[14px]', draft.cover === id ? 'border-ink ring-1 ring-ink' : 'border-line')}>
              <input type="radio" name="cover" className="sr-only" checked={draft.cover === id} onChange={() => set({ cover: id })} />
              {name}
            </label>
          ))}
          <label className={cx('flex cursor-pointer items-center gap-2 rounded-md border bg-white px-4 py-2.5 text-[14px]', draft.cover?.startsWith('/') ? 'border-ink ring-1 ring-ink' : 'border-line')}>
            <Icon name="upload" size={16} /> {draft.cover?.startsWith('/') ? 'Custom image' : 'Upload image'}
            <input type="file" accept="image/*" className="sr-only" onChange={(e) => upload(e.target.files?.[0])} />
          </label>
        </div>
      </fieldset>
      {company && <p className="text-[13px] text-stone-2">Fonts and logo come from the {company.name} brand kit.</p>}
    </div>
  );
}

/* ---------------- Step 3 · Details ---------------- */

function StepDetails({ draft, set, setField }: { draft: any; set: (p: any) => void; setField: (k: string, v: string) => void }) {
  const { data: me } = useMe();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [linkEdit, setLinkEdit] = useState<{ i: number; link: any } | null>(null);
  const ai = !!me?.features.ai;
  const synced = (k: string) => draft.syncedFields?.includes(k);
  const src = draft.employee?.source && draft.employee.source !== 'manual' ? ({ workday: 'Workday', sap: 'SAP', bamboohr: 'BambooHR', entra: 'Entra ID', csv: 'CSV' } as any)[draft.employee.source] || 'HR' : null;
  const tag = (k: string) => (synced(k) && src ? <Badge tone="gold" className="!py-0.5 !text-[11px]">From {src}</Badge> : null);
  const first = (draft.fields.name || '').split(' ')[0];

  const upload = async (f?: File) => {
    if (!f) return;
    setBusy('photo');
    try {
      const r = await api.upload(f);
      setField('photoUrl', r.url);
    } catch (e) {
      toast((e as Error).message, 'err');
    } finally {
      setBusy(null);
    }
  };
  const writeBio = async () => {
    setBusy('bio');
    try {
      const r = await api.post('/ai/bio', { name: draft.fields.name, title: draft.fields.title, department: draft.fields.department, office: draft.fields.office });
      setField('bio', r.bio);
    } catch (e) {
      toast((e as Error).message, 'err');
    } finally {
      setBusy(null);
    }
  };
  const translate = async (language: string) => {
    setBusy('translate');
    try {
      const r = await api.post('/ai/translate', { language, fields: { name: draft.fields.name || '', title: draft.fields.title || '', bio: draft.fields.bio || '' } });
      set({ translations: { ...draft.translations, [language]: r.fields } });
      toast(`${LANGS[language]} added`);
    } catch (e) {
      toast((e as Error).message, 'err');
    } finally {
      setBusy(null);
    }
  };
  const languages = Object.keys(draft.translations || {});
  const [manualLang, setManualLang] = useState<string | null>(null);

  const field = (k: string, label: string, type = 'text') => (
    <Field key={k} label={label} tag={tag(k)}>
      {(id) => <Input id={id} type={type} value={draft.fields[k] || ''} onChange={(e) => setField(k, e.target.value)} />}
    </Field>
  );

  return (
    <div className="flex flex-col gap-8">
      <div>
        <div className="eyebrow mb-2 text-gold-text">Step 3 of 4</div>
        <h1 className="font-display text-[40px] leading-tight">Add the details</h1>
        <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[15px] text-stone">
          Fields marked <Badge tone="gold">From {src || 'HR'}</Badge> are filled for you and stay in sync. Everything else is optional.
        </p>
      </div>

      <section className="flex flex-wrap items-center gap-5 rounded-xl border border-line bg-white p-5">
        <Avatar name={draft.fields.name} src={draft.fields.photoUrl} size={72} />
        <div className="min-w-0 flex-1">
          <div className="text-[15px] font-medium">Profile photo</div>
          <p className="text-[13px] text-stone-2">A square photo, at least 600 px. Photo changes by employees need Brand Manager approval.</p>
        </div>
        <div className="flex gap-2">
          <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border border-line-strong bg-white px-3 text-[13px] font-medium hover:border-ink">
            {busy === 'photo' ? <Spinner size={15} /> : <Icon name="upload" size={16} />} Upload photo
            <input type="file" accept="image/*" className="sr-only" onChange={(e) => upload(e.target.files?.[0])} />
          </label>
          {draft.fields.photoUrl && (
            <Button size="sm" variant="ghost" onClick={() => setField('photoUrl', '')}>
              Remove
            </Button>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-line bg-white p-5">
        <div className="mb-4">
          <div className="text-[15px] font-medium">Identity</div>
          <div className="text-[13px] text-stone-2">How {first || 'they are'} {first ? 'is ' : ''}introduced</div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {field('name', 'Full name')}
          {field('title', 'Job title')}
          {field('department', 'Department')}
          {field('office', 'Office')}
          {field('pronouns', 'Pronouns')}
        </div>
      </section>

      <section className="rounded-xl border border-line bg-white p-5">
        <div className="mb-4">
          <div className="text-[15px] font-medium">Contact</div>
          <div className="text-[13px] text-stone-2">How clients reach {first || 'them'}</div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {field('email', 'Email', 'email')}
          {field('phone', 'Work phone', 'tel')}
          {field('mobile', 'Mobile', 'tel')}
          {field('whatsapp', 'WhatsApp', 'tel')}
          {field('website', 'Website', 'url')}
          {field('address', 'Office address')}
        </div>
      </section>

      <section className="rounded-xl border border-line bg-white p-5">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-[15px] font-medium">About</div>
            <div className="text-[13px] text-stone-2">Two or three sentences in the company&rsquo;s voice</div>
          </div>
          {ai && (
            <Button size="sm" variant="gold" icon="sparkle" loading={busy === 'bio'} onClick={writeBio}>
              Write with AI
            </Button>
          )}
        </div>
        <Textarea aria-label="About" rows={4} maxLength={300} value={draft.fields.bio || ''} onChange={(e) => setField('bio', e.target.value)} placeholder={`${first || 'They'} joins … supporting …`} />
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3 text-[13px] text-stone-2">
          <span className="flex flex-wrap items-center gap-2">
            Languages: English
            {languages.map((l) => (
              <span key={l} className="inline-flex items-center gap-1 rounded-full bg-pearl px-2 py-0.5">
                {LANGS[l] || l}
                <button
                  type="button"
                  aria-label={`Remove ${LANGS[l]}`}
                  onClick={() => {
                    const t = { ...draft.translations };
                    delete t[l];
                    set({ translations: t });
                  }}
                >
                  <Icon name="x" size={12} />
                </button>
              </span>
            ))}
            {!languages.includes('ar') &&
              (ai ? (
                <button type="button" onClick={() => translate('ar')} className="text-gold-text underline-offset-4 hover:underline" disabled={!!busy}>
                  {busy === 'translate' ? 'Translating…' : '· add Arabic'}
                </button>
              ) : (
                <button type="button" onClick={() => setManualLang('ar')} className="text-gold-text underline-offset-4 hover:underline">
                  · add Arabic
                </button>
              ))}
          </span>
          <span className="tabular-nums">{(draft.fields.bio || '').length} / 300</span>
        </div>
        {manualLang && (
          <div dir="rtl" className="mt-4 grid gap-3 rounded-lg bg-pearl p-4 sm:grid-cols-2">
            {(['name', 'title'] as const).map((k) => (
              <Input
                key={k}
                aria-label={`${LANGS[manualLang]} ${k}`}
                placeholder={k === 'name' ? 'الاسم' : 'المسمى الوظيفي'}
                value={draft.translations?.[manualLang]?.[k] || ''}
                onChange={(e) => set({ translations: { ...draft.translations, [manualLang]: { ...draft.translations?.[manualLang], [k]: e.target.value } } })}
              />
            ))}
            <Textarea
              aria-label={`${LANGS[manualLang]} bio`}
              className="sm:col-span-2"
              rows={2}
              placeholder="نبذة"
              value={draft.translations?.[manualLang]?.bio || ''}
              onChange={(e) => set({ translations: { ...draft.translations, [manualLang]: { ...draft.translations?.[manualLang], bio: e.target.value } } })}
            />
          </div>
        )}
      </section>

      <section className="rounded-xl border border-line bg-white p-5">
        <div className="mb-4">
          <div className="text-[15px] font-medium">Links and buttons</div>
          <div className="text-[13px] text-stone-2">Shown on the online card in this order</div>
        </div>
        <ul className="flex flex-col gap-2">
          {(draft.links || []).map((l: any, i: number) => {
            const meta = LINK_TYPES.find((x) => x.id === l.type);
            return (
              <li key={i} className="flex items-center gap-3 rounded-lg border border-line px-3 py-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-pearl text-gold-text">
                  <Icon name={meta?.icon || 'link'} size={16} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] font-medium">{l.label}</span>
                  <span className="block truncate text-[12px] text-stone-2">{l.url}</span>
                </span>
                <IconButton icon="down" label="Move down" disabled={i === draft.links.length - 1} onClick={() => { const a = [...draft.links]; [a[i], a[i + 1]] = [a[i + 1], a[i]]; set({ links: a }); }} className="h-8 w-8" />
                <Button size="sm" variant="ghost" onClick={() => setLinkEdit({ i, link: { ...l } })}>
                  Edit
                </Button>
                <IconButton icon="trash" label="Remove link" onClick={() => set({ links: draft.links.filter((_: any, j: number) => j !== i) })} className="h-8 w-8" />
              </li>
            );
          })}
        </ul>
        <Button size="sm" icon="plus" className="mt-3" disabled={(draft.links || []).length >= 12} onClick={() => setLinkEdit({ i: -1, link: { type: 'booking', label: 'Book a meeting', url: '', sub: '' } })}>
          Add a link or button
        </Button>
      </section>

      <Modal
        open={!!linkEdit}
        onClose={() => setLinkEdit(null)}
        title={linkEdit?.i === -1 ? 'Add a link' : 'Edit link'}
        footer={
          <>
            <Button onClick={() => setLinkEdit(null)}>Cancel</Button>
            <Button
              variant="ink"
              disabled={!linkEdit?.link.url || !linkEdit?.link.label}
              onClick={() => {
                const links = [...(draft.links || [])];
                if (linkEdit!.i === -1) links.push(linkEdit!.link);
                else links[linkEdit!.i] = linkEdit!.link;
                set({ links });
                setLinkEdit(null);
              }}
            >
              Save link
            </Button>
          </>
        }
      >
        {linkEdit && (
          <div className="flex flex-col gap-4">
            <Field label="Type">
              {(id) => (
                <Select
                  id={id}
                  value={linkEdit.link.type}
                  onChange={(e) => setLinkEdit({ ...linkEdit, link: { ...linkEdit.link, type: e.target.value, label: LINK_TYPES.find((t) => t.id === e.target.value)?.name || '' } })}
                >
                  {LINK_TYPES.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Button text">{(id) => <Input id={id} value={linkEdit.link.label} onChange={(e) => setLinkEdit({ ...linkEdit, link: { ...linkEdit.link, label: e.target.value } })} />}</Field>
            <Field label="Address (URL)">{(id) => <Input id={id} type="url" placeholder="https://" value={linkEdit.link.url} onChange={(e) => setLinkEdit({ ...linkEdit, link: { ...linkEdit.link, url: e.target.value } })} />}</Field>
            <Field label="Small line under it (optional)">{(id) => <Input id={id} placeholder="30-minute introduction" value={linkEdit.link.sub || ''} onChange={(e) => setLinkEdit({ ...linkEdit, link: { ...linkEdit.link, sub: e.target.value } })} />}</Field>
          </div>
        )}
      </Modal>
    </div>
  );
}

/* ---------------- Step 4 · Publish ---------------- */

function StepPublish({ draft, set, employee, isEdit }: { draft: any; set: (p: any) => void; employee: any; isEdit: boolean }) {
  const first = (draft.fields.name || '').split(' ')[0];
  const futureStart = employee?.startDate && new Date(employee.startDate) > new Date() ? new Date(employee.startDate) : null;
  const [slugState, setSlugState] = useState<{ checking: boolean; available: boolean | null }>({ checking: false, available: true });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prefix = draft.displayUrl.slice(0, draft.displayUrl.length - draft.slug.length);

  const onSlug = (v: string) => {
    const clean = v.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-');
    set({ slug: clean });
    if (timer.current) clearTimeout(timer.current);
    setSlugState({ checking: true, available: null });
    timer.current = setTimeout(async () => {
      const r = await api.get(`/cards/slug-available${qs({ slug: clean, exceptId: draft.id })}`).catch(() => ({ available: false }));
      setSlugState({ checking: false, available: r.available });
    }, 350);
  };

  const DELIVERY: { id: string; name: string; desc: string; icon: IconName }[] = [
    { id: 'email', name: 'Welcome email', desc: `Link, QR and wallet buttons sent to ${first}`, icon: 'mail' },
    { id: 'wallet', name: 'Wallet pass', desc: 'Apple and Google Wallet', icon: 'wallet' },
    { id: 'signature', name: 'Email signature', desc: 'For Outlook and Gmail', icon: 'link' },
  ];
  const toggle = (id: string) => set({ delivery: draft.delivery.includes(id) ? draft.delivery.filter((d: string) => d !== id) : [...draft.delivery, id] });

  return (
    <div className="flex flex-col gap-8">
      <div>
        <div className="eyebrow mb-2 text-gold-text">Step 4 of 4</div>
        <h1 className="font-display text-[40px] leading-tight">Share and publish</h1>
        <p className="mt-1 text-[15px] text-stone">Choose how {first} receives the card. You can change any of this later.</p>
      </div>

      {!isEdit && (
        <fieldset className="rounded-xl border border-line bg-white p-5">
          <legend className="sr-only">When should it go live?</legend>
          <div className="mb-3 text-[15px] font-medium">When should it go live?</div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className={cx('flex cursor-pointer flex-col gap-1 rounded-lg border p-4', !draft._publishAt ? 'border-ink ring-1 ring-ink' : 'border-line')}>
              <input type="radio" name="when" className="sr-only" checked={!draft._publishAt} onChange={() => set({ _publishAt: null })} />
              <span className="text-[14px] font-medium">Publish now</span>
              <span className="text-[13px] text-stone-2">Live as soon as you finish</span>
            </label>
            <label className={cx('flex flex-col gap-1 rounded-lg border p-4', futureStart ? 'cursor-pointer' : 'opacity-50', draft._publishAt ? 'border-ink ring-1 ring-ink' : 'border-line')}>
              <input type="radio" name="when" className="sr-only" disabled={!futureStart} checked={!!draft._publishAt} onChange={() => set({ _publishAt: futureStart?.toISOString() })} />
              <span className="text-[14px] font-medium">On {first ? `${first}'s` : 'their'} start date</span>
              <span className="text-[13px] text-stone-2">{futureStart ? futureStart.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }) : 'No future start date on file'}</span>
            </label>
          </div>
        </fieldset>
      )}

      <section className="rounded-xl border border-line bg-white p-5">
        <div className="mb-3 text-[15px] font-medium">Deliver to {first}</div>
        <ul className="flex flex-col divide-y divide-linen">
          {DELIVERY.map((d) => (
            <li key={d.id} className="flex items-center gap-3 py-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-pearl text-gold-text">
                <Icon name={d.icon} size={17} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-medium">{d.name}</span>
                <span className="block text-[13px] text-stone-2">{d.desc}</span>
              </span>
              <Toggle checked={draft.delivery.includes(d.id)} onChange={() => toggle(d.id)} label={d.name} />
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-xl border border-line bg-white p-5">
        <div className="mb-1 flex items-center justify-between gap-3">
          <div>
            <div className="text-[15px] font-medium">NFC card</div>
            <div className="text-[13px] text-stone-2">Engraved with {first}&rsquo;s name and your logo</div>
          </div>
          <Toggle checked={!!draft._nfc} onChange={(v) => set({ _nfc: v ? draft._nfc || 'metal_obsidian' : null })} label="Order an NFC card" />
        </div>
        {draft._nfc && (
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {MATERIALS.map((m) => (
              <label key={m.id} className={cx('flex cursor-pointer flex-col gap-2 rounded-lg border p-3', draft._nfc === m.id ? 'border-ink ring-1 ring-ink' : 'border-line')}>
                <input type="radio" name="material" className="sr-only" checked={draft._nfc === m.id} onChange={() => set({ _nfc: m.id })} />
                <span className="aspect-[1.586] w-full rounded-md" style={{ background: m.bg }} />
                <span className="text-[13px] font-medium">{m.name}</span>
                <span className="text-[12px] text-stone-2">${m.price} · {m.desc}</span>
              </label>
            ))}
          </div>
        )}
        {draft._nfc && <p className="mt-3 text-[13px] text-stone-2">Ships to {draft.fields.office || 'the office on file'}.</p>}
      </section>

      <section className="rounded-xl border border-line bg-white p-5">
        <Field
          label="Card link"
          hint={
            slugState.checking ? (
              'Checking…'
            ) : slugState.available === false ? (
              <span className="text-err">This link is taken. Try another.</span>
            ) : (
              `This link is available. It never changes, even if ${first}'s title does.`
            )
          }
        >
          {(id) => (
            <div className="flex">
              <span className="flex items-center rounded-l-md border border-r-0 border-line-strong bg-pearl px-3 font-mono text-[13px] text-stone">{prefix}</span>
              <Input id={id} value={draft.slug} onChange={(e) => onSlug(e.target.value)} className="rounded-l-none font-mono text-[14px]" />
            </div>
          )}
        </Field>
      </section>
    </div>
  );
}

function PublishButton({ draft, save, isEdit }: { draft: any; save: (silent?: boolean) => Promise<boolean>; isEdit: boolean }) {
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const router = useRouter();
  const publish = async () => {
    setBusy(true);
    try {
      if (!(await save(true))) return;
      if (isEdit) {
        toast('Card updated');
        router.push(`/app/cards/${draft.id}`);
        return;
      }
      const r = await api.post(`/cards/${draft.id}/publish`, { publishAt: draft._publishAt || null, nfcMaterial: draft._nfc || null });
      sessionStorage.setItem(`vl-published-${draft.id}`, JSON.stringify(r));
      router.push(`/app/create/done?card=${draft.id}`);
    } catch (e) {
      toast((e as Error).message, 'err');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Button variant="ink" icon="check" loading={busy} onClick={publish}>
      {isEdit ? 'Save changes' : 'Publish card'}
    </Button>
  );
}

/* ---------------- Live preview ---------------- */

function Preview({ draft, step }: { draft: any; step: number }) {
  const summary = useMemo(
    () => [
      ['Design', `${LAYOUTS.find((l) => l.id === draft.layout)?.name} · ${THEMES.find((t) => t.id === draft.theme)?.name}`],
      ['Goes live', draft._publishAt ? new Date(draft._publishAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' }) : 'Now'],
      ['NFC card', draft._nfc ? MATERIALS.find((m) => m.id === draft._nfc)?.name : 'Not ordered'],
    ],
    [draft],
  );
  if (step === 3) {
    return (
      <PhoneFrame height={600}>
        <OnlineCard card={draft} preview />
      </PhoneFrame>
    );
  }
  if (step === 4) {
    return (
      <>
        <WalletPreview draft={draft} />
        <dl className="m-0 flex w-full flex-col gap-2 rounded-[14px] border border-linen bg-white p-5 text-[13px]">
          <dt className="text-[13px] font-semibold">Summary</dt>
          {summary.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-3">
              <span className="text-stone-2">{k}</span>
              <span className="text-right">{v}</span>
            </div>
          ))}
        </dl>
      </>
    );
  }
  return (
    <>
      <CardFace layout={draft.layout} theme={draft.theme} fields={draft.fields} translations={draft.translations} brand={draft.brand} width="100%" />
      <CardFace layout={draft.layout} theme={draft.theme} fields={draft.fields} brand={draft.brand} side="back" url={draft.displayUrl} width="100%" material={draft._nfc ? MATERIALS.find((m) => m.id === draft._nfc) : undefined} />
      <p className="m-0 text-center text-[12px] text-stone-2">Front and back · NFC and online card share this design</p>
    </>
  );
}

function WalletPreview({ draft }: { draft: any }) {
  const t = resolveTheme(draft.theme, draft.brand);
  return (
    <div className="mx-auto w-full max-w-[320px] overflow-hidden rounded-2xl shadow-xl" style={{ background: t.bg, color: t.fg }}>
      <div className="flex items-center justify-between px-5 py-4">
        <span className="flex items-center gap-2 text-[12px] tracking-[0.2em]" style={{ color: t.accent }}>
          <Seal size={18} /> {(draft.brand?.companyName || '').split(' ')[0]?.toUpperCase()}
        </span>
        <span className="text-[10px] tracking-[0.2em]" style={{ color: t.accent }}>
          WALLET PASS
        </span>
      </div>
      <div className="px-5 pb-4">
        <div className="text-[10px] tracking-[0.16em]" style={{ color: t.accent }}>NAME</div>
        <div className="text-[22px]">{draft.fields.name}</div>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div>
            <div className="text-[10px] tracking-[0.16em]" style={{ color: t.accent }}>TITLE</div>
            <div className="text-[13px]">{draft.fields.title}</div>
          </div>
          <div>
            <div className="text-[10px] tracking-[0.16em]" style={{ color: t.accent }}>OFFICE</div>
            <div className="text-[13px]">{draft.fields.office?.split('·')[0]}</div>
          </div>
        </div>
      </div>
      <div className="flex justify-center bg-white/5 py-5">
        <img src={`/api/cards/${draft.id}/qr`} alt="" className="h-32 w-32 rounded-md bg-white p-2" />
      </div>
      <div className="grid grid-cols-2 gap-2 bg-white p-3">
        <span className="flex h-10 items-center justify-center rounded-lg bg-black text-[12px] text-white">Add to Apple Wallet</span>
        <span className="flex h-10 items-center justify-center rounded-lg bg-black text-[12px] text-white">Add to Google Wallet</span>
      </div>
    </div>
  );
}

