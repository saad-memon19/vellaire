# Vellaire — handoff for the next developer or AI agent

Read this first, then `README.md` (setup, accounts, environment variables).
Last updated: 13 October 2026.

Vellaire is a digital business card product for companies. It has five parts, all in this repo:

| Part | Who uses it | Route |
|---|---|---|
| Website | Visitors | `/`, `/signin`, `/signup` |
| Company dashboard | Company admins | `/app/*`, first-time setup at `/setup` |
| Employee app (mobile web) | Card holders | `/m/*` |
| Public card and team page | Clients of the company | `/c/:company/:slug`, `/c/:company` |
| Owner console | Vellaire staff | `/console/*` |

---

## 1. Rules from the product owner (do not break these)

1. **Never change the UI of these pages:** Templates (`/app/templates`), All cards (`/app/cards`), Brand kit (`/app/brand`), NFC cards (`/app/nfc`). Functional fixes are fine only if asked; their look stays as it is.
2. **Do not restyle finished pages** unless the owner asks for that page by name. When a design differs, report it and wait.
3. **Secrets never go in chat or in git.** Keys live only in `apps/api/.env`, which is git-ignored. The owner adds keys themselves.
4. The owner writes in Roman Urdu and prefers short, plain answers. Check before writing code, and make targeted edits rather than rewriting whole files. They care about not wasting tokens.
5. Demo sign-in buttons only work in development or with `DEMO_LOGIN=1`. Seeding refuses to run in production without `--force`.

---

## 2. Run it

```bash
npm install
npm run seed            # wipes the database and loads demo data
npm run dev             # API on :4000, web on :3000
npm run seed:platform -w apps/api   # only the console demo data, nothing wiped
```

Sign in at `/signin` with email and password. In local development without an email provider, sign-in and reset links are also shown on screen:
`sara.khan@meridian.com` (company owner), `layla.mansour@meridian.com` (brand manager), `owner@vellaire.app` (Vellaire staff).

Type-check before you finish any change:

```bash
cd apps/api && npx tsc --noEmit -p . --noUnusedLocals
cd apps/web && npx tsc --noEmit -p . --noUnusedLocals
```

---

## 3. How the code is organised

```
apps/api   NestJS 11 + MongoDB (Mongoose)
  src/db/schemas.ts           every collection; use them through `db.X` (src/db/db.ts)
  src/common/auth.ts          global guard + decorators: @Public @SignedIn @AllowMember @Roles(...) @Platform
  src/common/util.ts          parse(zodSchema, body), found(), requireId(), logActivity(), paging(), toCsv()
  src/common/mail.ts          sendMail({ template, ... }) — every email has a template key (EMAIL_TEMPLATES)
  src/common/platform.ts      plans cache (prices edited in the console apply everywhere), feature flags, settings
  src/common/context.ts       per-request context (IP, company) and response-time samples
  src/common/cards.ts         create / publish / deactivate cards, NFC orders
  src/jobs.ts                 background jobs (publish, HR sync, trials, health checks every 5 min)
  src/modules/*               one folder per area; owner console pages live in modules/platform and modules/console
  src/modules/onboarding      self-serve sign-up and the five setup steps
  src/seed/                   seed.ts (everything), platform.ts (console demo data only)

apps/web   Next.js 15 App Router + Tailwind v4
  src/components/ui.tsx       Button, Input, Select, Panel, Stat, Tabs, PillTabs, Modal, Table, Pagination, FilterChip, ...
  src/components/card/        CardFace (physical card), OnlineCard (public card)
  src/app/console/parts.tsx   console building blocks: Kpis, Section, GridTable/GridRow, Pill, Meter, RowButton, useAction
  src/lib/api.ts              api.get/post/patch/upload, useApi (SWR), useMe
  /api/* and /files/* are proxied to the API.

design/                      the Claude Design artboards (.dc.html) — the visual source of truth
tools/design-check/          screenshot design vs built page, and crawl all routes for errors
```

**Conventions**
- Validate every request body with zod through `parse()`. Scope every query by `companyId` from the session, never from the request.
- Staff actions call `logActivity({ ..., platform: true })` so they reach the Security & audit log.
- AI goes through `AiService.run(feature, ...)`, which checks the console switches and plan credits and records usage.
- Styling: Tailwind tokens from `globals.css` (`pearl`, `sand`, `linen`, `ink`, `gold`, `gold-text`, `gold-tint`, `stone`...). Design files use content-box sizing, so add padding when copying widths.
- Formatting: `.prettierrc` at the root (single quotes, width 180). Run Prettier only on files you changed.
- Match the surrounding code: small components, comments only where the reason is not obvious.

---

## 4. Status (13 October 2026)

**Everything in this table is built and connected to the database.** Do not rebuild it or treat it as pending. All routes were last crawled without errors on 9 October; pages changed after that are marked.

| Area | Routes | Status |
|---|---|---|
| Website, sign in, sign up | `/`, `/signin`, `/signup` | ✅ done 15 Oct: email + password (12+ characters, a number, a symbol), forgot/reset password, email link and 6-digit code, Google/Microsoft. See §6 |
| Setup wizard (5 steps) | `/setup` | ✅ done and tested end to end |
| Company dashboard | `/app/*` | ✅ done |
| Employee app | `/m`, `/m/share`, `/m/leads`, `/m/insights`, `/m/edit`, `/m/settings` | ✅ done |
| Public card, Save contact (vCard), Share your details, team page, inactive card | `/c/:company/:slug`, `/c/:company` | ✅ done |
| NFC tap link | `/t/:uid` → the live card, tap counted | ✅ done (software side; see §5C for real chips) |
| Owner console (17 pages) | `/console/*` | ✅ done |
| Installable app (PWA) | manifest, PNG icons, `public/sw.js` offline page, iPhone home-screen settings | ✅ done 13 Oct. Signed-out app goes to `/signin` instead of a blank screen. Sign-in emails carry a 6-digit code (`/auth/verify-code`) because on iPhone the email link opens Safari, not the installed app. An "Install the app" banner (dashboard and employee app, `components/pwa.tsx`) and a Settings row offer installing; on iPhone they show Add to Home Screen steps. The app starts at `/open`, which sends each person to their own home |
| Vercel production setup | `apps/api/vercel.json`, `DEPLOY.md` | ✅ code ready; projects are linked; live status unknown |

Design alignment done by Antigravity on 10–12 October: Approvals, Sync activity, Edit my card, Team and roles, Inactive card, QR codes, Company settings, Billing, Security, Wallet passes, Email signatures, Employees, Leads, Analytics, HR integrations. **Some of these pages look finished but have buttons that do nothing yet: see §5A.**

Still different from the design: Templates (🔒 locked, leave it), Departments, Console "Subscriptions & invoices". Create card steps 2–4 were never compared.

---

## 5. What to do next (in this order)

### A. Fix buttons that only pretend to work (before any customer sees them)

These buttons show a success message without saving or sending anything. Either make them real, or disable them with a short "Coming soon" note. Never show success for something that did not happen.

| Page | File | Problem |
|---|---|---|
| Email signatures | `apps/web/src/app/app/signatures/page.tsx` | "Deploy to all mailboxes" says "deployed to all 1,248 mailboxes"; Google Workspace "connect" does nothing. Design options (photo, QR, phone, legal line) are not saved |
| Wallet passes | `apps/web/src/app/app/wallet/page.tsx` | "Save design" does not save; "Send to everyone without a pass" always says 232 employees. Unused `analytics` variable |
| QR codes | `apps/web/src/app/app/qr/page.tsx` | "Save as company style" does not save |
| Billing | `apps/web/src/app/app/settings/billing/page.tsx` | "Card ending 4021" and "finance@meridian.com" are hard-coded for every company; invoice "Download" and "update payment method" only show a message |
| Company settings | `apps/web/src/app/app/settings/company/page.tsx` | Leaver redirect is hard-coded to `meridian.com/contact`; unused `setRedirectUrl` |
| Security | `apps/web/src/app/app/settings/security/page.tsx` | "Save changes" sends an empty request; certificate upload and "Download audit log" only show a message |

### B. Small clean-ups
- Add `apps/web/tsconfig.tsbuildinfo` to `.gitignore`.
- `npx tsc --noEmit -p . --noUnusedLocals` in `apps/web` must pass (2 unused variables above).
- Departments: managers and offices from the design. Compare Create card steps 2–4.

### C. Real-world setup (needs the owner or the client)
1. **NFC cards.** Software is done: ordering, production stages, the `/t/<uid>` tap link, lost / switch off. Missing:
   - an export of each order's chip links (`https://<web domain>/t/<uid>` per person) for the supplier, in the console NFC board;
   - NFC chips (NTAG 213/215/216, or NTAG 424 DNA for anti-cloning) written with those links, then a tap test on iPhone and Android.
2. **Wallet passes.** Code is done; it needs accounts and keys:
   - Apple: Apple Developer Program, a Pass Type ID, its signing certificate and Apple's WWDR certificate → `APPLE_*` variables (base64 on Vercel; see `apps/api/.env.example`).
   - Google: Google Wallet API issuer account and a Google Cloud service account with its key → `GOOGLE_WALLET_*` variables.
3. **Before launch:**
   - Rotate the MongoDB password (it was shared in a screenshot).
   - Email: set `RESEND_API_KEY`, or `SMTP_HOST`/`SMTP_PORT`/`SMTP_USER`/`SMTP_PASS`, plus `MAIL_FROM` (see `apps/api/.env.example`). Nothing else changes in code. Add Google/Microsoft sign-in keys and optionally AI keys.
   - Remove `DEMO_LOGIN` from Vercel before launch (it shows the demo buttons on `/signin`).
   - Write Terms and Privacy pages (TODO in `apps/web/src/app/signup/page.tsx`).
   - Payments (Stripe) for plans and NFC orders.
   - Backups and monitoring.

### D. New features the designs show (plan with the owner first)
Signature deployment to Outlook and Gmail, two-step sign-in and network rules, card payments.

---

## 6. Decisions already made (do not undo without asking)

- Sign-in is email + password (scrypt hash, `common/password.ts`); 5 wrong passwords lock the account for 15 minutes. Email links and the 6-digit code also work once email is set up. Google/Microsoft sign-up keeps the company name in a short cookie until the provider returns.
- Works without email: sign-up signs in straight away; "Forgot password" says to ask an admin. Admins make a one-time 24-hour **password link** to share by hand: dashboard Employees (select one person → Password link), Settings → Team (edit → Make a password link), console Users (Password link). The owner gets one from the terminal: `npm run password-link -w apps/api -- owner@email` (uses the database in `apps/api/.env`).
- Sign-in and reset links are never shown on screen in production; only in local development without an email provider.
- Invite and welcome emails carry a 7-day "Choose a password" link.
- New sign-ups get a 14-day Professional trial and go through `/setup`. `company.setup.done` decides whether sign-in lands on `/setup` or `/app`.
- The team page is off by default. It needs both the `public.team_page` feature flag and the company's own switch in Company settings.
- Users directory has Suspend/Reactivate instead of "Reset 2FA" (there is no 2FA yet). A suspended user cannot sign in.
- Email "open rate" is shown as "Delivered" (opens are not tracked). Without an email key, emails print to the API log.
- Deleting a company workspace keeps its invoices and the staff audit trail.
