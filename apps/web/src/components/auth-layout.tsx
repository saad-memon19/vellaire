import Link from 'next/link';
import { Icon, Seal, Wordmark } from './icons';

/** Split screen shared by sign in and create account: sand panel with the floating card, white form side. */
export function AuthLayout({ cardText, quote, children }: { cardText: string; quote: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-wrap">
      <aside
        className="flex min-h-105 min-w-0 basis-full flex-col justify-between gap-12 px-8 py-10 sm:px-14 sm:py-12 lg:flex-[11_1_520px]"
        style={{ background: 'radial-gradient(60% 50% at 50% 45%, rgba(176,141,79,0.2), rgba(239,233,221,0) 70%), #EFE9DD' }}
      >
        <Link href="/" aria-label="Vellaire home">
          <Wordmark />
        </Link>
        <div className="flex justify-center">
          <div
            className="vl-float flex aspect-[1.586] w-105 max-w-[90%] flex-col justify-between rounded-[18px] p-7.5 text-cream"
            style={{
              background: 'linear-gradient(135deg,#1C1C20 0%,#0E0E10 42%,#26262C 56%,#0C0C0E 100%)',
              border: '1px solid rgba(201,169,110,0.38)',
              boxShadow: '0 50px 90px rgba(23,23,27,0.3)',
            }}
          >
            <div className="flex items-center justify-between text-gold-soft">
              <Seal size={30} />
              <Icon name="nfc" size={24} />
            </div>
            <div className="font-display text-[30px]">{cardText}</div>
          </div>
        </div>
        <p className="max-w-120 font-display text-[24px] font-light italic leading-snug text-ink">{quote}</p>
      </aside>
      <main className="flex min-w-0 basis-full items-center justify-center bg-white px-8 py-12 lg:flex-[9_1_420px]">{children}</main>
    </div>
  );
}

/** "Check your email", with the link itself when no email service is connected (development). */
export function LinkSent({ message, devLink, onBack, backLabel }: { message: string; devLink?: string; onBack: () => void; backLabel: string }) {
  return (
    <div className="vl-fade flex flex-col gap-6">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-gold-tint text-gold-text">
        <Icon name="mail" size={22} />
      </span>
      <div>
        <h1 className="font-display text-[44px] font-normal leading-[1.05]">Check your email</h1>
        <p className="mt-2 text-[15px] text-stone">{message} It expires in 15 minutes.</p>
      </div>
      {devLink && (
        <div className="rounded-lg border border-dashed border-gold-line bg-gold-tint p-4 text-[14px]">
          <div className="mb-2 font-medium text-gold-text">Development mode</div>
          <p className="mb-3 text-stone">No email service is connected, so here is your sign-in link.</p>
          <a href={devLink} className="inline-flex h-11 items-center gap-2 rounded-md bg-ink px-4 text-cream">
            Sign in now <Icon name="arrow" size={17} className="text-gold-soft" />
          </a>
        </div>
      )}
      <button type="button" onClick={onBack} className="self-start text-[14px] text-gold-text underline underline-offset-4">
        {backLabel}
      </button>
    </div>
  );
}
