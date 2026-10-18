'use client';

import Link from 'next/link';
import { Icon, IconName, Seal } from '@/components/icons';
import { Avatar } from '@/components/ui';
import { api } from '@/lib/api';

/*
 * The employee app's system screens from the design (section 10): splash, loading, offline, error,
 * signed out, access ended and update. They show only real facts about the person's account.
 */

const LAST = 'vellaire.lastUser';
export type LastUser = { name: string; email: string; company?: string; syncedAt?: string };

/** The last signed-in person on this phone, for the splash and "Please sign in again". */
export function rememberUser(u: LastUser) {
  try {
    localStorage.setItem(LAST, JSON.stringify({ ...u, syncedAt: new Date().toISOString() }));
  } catch {}
}
export function lastUser(): LastUser | null {
  try {
    return JSON.parse(localStorage.getItem(LAST) || 'null');
  } catch {
    return null;
  }
}

const btn = 'flex h-[54px] w-full items-center justify-center gap-2.5 rounded-[14px] bg-ink text-[15px] font-semibold text-white';
const btn2 = 'flex h-[52px] w-full items-center justify-center gap-2.5 rounded-[14px] border border-[#D9D2C4] bg-white text-[15px]';

function Badge({ icon, tone }: { icon: IconName; tone: 'gold' | 'err' | 'warn' | 'plain' }) {
  const t = { gold: 'bg-gold-tint border-gold-line text-gold-text', err: 'bg-err-bg border-[#F0CDD3] text-err', warn: 'bg-white border-linen text-warn', plain: 'bg-white border-linen text-stone' }[tone];
  return (
    <div className={`flex h-[88px] w-[88px] items-center justify-center self-center rounded-full border ${t}`}>
      <Icon name={icon} size={34} />
    </div>
  );
}

function Screen({ children, footer }: { children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-[440px] flex-col gap-4 bg-pearl px-5 pb-[26px] pt-14">
      <div className="flex flex-1 flex-col justify-center gap-[18px]">{children}</div>
      {footer}
    </main>
  );
}

const Title = ({ children }: { children: React.ReactNode }) => <h1 className="m-0 text-center font-display text-[34px] font-medium leading-[1.1]">{children}</h1>;
const Text = ({ children }: { children: React.ReactNode }) => <p className="m-0 text-center text-[15px] leading-[1.55] text-stone">{children}</p>;

/** App launch: seal, wordmark and the company the card belongs to. */
export function AppSplash() {
  const company = typeof window === 'undefined' ? null : lastUser()?.company;
  return (
    <main className="relative mx-auto flex min-h-screen max-w-[440px] flex-col overflow-hidden px-5 pb-[34px] pt-14" style={{ background: 'radial-gradient(55% 40% at 50% 44%, rgba(176,141,79,0.20), rgba(247,245,240,0) 70%), #F7F5F0' }}>
      <div className="flex flex-1 flex-col items-center justify-center gap-[22px]">
        <Seal size={64} className="animate-pulse text-gold" />
        <span className="pl-[0.32em] font-display text-[30px] font-semibold tracking-[0.32em]">VELLAIRE</span>
        <span className="mt-2.5 h-0.5 w-[120px] overflow-hidden rounded bg-linen">
          <span className="block h-0.5 w-1/2 animate-pulse bg-gold" />
        </span>
      </div>
      {company && (
        <div className="flex flex-col items-center gap-1 pb-[18px]">
          <span className="text-[11px] tracking-[0.22em] text-[#8E887E]">CARD BY</span>
          <span className="font-display text-[15px] font-semibold tracking-[0.3em]">{company.toUpperCase()}</span>
        </div>
      )}
    </main>
  );
}

/** Loading the card: the My card layout in grey, inside the app's frame. */
export function AppLoading() {
  const sk = 'animate-pulse rounded-md bg-[#ECE6DB]';
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-label="Loading your card">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-2">
          <span className={`${sk} h-3 w-[90px]`} />
          <span className={`${sk} h-[26px] w-[130px]`} />
        </div>
        <span className={`${sk} h-11 w-11 rounded-full`} />
      </div>
      <span className={`${sk} aspect-[1.586] w-full rounded-[18px]`} />
      <span className={`${sk} h-3 w-[200px] self-center`} />
      <div className="grid grid-cols-2 gap-2.5">
        <span className={`${sk} h-[54px] rounded-[14px]`} />
        <span className={`${sk} h-[54px] rounded-[14px]`} />
      </div>
      <span className={`${sk} h-[86px] rounded-2xl`} />
      <span className={`${sk} h-[70px] rounded-2xl`} />
      <span className="mt-2 text-center text-[12.5px] text-[#8E887E]">Getting your card ready…</span>
    </div>
  );
}

/** No connection while the app needed data. The QR is kept on the phone by the service worker. */
export function AppOffline({ retry }: { retry: () => void }) {
  const synced = typeof window === 'undefined' ? null : lastUser()?.syncedAt;
  return (
    <div className="flex min-h-[calc(100vh-150px)] flex-col gap-4">
      <div className="flex items-center gap-2.5 rounded-xl bg-warn-bg px-3.5 py-2.5 text-[13px] text-warn">
        <Icon name="alert" size={18} />
        <span className="flex-1">No internet connection</span>
        {synced && <span className="font-mono text-[11px]">Synced {new Date(synced).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>}
      </div>
      <div className="flex flex-1 flex-col justify-center gap-[18px]">
        <Badge icon="alert" tone="warn" />
        <Title>You are offline</Title>
        <Text>Your card still works. Show your QR code or tap your NFC card as usual. New views and leads will appear when you are back online.</Text>
        <section className="overflow-hidden rounded-2xl border border-linen bg-white">
          {[
            ['Show QR and NFC tap', 'Works'],
            ['Wallet pass', 'Works'],
          ].map(([what, state], i) => (
            <div key={what} className={`flex items-center gap-3 px-4 py-[13px] ${i ? 'border-t border-[#F0EBE2]' : ''}`}>
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-ok-bg text-ok">
                <Icon name="check" size={16} />
              </span>
              <span className="flex-1 text-[14px]">{what}</span>
              <span className="text-[12.5px] text-ok">{state}</span>
            </div>
          ))}
        </section>
      </div>
      <Link href="/m/qr" className={btn}>
        <Icon name="qr" size={20} className="text-[#E6D3A3]" /> Show my QR
      </Link>
      <button type="button" onClick={retry} className={btn2}>
        Try again
      </button>
    </div>
  );
}

/** A page of the app failed to load. */
export function AppError({ retry, error }: { retry?: () => void; error?: unknown }) {
  const message = (error as Error)?.message;
  return (
    <Screen
      footer={
        <>
          {retry && (
            <button type="button" onClick={retry} className={btn}>
              Try again
            </button>
          )}
          <Link href="/m/settings" className={btn2}>
            <Icon name="info" size={20} className="text-gold-text" /> Help
          </Link>
          <Link href="/m" className="p-2 text-center text-[14px]">
            Back to my card
          </Link>
        </>
      }
    >
      <Badge icon="alert" tone="err" />
      <Title>Something went wrong</Title>
      <Text>We could not load this page. Your card is safe and still live for everyone you share it with.</Text>
      <span className="self-center rounded-lg bg-[#EFE9DD] px-2.5 py-1.5 font-mono text-[11.5px] text-[#8E887E]">
        {message ? `${message.slice(0, 60)} · ` : ''}
        {new Date().toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
      </span>
    </Screen>
  );
}

/** Signed out (the session lasts 30 days): sign in again as the same person. */
export function SessionExpired() {
  const u = typeof window === 'undefined' ? null : lastUser();
  const next = encodeURIComponent('/m');
  return (
    <Screen
      footer={
        <>
          <Link href={`/signin?next=${next}${u ? `&email=${encodeURIComponent(u.email)}` : ''}`} className={btn}>
            Sign in again
          </Link>
          <Link href={`/signin?next=${next}`} className="p-2 text-center text-[14px]">
            Use a different account
          </Link>
        </>
      }
    >
      <Badge icon="lock" tone="gold" />
      <Title>Please sign in again</Title>
      <Text>For your security, you are signed out every 30 days. Your card stays live while you are signed out.</Text>
      {u && (
        <div className="flex items-center gap-3 rounded-[14px] border border-linen bg-white px-3.5 py-3">
          <Avatar name={u.name} size={40} />
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-[14.5px] font-medium">{u.name}</span>
            <span className="truncate text-[12.5px] text-stone">{u.email}</span>
          </span>
        </div>
      )}
    </Screen>
  );
}

/** The company switched the card off (the person left). */
export function AccessEnded({ company }: { company?: string }) {
  const signOut = async () => {
    await api.post('/auth/logout').catch(() => {});
    window.location.href = '/signin';
  };
  return (
    <Screen
      footer={
        <>
          <a href="/api/leads/export" className={btn2}>
            <Icon name="download" size={20} className="text-gold-text" /> Download my leads
          </a>
          <button type="button" onClick={signOut} className="p-2 text-center text-[14px]">
            Sign out
          </button>
        </>
      }
    >
      <div className="flex justify-center pt-2.5">
        <Seal size={26} className="text-gold" />
      </div>
      <Badge icon="user" tone="plain" />
      <Title>Your access has ended</Title>
      <Text>{company || 'Your company'} has closed your company card. People who open your old link now see the company’s page.</Text>
      <section className="flex flex-col gap-2.5 rounded-2xl border border-linen bg-white p-4">
        <span className="text-[12px] font-semibold tracking-[0.14em] text-gold-text">BEFORE YOU GO</span>
        <span className="flex gap-2.5 text-[14px] leading-normal">
          <Icon name="download" size={18} className="mt-0.5 shrink-0 text-gold-text" /> Download the leads people shared with you, while you still can.
        </span>
        <span className="flex gap-2.5 text-[14px] leading-normal">
          <Icon name="info" size={18} className="mt-0.5 shrink-0 text-gold-text" /> Think this is a mistake? Contact your HR team.
        </span>
      </section>
    </Screen>
  );
}

/** A new version of the app was installed in the background. */
export function AppUpdate({ later }: { later: () => void }) {
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-pearl">
      <Screen
        footer={
          <>
            <button type="button" onClick={() => window.location.reload()} className={btn}>
              Update now
            </button>
            <button type="button" onClick={later} className="p-2 text-center text-[14px]">
              Remind me later
            </button>
          </>
        }
      >
        <div className="flex h-24 w-24 items-center justify-center self-center rounded-3xl border border-[rgba(201,169,110,0.4)] bg-[linear-gradient(135deg,#1C1C20_0%,#0E0E10_42%,#26262C_56%,#0C0C0E_100%)] text-[#F6F1E7] shadow-[0_20px_40px_rgba(23,23,27,0.25)]">
          <Seal size={44} className="text-[#C9A96E]" />
        </div>
        <Title>A new version is ready</Title>
        <Text>Update Vellaire to get the latest improvements. It only takes a moment.</Text>
      </Screen>
    </div>
  );
}
