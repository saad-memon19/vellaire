import type { Metadata } from 'next';
import Link from 'next/link';
import { Icon, Seal } from '@/components/icons';
import { BrandControl, DemoButton } from './landing-client';

export const metadata: Metadata = {
  title: { absolute: 'Vellaire — Every introduction, perfected' },
};

/* Faithful build of the "Landing page (M1)" artboard. */

const INTEGRATIONS: [string, string][] = [
  ['Workday', 'HR'], ['SAP SuccessFactors', 'HR'], ['Oracle HCM', 'HR'], ['BambooHR', 'HR'],
  ['Microsoft Entra ID', 'IDENTITY'], ['Google Workspace', 'IDENTITY'], ['Okta', 'IDENTITY'], ['Personio', 'HR'],
  ['HiBob', 'HR'], ['Zoho People', 'HR'], ['Odoo', 'ERP'], ['ADP', 'HR'],
  ['Salesforce', 'CRM'], ['HubSpot', 'CRM'], ['Dynamics 365', 'CRM'], ['Custom API', 'REST · SCIM'],
];

const COLLECTION: { name: string; desc: string; bg: string; color: string; border?: string }[] = [
  { name: 'Obsidian Metal', desc: 'Black stainless steel, gold-filled engraving', bg: 'linear-gradient(135deg,#1F1F24,#0B0B0D 45%,#2A2A30 58%,#0B0B0D)', color: '#C9A96E', border: '1px solid rgba(201,169,110,0.35)' },
  { name: 'Brushed Steel', desc: 'Satin finish, deep laser engraving', bg: 'repeating-linear-gradient(90deg, rgba(255,255,255,0.06) 0 1px, rgba(0,0,0,0) 1px 3px), linear-gradient(135deg,#B8BCC2,#8C9097 40%,#D3D6DA 55%,#9A9EA4)', color: '#2A2A30' },
  { name: '24K Gold', desc: 'Gold-plated metal, for leadership', bg: 'linear-gradient(135deg,#B8955A,#E6D3A3 38%,#C9A96E 55%,#9C7A44)', color: '#3A2C14' },
  { name: 'Walnut', desc: 'Sustainably sourced, laser engraved', bg: 'repeating-linear-gradient(100deg, rgba(0,0,0,0.08) 0 2px, rgba(0,0,0,0) 2px 9px), linear-gradient(135deg,#6B4429,#4A2E1B 50%,#5C3A22)', color: '#E9D8BE' },
];

const AI: { icon: string; title: string; desc: string }[] = [
  { icon: 'sparkle', title: 'Bio writer', desc: 'Drafts a polished bio from a title and three keywords, in your company’s voice.' },
  { icon: 'globe', title: 'Translation', desc: 'Arabic, French, Chinese and more — with right-to-left layouts done properly.' },
  { icon: 'brush', title: 'Brand extraction', desc: 'Paste your website. Receive a proposed palette, type pairing and theme.' },
  { icon: 'shield', title: 'Sync guard', desc: 'Pauses an HR sync that looks wrong — before 200 cards switch off by mistake.' },
];

const TRUST: [string, string][] = [
  ['SSO and SCIM', 'SAML, OIDC and automatic provisioning from your identity provider.'],
  ['Data residency', 'Host in the EU, the United States or the Middle East.'],
  ['Encrypted throughout', 'TLS 1.3 in transit, AES-256 at rest, tenant isolation in the database.'],
  ['Never trains AI', 'Your people’s data is never used to train any model.'],
];

const eyebrow = 'text-[12px] font-medium tracking-[0.24em] text-gold-text';
const h2 = 'm-0 font-display font-normal leading-[1.04] text-[clamp(40px,4.6vw,64px)]';
const QR = ({ size, cell, dark = '#17171B', light = '#FFFFFF', border = 4 }: { size: number; cell: number; dark?: string; light?: string; border?: number }) => (
  <div aria-hidden="true" style={{ width: size, height: size, background: `repeating-conic-gradient(${dark} 0 25%, ${light} 0 50%) 0 0 / ${cell}px ${cell}px`, border: `${border}px solid ${dark}` }} />
);
const Check = ({ size = 20, className = '' }: { size?: number; className?: string }) => <Icon name="check" size={size} className={className} />;

export default function Landing() {
  return (
    <div className="overflow-hidden bg-pearl text-ink">
      {/* NAV */}
      <header className="relative z-[2]">
        <nav aria-label="Main" className="mx-auto flex max-w-[1304px] flex-wrap items-center justify-between gap-6 px-8 py-6">
          <a href="#top" className="flex items-center gap-3 text-ink">
            <Seal size={32} className="text-gold" />
            <span className="font-display text-[22px] font-semibold tracking-[0.24em]">VELLAIRE</span>
          </a>
          <div className="hidden gap-9 text-[14px] min-[901px]:flex">
            {[
              ['Product', '#product'],
              ['Automation', '#automation'],
              ['Integrations', '#integrations'],
              ['NFC & Wallet', '#collection'],
              ['Security', '#trust'],
            ].map(([l, h]) => (
              <a key={h} href={h} className="text-[#4E4A44] hover:text-ink">
                {l}
              </a>
            ))}
          </div>
          <div className="flex items-center gap-5">
            <Link href="/signin" className="text-[14px] text-[#4E4A44] hover:text-ink">
              Sign in
            </Link>
            <DemoButton className="rounded-md bg-ink px-5 py-3 text-[14px] font-medium text-white hover:bg-[#2E2E35]">Book a private demo</DemoButton>
          </div>
        </nav>
      </header>

      {/* HERO */}
      <section id="top" style={{ background: 'radial-gradient(45% 55% at 74% 42%, rgba(176,141,79,0.18), rgba(247,245,240,0) 70%)' }}>
        <div className="mx-auto grid min-h-[804px] max-w-[1304px] items-center gap-16 px-8 pb-28 pt-[72px]" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(500px, 100%), 1fr))' }}>
          <div className="flex flex-col gap-[30px]">
            <div className="inline-flex items-center gap-2.5 self-start rounded-full border border-linen bg-white px-3.5 py-[7px] text-[12px] font-medium tracking-[0.16em] text-gold-text">
              <span className="h-1.5 w-1.5 rounded-full bg-gold" />
              THE IDENTITY PLATFORM FOR DISTINGUISHED COMPANIES
            </div>
            <h1 className="m-0 font-display font-normal leading-[0.98] tracking-[-0.01em] text-[clamp(54px,6.6vw,96px)]" style={{ textWrap: 'balance' }}>
              Every introduction, <em className="font-normal text-gold-text">perfected.</em>
            </h1>
            <p className="m-0 max-w-[520px] text-[19px] leading-[1.6] text-stone">Branded digital business cards for your entire company — created from your HR system, shared by tap, scan or wallet.</p>
            <div className="flex flex-wrap gap-3.5">
              <DemoButton className="inline-flex items-center gap-2.5 rounded-md bg-ink px-[30px] py-[17px] text-[15px] font-semibold text-white hover:bg-[#2E2E35]">
                Book a private demo <Icon name="arrow" size={20} className="text-[#E6D3A3]" />
              </DemoButton>
              <Link href="/signin" className="inline-flex items-center gap-2.5 rounded-md border border-[#D9D2C4] bg-white px-6 py-[17px] text-[15px] text-ink hover:border-gold">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="text-gold-text">
                  <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM10 8.5l5.5 3.5-5.5 3.5z" />
                </svg>
                See the dashboard
              </Link>
            </div>
            <div className="flex flex-wrap gap-7 text-[13px] text-stone-2">
              <span className="flex items-center gap-2">
                <Check size={16} className="text-gold" />
                Syncs with Workday, SAP and Entra ID
              </span>
              <span className="flex items-center gap-2">
                <Check size={16} className="text-gold" />
                Apple and Google Wallet
              </span>
            </div>
          </div>

          <div className="relative flex h-[470px] items-center justify-center">
            {/* back card: white with QR */}
            <div
              className="absolute flex aspect-[452/304] w-[452px] max-w-[82%] flex-col justify-between rounded-[18px] border border-linen bg-white p-[26px]"
              style={{ transform: 'translate(74px, -70px) rotate(8deg)', boxShadow: '0 30px 60px rgba(23,23,27,0.12)' }}
            >
              <div className="flex items-start justify-between">
                <Seal size={28} className="text-ink" />
                <QR size={66} cell={16} />
              </div>
              <div className="font-mono text-[11px] text-stone">cards.meridian.com/sara-khan</div>
            </div>
            {/* front card: obsidian */}
            <div
              className="vl-float relative aspect-[1.586] w-[440px] max-w-[90%] overflow-hidden rounded-[18px]"
              style={{ background: 'linear-gradient(135deg, #1C1C20 0%, #0E0E10 42%, #26262C 56%, #0C0C0E 100%)', border: '1px solid rgba(201,169,110,0.4)', boxShadow: '0 50px 90px rgba(23,23,27,0.35)' }}
            >
              <div className="vl-sheen absolute inset-0" />
              <div className="relative flex h-full flex-col justify-between p-[30px] text-cream">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Seal size={30} className="text-gold-soft" />
                    <span className="text-[11px] tracking-[0.28em] text-gold-soft">MERIDIAN CAPITAL</span>
                  </div>
                  <Icon name="nfc" size={24} className="text-gold-soft" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <div className="font-display text-[34px]">Sara Khan</div>
                  <div className="h-px w-14 bg-gold-soft" />
                  <div className="text-[13px] tracking-[0.06em] text-[#A9A49A]">Head of Private Clients</div>
                </div>
              </div>
            </div>
            {/* toast */}
            <div className="absolute bottom-[18px] left-0 flex items-center gap-3 rounded-[14px] border border-linen bg-white px-4 py-3.5" style={{ boxShadow: '0 18px 36px rgba(23,23,27,0.10)' }}>
              <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-ok-bg text-ok">
                <Check />
              </span>
              <span className="flex flex-col gap-px">
                <span className="text-[14px] font-semibold">Card created from Workday</span>
                <span className="text-[12px] text-stone-2">Omar Haddad · just now</span>
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* PROOF */}
      <section aria-label="Clients" className="border-y border-linen bg-white">
        <div className="mx-auto flex max-w-[1304px] flex-wrap items-center justify-between gap-12 p-8">
          <div className="text-[12px] tracking-[0.2em] text-stone-2">TRUSTED BY</div>
          <div className="flex flex-wrap gap-14 font-display text-[22px] tracking-[0.12em] text-[#8E887E]">
            {Array.from({ length: 5 }).map((_, i) => (
              <span key={i}>[CLIENT LOGO]</span>
            ))}
          </div>
        </div>
      </section>

      {/* TOUCHPOINTS */}
      <section id="product" className="mx-auto flex max-w-[1304px] flex-col gap-14 px-8 pb-28 pt-32">
        <div className="flex max-w-[720px] flex-col gap-[18px]">
          <div className={eyebrow}>ONE IDENTITY</div>
          <h2 className={h2}>The card, everywhere your people introduce themselves.</h2>
        </div>
        <div className="grid gap-6" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(388px, 100%), 1fr))' }}>
          <article className="lift flex flex-col gap-[22px] rounded-2xl border border-linen bg-white p-6">
            <div className="flex h-[210px] items-center justify-center rounded-xl bg-sand">
              <div className="flex w-[256px] flex-col gap-3 rounded-[14px] bg-ink p-[18px] text-cream" style={{ boxShadow: '0 16px 32px rgba(23,23,27,0.2)' }}>
                <div className="flex justify-between text-[9.5px] tracking-[0.2em] text-gold-soft">
                  <span>MERIDIAN</span>
                  <span>PASS</span>
                </div>
                <div className="font-display text-[22px]">Sara Khan</div>
                <div className="flex justify-center">
                  <QR size={58} cell={14} dark="#F6F1E7" light="#17171B" border={3} />
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <h3 className="m-0 text-[19px] font-semibold">Apple and Google Wallet</h3>
              <p className="m-0 text-[15px] leading-[1.6] text-stone">A branded pass in every phone. When a title changes in HR, the pass updates itself.</p>
            </div>
          </article>
          <article className="lift flex flex-col gap-[22px] rounded-2xl border border-linen bg-white p-6">
            <div className="flex h-[210px] items-center justify-center gap-[18px] rounded-xl bg-sand">
              <div
                className="aspect-[1.586] w-[150px] rounded-[10px]"
                style={{ background: 'linear-gradient(135deg,#1C1C20,#0E0E10 45%,#26262C 58%,#0C0C0E)', border: '1px solid rgba(201,169,110,0.35)', transform: 'rotate(-12deg)', boxShadow: '0 16px 32px rgba(23,23,27,0.25)' }}
              />
              <Icon name="nfc" size={34} className="text-gold" />
              <div className="h-[134px] w-[72px] rounded-2xl border-[1.5px] border-ink bg-white" />
            </div>
            <div className="flex flex-col gap-2">
              <h3 className="m-0 text-[19px] font-semibold">NFC tap</h3>
              <p className="m-0 text-[15px] leading-[1.6] text-stone">Engraved metal, wood or PVC. One tap opens the card on any modern phone — no app needed.</p>
            </div>
          </article>
          <article className="lift flex flex-col gap-[22px] rounded-2xl border border-linen bg-white p-6">
            <div className="flex h-[210px] items-center justify-center rounded-xl bg-sand">
              <div className="flex w-[336px] max-w-[90%] items-center gap-3.5 rounded-[10px] bg-white px-[18px] py-4" style={{ boxShadow: '0 16px 32px rgba(23,23,27,0.10)' }}>
                <div className="w-0.5 self-stretch bg-gold" />
                <div className="flex flex-1 flex-col gap-[3px]">
                  <div className="font-display text-[19px] font-semibold">Sara Khan</div>
                  <div className="text-[11px] text-stone">Head of Private Clients · Meridian</div>
                  <div className="text-[11px] text-stone">+971 4 000 0000</div>
                </div>
                <QR size={44} cell={11} border={3} />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <h3 className="m-0 text-[19px] font-semibold">Signatures and backgrounds</h3>
              <p className="m-0 text-[15px] leading-[1.6] text-stone">Deployed centrally to Outlook and Gmail, plus branded backgrounds for Zoom, Teams and Meet.</p>
            </div>
          </article>
        </div>
      </section>

      {/* AUTOMATION */}
      <section id="automation" className="border-y border-linen bg-white">
        <div className="mx-auto flex max-w-[1304px] flex-col gap-16 px-8 py-32">
          <div className="grid items-end gap-12" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(460px, 100%), 1fr))' }}>
            <div className="flex flex-col gap-[18px]">
              <div className={eyebrow}>ZERO-TOUCH AUTOMATION</div>
              <h2 className={h2}>
                Hired on Monday. <em className="text-gold-text">Card by Monday.</em>
              </h2>
            </div>
            <p className="m-0 max-w-[480px] text-[17px] leading-[1.7] text-stone">Connect your HR system once. Every joiner, promotion and departure then flows to their card, wallet pass and NFC card — no forms, no printing, no brand drift.</p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-4 rounded-[20px] border border-[#EEE8DD] bg-pearl p-10">
            <div className="flex max-w-[324px] flex-[1_1_264px] flex-col gap-2 rounded-[14px] border border-linen bg-white p-[22px]">
              <div className="text-[11px] tracking-[0.2em] text-stone-2">HR SYSTEM</div>
              <div className="text-[17px] font-semibold">New hire: Omar Haddad</div>
              <div className="text-[13px] text-stone">Associate · Dubai · starts 3 Nov</div>
            </div>
            <Icon name="arrow" size={28} className="text-[#B9AE98]" />
            <div className="flex h-[120px] w-[120px] items-center justify-center rounded-full bg-ink" style={{ boxShadow: '0 0 0 10px rgba(176,141,79,0.14)' }}>
              <Seal size={56} className="text-gold-soft" />
            </div>
            <Icon name="arrow" size={28} className="text-[#B9AE98]" />
            <div className="flex max-w-[300px] flex-[1_1_220px] flex-col gap-2.5">
              {['Card published', 'Wallet pass sent', 'Metal NFC card ordered'].map((s, i) => (
                <div key={s} className={`flex items-center justify-between rounded-[10px] border bg-white px-[18px] py-3.5 ${i === 0 ? 'border-[#D9C9A6]' : 'border-linen'}`}>
                  <span>{s}</span>
                  <Check className="text-ok" />
                </div>
              ))}
            </div>
          </div>
          <div className="grid gap-6" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(300px, 100%), 1fr))' }}>
            {[
              ['Joiners', 'A card is created from the department’s template, approved if your policy requires it, and delivered with a welcome pack.'],
              ['Movers', 'New title, new office, new number — the card, wallet pass and signature update. The NFC card keeps working.'],
              ['Leavers', 'On the last day, the card turns off, wallet passes are voided and the NFC chip is disabled. Leads stay with the company.'],
            ].map(([t, d]) => (
              <div key={t} className="flex flex-col gap-2.5 border-t border-gold pt-[22px]">
                <div className="font-display text-[30px] font-medium">{t}</div>
                <p className="m-0 leading-[1.65] text-stone">{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* BRAND DEMO */}
      <BrandControl eyebrowClass={eyebrow} h2Class={h2} />

      {/* INTEGRATIONS */}
      <section id="integrations" className="border-y border-linen bg-white">
        <div className="mx-auto flex max-w-[1304px] flex-col gap-12 px-8 py-28">
          <div className="flex flex-wrap items-end justify-between gap-8">
            <div className="flex max-w-[640px] flex-col gap-[18px]">
              <div className={eyebrow}>INTEGRATIONS</div>
              <h2 className="m-0 font-display font-normal leading-[1.06] text-[clamp(36px,4vw,56px)]">Connected to the systems you already trust.</h2>
            </div>
            <a href="#integrations" className="inline-flex items-center gap-2 text-[15px] font-medium text-gold-text hover:text-ink">
              View all integrations <Icon name="arrow" size={20} />
            </a>
          </div>
          <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(260px, 100%), 1fr))' }}>
            {INTEGRATIONS.map(([n, k]) => (
              <div key={n} className="flex items-center justify-between rounded-xl border border-linen bg-pearl p-5">
                <span className="text-[16px] font-medium">{n}</span>
                <span className="rounded-full border border-linen bg-white px-2 py-[3px] text-[10.5px] tracking-[0.14em] text-stone-2">{k}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* AI */}
      <section className="mx-auto flex max-w-[1304px] flex-col gap-14 px-8 py-32">
        <div className="flex max-w-[720px] flex-col gap-[18px]">
          <div className={eyebrow}>INTELLIGENCE</div>
          <h2 className={h2}>Intelligence, quietly applied.</h2>
        </div>
        <div className="grid gap-5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(312px, 100%), 1fr))' }}>
          {AI.map((a) => (
            <article key={a.title} className="lift flex flex-col gap-3.5 rounded-2xl border border-linen bg-white p-[26px]">
              <span className="flex h-[46px] w-[46px] items-center justify-center rounded-xl bg-gold-tint text-gold-text">
                <Icon name={a.icon} size={20} />
              </span>
              <h3 className="m-0 text-[18px] font-semibold">{a.title}</h3>
              <p className="m-0 text-[15px] leading-[1.65] text-stone">{a.desc}</p>
            </article>
          ))}
        </div>
      </section>

      {/* COLLECTION */}
      <section id="collection" className="bg-sand">
        <div className="mx-auto flex max-w-[1304px] flex-col gap-14 px-8 py-32">
          <div className="flex max-w-[720px] flex-col gap-[18px]">
            <div className={eyebrow}>THE COLLECTION</div>
            <h2 className={h2}>Objects worth handing over.</h2>
            <p className="m-0 text-[17px] leading-[1.7] text-[#4E4A44]">Secure NTAG 424 DNA chips that cannot be cloned, engraved with your brand kit and delivered in a presentation box.</p>
          </div>
          <div className="grid gap-7" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(260px, 100%), 1fr))' }}>
            {COLLECTION.map((c) => (
              <figure key={c.name} className="m-0 flex flex-col gap-4">
                <div className="flex aspect-[1.586] items-end rounded-[14px] p-5 font-display text-[20px]" style={{ background: c.bg, color: c.color, border: c.border, boxShadow: '0 24px 48px rgba(23,23,27,0.2)' }}>
                  Sara Khan
                </div>
                <figcaption className="flex flex-col gap-1">
                  <span className="text-[17px] font-semibold">{c.name}</span>
                  <span className="text-[14px] text-stone">{c.desc}</span>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* TRUST */}
      <section id="trust" className="border-b border-linen bg-white">
        <div className="mx-auto grid max-w-[1304px] gap-9 px-8 py-[88px]" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(240px, 100%), 1fr))' }}>
          {TRUST.map(([t, d]) => (
            <div key={t} className="flex flex-col gap-2.5">
              <div className="font-display text-[26px] font-medium">{t}</div>
              <div className="leading-[1.6] text-stone">{d}</div>
            </div>
          ))}
        </div>
      </section>

      {/* TESTIMONIAL */}
      <section>
        <figure className="mx-auto flex max-w-[1044px] flex-col items-center gap-[30px] px-8 py-[120px] text-center">
          <Seal size={40} className="text-gold" />
          <blockquote className="m-0 font-display font-normal italic leading-[1.25] text-[clamp(30px,3.4vw,46px)]">“[Client testimonial — one sentence from a launch customer.]”</blockquote>
          <figcaption className="text-[14px] tracking-[0.08em] text-stone-2">[NAME], [TITLE] · [COMPANY]</figcaption>
        </figure>
      </section>

      {/* CTA */}
      <section id="demo" className="px-8 pb-28">
        <div
          className="mx-auto flex max-w-[1240px] flex-col items-center gap-[30px] rounded-[28px] border border-line px-8 py-24 text-center"
          style={{ background: 'radial-gradient(60% 90% at 50% 0%, rgba(176,141,79,0.22), rgba(239,233,221,0) 70%), #EFE9DD' }}
        >
          <h2 className="m-0 max-w-[820px] font-display font-normal leading-[1.02] text-[clamp(42px,5vw,72px)]" style={{ textWrap: 'balance' }}>
            Your company deserves a better first impression.
          </h2>
          <p className="m-0 max-w-[560px] text-[17px] leading-[1.7] text-[#4E4A44]">A 30-minute private walkthrough, tailored to your HR system and brand.</p>
          <DemoButton className="rounded-md bg-ink px-[34px] py-[18px] text-[15px] font-semibold text-white hover:bg-[#2E2E35]">Book a private demo</DemoButton>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-linen bg-white">
        <div className="mx-auto flex max-w-[1304px] flex-col gap-12 px-8 pb-10 pt-16">
          <div className="grid gap-10" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(180px, 100%), 1fr))' }}>
            <div className="flex flex-col gap-3.5">
              <div className="flex items-center gap-2.5">
                <Seal size={26} className="text-gold" />
                <span className="font-display text-[18px] font-semibold tracking-[0.24em]">VELLAIRE</span>
              </div>
              <div className="font-display text-[17px] italic text-stone">Your identity, impeccably shared.</div>
            </div>
            {(
              [
                ['PRODUCT', [['Digital cards', '#product'], ['Automation', '#automation'], ['NFC and Wallet', '#collection'], ['Integrations', '#integrations']]],
                ['COMPANY', [['About', '#top'], ['Customers', '#top'], ['Journal', '#top'], ['Contact', '#demo']]],
                ['RESOURCES', [['Trust center', '#trust'], ['Help center', '#top'], ['Developers', '#top'], ['Status', '#top']]],
              ] as [string, string[][]][]
            ).map(([h, links]) => (
              <div key={h} className="flex flex-col gap-3 text-[14px]">
                <div className="text-[11px] tracking-[0.14em] text-stone-2">{h}</div>
                {links.map(([l, href]) => (
                  <a key={l} href={href} className="text-[#4E4A44] hover:text-ink">
                    {l}
                  </a>
                ))}
              </div>
            ))}
          </div>
          <div className="flex flex-wrap justify-between gap-4 border-t border-[#EEE8DD] pt-6 text-[13px] text-stone-2">
            <span>© 2026 Vellaire. All rights reserved.</span>
            <div className="flex gap-6">
              <a href="#top" className="hover:text-ink">
                Privacy
              </a>
              <a href="#top" className="hover:text-ink">
                Terms
              </a>
              <a href="#top" className="hover:text-ink">
                English (Global)
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
