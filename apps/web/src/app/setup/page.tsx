'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { CardFace } from '@/components/card/card-face';
import { OnlineCard, PhoneFrame } from '@/components/card/online-card';
import { Icon, IconName, Wordmark } from '@/components/icons';
import { useToast } from '@/components/toast';
import { Button, cx, ErrorState, Input, Loading, Select, Spinner } from '@/components/ui';
import { api, useApi } from '@/lib/api';
import { LANGS } from '@/lib/catalog';

/* Self-serve setup after sign-up, drawn to the "Setup 1–5" artboards. */

const STEPS = ['Company', 'Brand', 'Template', 'People', 'First card'];
const INDUSTRIES = ['Financial services', 'Legal', 'Real estate', 'Hospitality', 'Healthcare', 'Technology', 'Consulting', 'Energy', 'Government', 'Education', 'Retail', 'Other'];
const SIZES = ['1–50 people', '51–200 people', '201–1,000 people', '1,001–5,000 people', '5,000+ people'];
const COUNTRIES = ['United Arab Emirates', 'Saudi Arabia', 'Qatar', 'Kuwait', 'Bahrain', 'Oman', 'Pakistan', 'United Kingdom', 'United States'];

type Setup = any;

export default function SetupPage() {
  const { data, error, mutate } = useApi<Setup>('/setup', { shouldRetryOnError: false });
  const [view, setView] = useState<number | null>(null);
  useEffect(() => {
    if (data && view === null) setView(Math.min(data.step, 5));
  }, [data, view]);

  if (error) return <ErrorState error={error} retry={() => mutate()} />;
  if (!data || view === null) return <Loading className="min-h-screen" />;

  const go = async (step: number) => {
    await mutate();
    setView(step);
    window.scrollTo({ top: 0 });
  };
  const brand = { companyName: data.company.name, logos: { light: data.brand.logo }, colors: data.brand.colors, fonts: data.brand.fonts };

  return (
    <div className="flex min-h-screen flex-col bg-pearl text-[14px] text-ink">
      <header className="flex flex-wrap items-center gap-6 border-b border-linen bg-white px-8 py-4">
        <Wordmark size={16} />
        <span className="ml-auto text-[13px] text-stone">
          Setting up {data.company.name} · step {view} of 5
        </span>
      </header>
      <div className="h-0.75 bg-[#EEE8DD]" role="progressbar" aria-valuemin={1} aria-valuemax={5} aria-valuenow={view}>
        <div className="h-0.75 bg-gold transition-all" style={{ width: `${view * 20}%` }} />
      </div>
      <div className="flex flex-1 flex-wrap">
        <main className="flex min-w-0 flex-[3_1_520px] justify-center px-6 py-12 sm:px-14">
          <div className="flex w-full max-w-155 flex-col gap-7">
            <ol aria-label="Setup steps" className="m-0 flex list-none flex-wrap gap-4.5 p-0">
              {STEPS.map((name, i) => {
                const n = i + 1;
                return (
                  <li key={name} className={cx('flex items-center gap-2 text-[13px]', n <= view ? 'text-ink' : 'text-[#8E887E]', n === view && 'font-semibold')}>
                    <span
                      className={cx(
                        'flex h-6 w-6 items-center justify-center rounded-full border text-[11px] font-semibold',
                        n < view ? 'border-gold bg-gold text-white' : n === view ? 'border-ink bg-ink text-white' : 'border-[#D9D2C4] bg-white',
                      )}
                    >
                      {n < view ? <Icon name="check" size={12} strokeWidth={2.4} /> : n}
                    </span>
                    {name}
                  </li>
                );
              })}
            </ol>
            {view === 1 && <CompanyStep data={data} onNext={() => go(2)} />}
            {view === 2 && <BrandStep data={data} onBack={() => setView(1)} onNext={() => go(3)} />}
            {view === 3 && <TemplateStep data={data} brand={brand} onBack={() => setView(2)} onNext={() => go(4)} />}
            {view === 4 && <PeopleStep data={data} onBack={() => setView(3)} onNext={() => go(5)} />}
            {view === 5 && <DoneStep data={data} onBack={() => setView(4)} />}
          </div>
        </main>
        <aside aria-label="Preview" className="flex min-w-0 flex-[2_1_400px] flex-col items-center justify-center gap-5 bg-sand px-10 py-14">
          <Preview view={view} data={data} brand={brand} />
        </aside>
      </div>
    </div>
  );
}

/* ---------- Right-hand preview, one per step ---------- */

const HR_NEXT = [
  ['Sign in to your HR system', 'Read-only access'],
  ['Check the field matches', 'Common fields are matched for you'],
  ['See a preview', 'How many cards will be created'],
  ['Publish when ready', 'Welcome emails go out to your team'],
];

function Preview({ view, data, brand }: { view: number; data: Setup; brand: any }) {
  const caption = (text: string) => <span className="text-center text-[13px] text-stone">{text}</span>;
  const sample = { name: data.ownerName || 'Your name here', title: 'Your title' };

  if (view === 3)
    return (
      <>
        <PhoneFrame height={420} className="max-w-62.5">
          <OnlineCard card={{ theme: 'white_brand', layout: data.layout, fields: { ...sample, email: 'x', phone: 'x' }, brand }} preview />
        </PhoneFrame>
        {caption(`${data.layouts.find((l: any) => l.id === data.layout)?.name || 'Classic'} layout · online card`)}
      </>
    );
  if (view === 4)
    return (
      <>
        <div className="flex w-95 max-w-full flex-col gap-3.5 rounded-2xl bg-white p-5.5 shadow-[0_20px_40px_rgba(23,23,27,0.08)]">
          <span className="text-[11px] font-semibold tracking-[0.2em] text-stone-2">WHAT HAPPENS NEXT</span>
          {HR_NEXT.map(([t, s], i) => (
            <div key={t} className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gold-tint text-[11px] font-semibold text-gold-text">{i + 1}</span>
              <span className="flex flex-col">
                <span className="text-[13.5px] font-semibold">{t}</span>
                <span className="text-[12.5px] text-stone">{s}</span>
              </span>
            </div>
          ))}
        </div>
        {caption('Nothing is published until you say so')}
      </>
    );
  return (
    <>
      <div className="w-95 max-w-full">
        <CardFace layout={data.layout} theme={data.brand.theme} fields={view === 5 ? { name: data.ownerName, title: '' } : sample} brand={brand} width="100%" />
      </div>
      {caption(
        view === 5 && data.card
          ? `Live at ${data.card.url.replace(/^https?:\/\//, '')}`
          : view === 1
            ? 'Your company name appears on every card'
            : "This is how your team's cards will look",
      )}
    </>
  );
}

/* ---------- Shared pieces ---------- */

function Heading({ title, desc }: { title: React.ReactNode; desc: string }) {
  return (
    <div className="flex flex-col gap-2.5">
      <h1 className="m-0 font-display text-[40px] font-normal leading-[1.05] sm:text-[48px]">{title}</h1>
      <p className="m-0 text-[16px] leading-relaxed text-stone">{desc}</p>
    </div>
  );
}

function Nav({ onBack, next }: { onBack?: () => void; next: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 pt-2">
      {onBack ? (
        <Button onClick={onBack} className="h-11.5">
          Back
        </Button>
      ) : (
        <span />
      )}
      {next}
    </div>
  );
}

function NextButton({ busy, disabled, onClick, children = 'Continue' }: { busy?: boolean; disabled?: boolean; onClick: () => void; children?: React.ReactNode }) {
  return (
    <Button variant="ink" size="lg" loading={busy} disabled={disabled} onClick={onClick} className="h-12 px-6.5">
      {children} <Icon name="arrow" size={18} className="text-gold-soft" />
    </Button>
  );
}

/** Saves one step: busy flag, error toast, then moves on. */
function useSave(onDone: () => void) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const save = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
      onDone();
    } catch (e) {
      toast((e as Error).message, 'err');
    } finally {
      setBusy(false);
    }
  };
  return { busy, save };
}

const labelled = (label: string, id: string, control: React.ReactNode) => (
  <div className="flex min-w-0 flex-col gap-1.5">
    <label htmlFor={id} className="text-[13px] font-medium">
      {label}
    </label>
    {control}
  </div>
);

/* ---------- 1 · Company ---------- */

function CompanyStep({ data, onNext }: { data: Setup; onNext: () => void }) {
  const [f, setF] = useState(data.company);
  const { busy, save } = useSave(onNext);
  const pick = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  const toggleLang = (code: string) => setF({ ...f, languages: f.languages.includes(code) ? f.languages.filter((l: string) => l !== code) : [...f.languages, code] });

  return (
    <>
      <Heading
        title={
          <>
            Tell us about
            <br />
            your company.
          </>
        }
        desc="Five short steps. Most companies finish in under ten minutes."
      />
      <section className="grid grid-cols-[repeat(auto-fit,minmax(min(240px,100%),1fr))] gap-4.5 rounded-2xl border border-linen bg-white p-5.5">
        {labelled('Company name', 'cn', <Input id="cn" value={f.name} onChange={pick('name')} />)}
        {labelled('Website', 'ws', <Input id="ws" placeholder="yourcompany.com" value={f.website} onChange={pick('website')} />)}
        {labelled(
          'Industry',
          'ind',
          <Select id="ind" value={f.industry} onChange={pick('industry')}>
            <option value="">Choose</option>
            {INDUSTRIES.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </Select>,
        )}
        {labelled(
          'Company size',
          'size',
          <Select id="size" value={f.size} onChange={pick('size')}>
            <option value="">Choose</option>
            {SIZES.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </Select>,
        )}
        {labelled(
          'Headquarters',
          'hq',
          <>
            <Input id="hq" list="hq-list" value={f.country} onChange={pick('country')} />
            <datalist id="hq-list">
              {COUNTRIES.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </>,
        )}
        <fieldset className="flex min-w-0 flex-col gap-1.5">
          <legend className="mb-1.5 text-[13px] font-medium">Card languages</legend>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(LANGS).map(([code, name]) => (
              <button
                key={code}
                type="button"
                aria-pressed={f.languages.includes(code)}
                disabled={code === 'en'}
                onClick={() => toggleLang(code)}
                className={cx('h-8 rounded-full px-3 text-[13px]', f.languages.includes(code) ? 'bg-ink text-white' : 'border border-[#E0D9CC] bg-white hover:border-ink')}
              >
                {name}
              </button>
            ))}
          </div>
        </fieldset>
      </section>
      {f.website && (
        <div className="flex items-center gap-3 rounded-xl border border-gold-line bg-[#FBF6EC] px-4 py-3.5 text-[14px] text-[#4E4A44]">
          <Icon name="sparkle" size={18} className="shrink-0 text-gold-text" />
          We will read {f.website} in the next step to prepare your brand kit.
        </div>
      )}
      <Nav next={<NextButton busy={busy} disabled={f.name.trim().length < 2} onClick={() => save(() => api.patch('/setup/company', f))} />} />
    </>
  );
}

/* ---------- 2 · Brand ---------- */

function BrandStep({ data, onBack, onNext }: { data: Setup; onBack: () => void; onNext: () => void }) {
  const [colors, setColors] = useState<{ name: string; use: string; hex: string }[]>(data.brand.colors);
  const [theme, setTheme] = useState<string>(data.brand.theme);
  const [fonts, setFonts] = useState(data.brand.fonts);
  const [logo, setLogo] = useState<string>(data.brand.logo);
  const [found, setFound] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const toast = useToast();
  const { busy, save } = useSave(onNext);
  const asked = useRef(false);

  // Read the website once, the first time this step opens
  useEffect(() => {
    if (asked.current || !data.company.website) return;
    asked.current = true;
    setReading(true);
    api
      .post('/brand/extract', { url: data.company.website })
      .then((r) => {
        setColors(r.colors);
        setTheme(r.theme);
        setFonts(r.fonts);
        setFound(`Found ${r.colors.length} colours and your fonts on ${data.company.website}${r.usedAi ? ', refined with AI' : ''}`);
      })
      .catch(() => setFound(null))
      .finally(() => setReading(false));
  }, [data.company.website]);

  const upload = async (file?: File) => {
    if (!file) return;
    setUploading(true);
    try {
      setLogo((await api.upload(file)).url);
    } catch (e) {
      toast((e as Error).message, 'err');
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      <Heading
        title={
          <>
            Welcome to Vellaire.
            <br />
            Let&apos;s set up your brand.
          </>
        }
        desc={
          data.company.website
            ? 'We read your website and prepared a brand kit. Check it, change anything, and continue.'
            : 'Add your logo and colours. You can refine everything later in Brand kit.'
        }
      />
      {reading && (
        <div className="flex items-center gap-3 rounded-xl bg-white px-4 py-3.5 text-[14px] text-stone">
          <Spinner size={16} /> Reading {data.company.website}…
        </div>
      )}
      {found && (
        <div className="flex items-center gap-3 rounded-xl bg-ok-bg px-4 py-3.5 text-[14px] text-ok">
          <Icon name="checkCircle" size={18} /> {found}
        </div>
      )}
      <section className="flex flex-col gap-4.5 rounded-2xl border border-linen bg-white p-5.5">
        <div className="flex flex-wrap items-center gap-4">
          <span className="flex h-16 w-30 items-center justify-center overflow-hidden rounded-[10px] bg-ink">
            {logo ? (
              <img src={logo} alt="Your logo" className="max-h-12 max-w-[85%] object-contain" />
            ) : (
              <span className="font-display text-[14px] tracking-[0.24em] text-gold-soft">{data.company.name.split(' ')[0].toUpperCase()}</span>
            )}
          </span>
          <span className="flex flex-1 flex-col gap-0.5">
            <span className="font-semibold">Logo</span>
            <span className="text-[13px] text-stone">{logo ? 'Uploaded' : 'SVG or PNG with a transparent background'}</span>
          </span>
          <label className="flex h-9.5 cursor-pointer items-center gap-2 rounded-lg border border-[#D9D2C4] bg-white px-3.5 text-[13px] hover:border-ink">
            {uploading && <Spinner size={14} />}
            {logo ? 'Replace' : 'Upload'}
            <input type="file" accept=".svg,.png,.webp" className="sr-only" onChange={(e) => upload(e.target.files?.[0])} />
          </label>
        </div>
        <div className="flex flex-col gap-2.5 border-t border-[#F0EBE2] pt-4">
          <span className="font-semibold">Colours</span>
          <div className="flex flex-wrap gap-3">
            {colors.map((c, i) => (
              <label key={i} className="flex cursor-pointer flex-col items-center gap-1.5">
                <span className="relative h-14 w-14 overflow-hidden rounded-xl border border-ink/10" style={{ background: c.hex }}>
                  <input
                    type="color"
                    aria-label={`${c.name} colour`}
                    value={c.hex}
                    onChange={(e) => setColors(colors.map((x, j) => (j === i ? { ...x, hex: e.target.value.toUpperCase() } : x)))}
                    className="absolute inset-0 cursor-pointer opacity-0"
                  />
                </span>
                <span className="font-mono text-[11px] text-stone">{c.hex}</span>
              </label>
            ))}
          </div>
        </div>
        <fieldset className="flex flex-col gap-2.5 border-t border-[#F0EBE2] pt-4">
          <legend className="sr-only">Theme</legend>
          <span className="font-semibold">Theme</span>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(170px,100%),1fr))] gap-2">
            {data.themes.map((t: any) => (
              <label
                key={t.id}
                className={cx('flex cursor-pointer items-center gap-2.5 rounded-[10px] p-3', theme === t.id ? 'border-2 border-gold bg-[#FBF6EC]' : 'border border-linen bg-white')}
              >
                <input type="radio" name="theme" checked={theme === t.id} onChange={() => setTheme(t.id)} className="h-4 w-4 accent-ink" />
                <span
                  className="h-6.5 w-6.5 shrink-0 rounded-full border border-ink/10"
                  style={{ background: t.bg, boxShadow: `inset 0 0 0 7px ${t.bg}, inset 0 0 0 13px ${t.accent}` }}
                />
                <span className="text-[13.5px] font-medium">{t.name}</span>
              </label>
            ))}
          </div>
        </fieldset>
      </section>
      <Nav
        onBack={onBack}
        next={<NextButton busy={busy} disabled={reading} onClick={() => save(() => api.patch('/setup/brand', { colors, theme, fonts, logo: logo || undefined }))} />}
      />
    </>
  );
}

/* ---------- 3 · Template ---------- */

function TemplateStep({ data, brand, onBack, onNext }: { data: Setup; brand: any; onBack: () => void; onNext: () => void }) {
  const [layout, setLayout] = useState<string>(data.layout);
  const { busy, save } = useSave(onNext);
  return (
    <>
      <Heading title="Choose a card layout." desc="Your brand is already applied. You can add more templates for different teams later." />
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
        {data.layouts.map((l: any) => (
          <label
            key={l.id}
            className={cx('flex cursor-pointer flex-col gap-3 rounded-2xl p-3.5', layout === l.id ? 'border-2 border-gold bg-[#FBF6EC]' : 'border border-linen bg-white')}
          >
            <CardFace layout={l.id} theme={data.brand.theme} fields={{ name: 'Your name', title: 'Your title' }} brand={brand} width="100%" />
            <span className="flex items-center justify-between gap-2">
              <span className="flex flex-col gap-0.5">
                <span className="text-[15px] font-semibold">{l.name}</span>
                <span className="text-[12.5px] text-stone">{l.desc}</span>
              </span>
              <input type="radio" name="layout" checked={layout === l.id} onChange={() => setLayout(l.id)} className="h-4.5 w-4.5 accent-ink" />
            </span>
          </label>
        ))}
      </div>
      <Nav onBack={onBack} next={<NextButton busy={busy} onClick={() => save(() => api.patch('/setup/template', { layout }))} />} />
    </>
  );
}

/* ---------- 4 · People ---------- */

function PeopleStep({ data, onBack, onNext }: { data: Setup; onBack: () => void; onNext: () => void }) {
  const [initialChoice, initialProvider] = String(data.people).split(':');
  const [choice, setChoice] = useState<string>(initialChoice || 'hr');
  const [provider, setProvider] = useState<string>(initialProvider || data.providers[0]?.id);
  const { busy, save } = useSave(onNext);
  const submit = (c = choice) => save(() => api.patch('/setup/people', { choice: c, provider: c === 'hr' ? provider : undefined }));
  const option = (id: string, title: React.ReactNode, sub: string, extra?: React.ReactNode) => (
    <label className={cx('flex cursor-pointer flex-col gap-4 rounded-2xl px-5.5 py-5', choice === id ? 'border-2 border-gold bg-[#FBF6EC]' : 'border border-linen bg-white')}>
      <span className="flex items-center justify-between gap-3">
        <span className="flex flex-col gap-0.5">
          <span className="flex items-center gap-2.5 text-[16px] font-semibold">{title}</span>
          <span className="text-[13.5px] text-stone">{sub}</span>
        </span>
        <input type="radio" name="how" checked={choice === id} onChange={() => setChoice(id)} className="h-4.5 w-4.5 accent-ink" />
      </span>
      {extra}
    </label>
  );
  const name = data.providers.find((p: any) => p.id === provider)?.name;

  return (
    <>
      <Heading title="How should we add your people?" desc="Connect your HR system and every employee gets a card automatically. You can change this later." />
      {option(
        'hr',
        <>
          Connect an HR or identity system
          <span className="rounded-full bg-ink px-2 py-0.5 text-[11px] font-medium text-[#E6D3A3]">Recommended</span>
        </>,
        'Joiners, title changes and leavers update cards on their own',
        choice === 'hr' && (
          <span className="grid grid-cols-[repeat(auto-fit,minmax(min(130px,100%),1fr))] gap-2">
            {data.providers.map((p: any) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setProvider(p.id)}
                aria-pressed={provider === p.id}
                className={cx('h-13 rounded-[10px] bg-white text-[13.5px]', provider === p.id ? 'border-2 border-ink font-semibold' : 'border border-linen hover:border-ink')}
              >
                {p.name}
              </button>
            ))}
          </span>
        ),
      )}
      {option('csv', 'Upload a spreadsheet', 'CSV with name, title and email')}
      {option('invite', 'Invite people by email', 'Good for small teams')}
      <button type="button" disabled={busy} onClick={() => submit('later')} className="self-start text-[14px] text-stone underline underline-offset-4 hover:text-ink">
        Skip for now, I&apos;ll do this later
      </button>
      <Nav
        onBack={onBack}
        next={
          <NextButton busy={busy} onClick={() => submit()}>
            {choice === 'hr' && name ? `Continue with ${name}` : 'Continue'}
          </NextButton>
        }
      />
    </>
  );
}

/* ---------- 5 · First card ---------- */

function DoneStep({ data, onBack }: { data: Setup; onBack: () => void }) {
  const router = useRouter();
  const { busy, save } = useSave(() => router.push('/app'));
  const [kind, provider] = String(data.people).split(':');
  const providerName = data.providers.find((p: any) => p.id === provider)?.name;
  const next: { icon: IconName; t: string; s: string; href: string }[] = [
    kind === 'hr' && { icon: 'dPlug', t: `Connect ${providerName}`, s: 'Sign in, check the field matches, then sync', href: `/app/integrations/${provider}` },
    kind === 'csv' && { icon: 'upload', t: 'Import your spreadsheet', s: 'Cards are prepared for everyone in the file', href: '/app/employees?import=1' },
    kind === 'invite' && { icon: 'dPeople', t: 'Invite your team', s: 'Add people one by one from Employees', href: '/app/employees' },
    { icon: 'nfc', t: 'Order NFC cards', s: 'Metal, wood or PVC, engraved with your brand', href: '/app/nfc' },
    { icon: 'dPeople', t: 'Invite a Brand Manager', s: 'Share the work of approving changes', href: '/app/settings/team' },
  ].filter(Boolean) as any;
  const wallet = (k: 'apple' | 'google', label: string) =>
    data.wallet[k] && data.card ? (
      <a href={`/api/public/cards/${data.card.id}/wallet/${k}`} className="flex h-12 items-center gap-2 rounded-[10px] bg-black px-4.5 text-[14px] text-white">
        <Icon name="wallet" size={17} /> {label}
      </a>
    ) : (
      <span
        title="Wallet passes are set up by the Vellaire team"
        className="flex h-12 cursor-not-allowed items-center gap-2 rounded-[10px] bg-black/40 px-4.5 text-[14px] text-white"
      >
        <Icon name="wallet" size={17} /> {label}
      </span>
    );

  return (
    <>
      <div className="flex flex-col gap-2.5">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-ink text-[#E6D3A3]">
          <Icon name="check" size={24} strokeWidth={2} />
        </span>
        <Heading title={`Your first card is ready, ${data.firstName}.`} desc="Add it to your phone and try it. Then bring in your team from the steps below." />
      </div>
      <div className="flex flex-wrap gap-2.5">
        {wallet('apple', 'Add to Apple Wallet')}
        {wallet('google', 'Add to Google Wallet')}
        {data.card && (
          <a
            href={data.card.url}
            target="_blank"
            rel="noreferrer"
            className="flex h-12 items-center rounded-[10px] border border-[#D9D2C4] bg-white px-4.5 text-[14px] hover:border-ink"
          >
            View my card
          </a>
        )}
      </div>
      <section className="overflow-hidden rounded-2xl border border-linen bg-white">
        <div className="px-5 pb-1.5 pt-4.5 text-[16px] font-semibold">Recommended next</div>
        {next.map((n) => (
          <Link
            key={n.t}
            href={n.href}
            onClick={() => api.post('/setup/finish').catch(() => {})}
            className="flex items-center gap-3.5 border-t border-[#F0EBE2] px-5 py-3.5 hover:bg-[#FAF7F1]"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-gold-tint text-gold-text">
              <Icon name={n.icon} size={18} />
            </span>
            <span className="flex flex-1 flex-col gap-0.5">
              <span className="font-semibold">{n.t}</span>
              <span className="text-[13px] text-stone">{n.s}</span>
            </span>
            <Icon name="dRight" size={16} className="text-stone-2" />
          </Link>
        ))}
      </section>
      <Nav
        onBack={onBack}
        next={
          <NextButton busy={busy} onClick={() => save(() => api.post('/setup/finish'))}>
            Go to dashboard
          </NextButton>
        }
      />
    </>
  );
}
