# Vellaire — handoff for the next developer or AI agent

Read this first, then `README.md` (setup, accounts, environment variables).
Last updated: 18 October 2026. The latest work and the reasons things are still open are in §7 and §8.

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
5. **No demo data, no demo sign-in.** The owner removed both on 18 October; do not bring them back. Everything must work without email until the client provides one.

---

## 2. Run it

```bash
npm install
npm run dev             # API on :4000, web on :3000
```

The local `.env` points at the **live** database (there is no separate dev database). Create test companies through `/signup` and delete them afterwards.
Sign in at `/signin` with email and password. Vellaire staff: `owner@vellaire.app`; without email, get a password link with `npm run password-link -w apps/api -- owner@vellaire.app`.

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

## 4. Status (18 October 2026)

**Everything in this table is built and connected to the database.** Do not rebuild it or treat it as pending. All routes were last crawled without errors on 9 October; pages changed after that are marked.

| Area | Routes | Status |
|---|---|---|
| Website, sign in, sign up, forgot and reset password | `/`, `/signin`, `/signup`, `/forgot-password`, `/reset-password` | ✅ done 15 Oct: email + password (12+ characters, a number, a symbol), forgot/reset password, email link and 6-digit code, Google/Microsoft. See §6 |
| Setup wizard (5 steps) | `/setup` | ✅ done and tested end to end |
| Company dashboard | `/app/*` | ✅ done |
| Employee app | `/m`, `/m/share`, `/m/leads`, `/m/insights`, `/m/edit`, `/m/settings` | ✅ done |
| Public card, Save contact (vCard), Share your details, team page, inactive card | `/c/:company/:slug`, `/c/:company` | ✅ done |
| NFC tap link | `/t/:uid` → the live card, tap counted | ✅ done (software side; see §5C for real chips) |
| Owner console (17 pages) | `/console/*` | ✅ done |
| Installable app (PWA) | manifest, PNG icons, `public/sw.js` offline page, iPhone home-screen settings | ✅ done 13 Oct. Signed-out app goes to `/signin` instead of a blank screen. Sign-in emails carry a 6-digit code (`/auth/verify-code`) because on iPhone the email link opens Safari, not the installed app. An "Install the app" banner (dashboard and employee app, `components/pwa.tsx`) and a Settings row offer installing; on iPhone they show Add to Home Screen steps. The app starts at `/open`. Inside the installed app everyone gets the employee app only (`/m`); the dashboard and the console redirect there and open only in a browser. Owner accounts with no card see "The app is for card holders" |
| Vercel production setup | `apps/api/vercel.json`, `DEPLOY.md` | ✅ live at https://vellaire.vercel.app (web project `vellaire`, API project `vellaire-api`). The web project still deploys pushes as **Preview**: see §8 |

Design alignment done by Antigravity on 10–12 October: Approvals, Sync activity, Edit my card, Team and roles, Inactive card, QR codes, Company settings, Billing, Security, Wallet passes, Email signatures, Employees, Leads, Analytics, HR integrations. **Some of these pages look finished but have buttons that do nothing yet: see §5A.**

Still different from the design: Templates (🔒 locked, leave it), Departments, Console "Subscriptions & invoices". Create card steps 2–4 were never compared.

---

## 5. What to do next (in this order)

### A. Buttons that only pretended to work: done 18 October (§7)

QR codes, Company settings, Security, Wallet passes, Email signatures, Billing, Team and roles and Sync activity now save what they show, or say "Coming soon". Rule for new work: never show success for something that did not happen.

### B. Small clean-ups
- Departments: managers and offices from the design. Compare Create card steps 2–4.
- Before email is switched on: add a "Choose a password" link to the "card ready" email (§8).

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

---

## 7. Work log: what was done last (13–18 October 2026)

Newest first. Items up to 15 October are live on https://vellaire.vercel.app and were tested there or locally.

### 18 October: employee app screens from the new design (commits `f31002e`, `2af3af4`, `1b90a26`, live)
Design: the owner's canvas "Vellaire — Product UI/UX Design" (claude.ai artifact), sections 9 and 10. The nine older phone screens only gained links; 19 of the 22 new ones are built, on real data only (the design's Sara Khan / Meridian copy is never shown).
- **Screens:** `/m/qr`, `/m/leads/[id]`, `/m/leads/scan` (camera + result), empty leads, `/m/edit/photo`, `/m/edit/bio`, Settings E6, `/m/settings/signature`, `/m/welcome` (once per person per phone), `/m/wallet`, and in `m/system.tsx`: splash, loading, offline, error (also `m/error.tsx`), `/m/signed-out`, update available, access ended; `/signin` has an app layout inside the installed app.
- **New API:** `Lead.myNote`; lead detail returns `mailReady`; `/leads/:id/send` refuses without an email service and the app opens the phone's mail app instead; `Card.hideMobile` ("Show my mobile number", respected by the public card, vCard and signature); `POST /me/nfc/:id/lost`; `/me/card` adds `photoApproval`, `showMobile`, `languages`; `/ai/bio` takes a tone.
- **Offline and updates:** the service worker keeps `/api/me/qr` for offline (cleared on sign-out); `/version` returns the live build id (`VERCEL_GIT_COMMIT_SHA`) and the app offers "Update now" when it differs.
- **Not built (section C of the plan, ask the owner first):** Notifications (screen and switch say "Coming soon"), Card switcher (several cards per person), Activate NFC (Web NFC works only in Android Chrome). Also shown as "Coming soon" or left out: "Match team style" photo AI, Face ID, "installed in your Outlook", pass updates.

### 18 October: demo data and demo sign-in removed
- **Database:** every company except the owner's own `cognidak` deleted (12 demo companies, Mahaarib & Cognidak, PW Test Co), with their users, cards, employees, leads, events, NFC, invoices, sync runs (including the sample ones), and the console demo partners, coupons, announcements, releases, data requests and AI usage. Kept: `cognidak`, `owner@vellaire.app`, plans, feature flags, settings, email copy. A JSON backup of every deleted row is outside the repo in `vellaire-backups/` next to it.
- **Code:** `/auth/demo` and the sign-in "Demo access" box removed; `DEMO_LOGIN` is no longer read. `npm run seed` and `seed:platform` removed.

### 18 October: every "pretend" button made real or marked "Coming soon" (commits `aab5ab3` to `2082ad4`)
Why: §5A. Looking closer, most of these pages were fully made up (fixed numbers, Meridian text, fake QR patterns), not just one button. The design was kept; only data and actions changed. New company styles (QR, signature, wallet) change nothing until a company saves one, so the locked pages look the same.

| Page | Now real | "Coming soon" (not built) |
|---|---|---|
| Team and roles | "Last active" from `lastLoginAt` | |
| QR codes (`common/qr.ts`, `lib/qr.ts`) | Real scannable codes (were a random pattern); style saved as `brand.qr` and used by card QR, employee app QR and "Download all"; print; live card and scan counts. Tested: decoded at 200–2000 px for every shape, centre and colour | |
| Company settings | Website, "Send visitors to" (`settings.leaverUrl`, shown on switched-off cards and NFC taps), Team page switch (was removed in the design pass), real domain / SSO / HR system / card count | Two-step sign-in, session length (fixed 30 days), data retention, AI switch, delete workspace. Switch-off card, disable NFC, keep leads always happen and are shown locked on |
| Security | Audit log CSV (`GET /settings/audit.csv`), real SCIM token | SAML single sign-on, test, certificate, all five sign-in rules |
| Wallet passes | Design saved as `brand.wallet` and used by Apple and Google passes; installed / Apple / Google / without counts (`Event.wallet` now records apple or google); reminders (`POST /cards/wallet/remind`, off until email and a wallet are set up) | "Updates delivered", the three automatic rules |
| Email signatures (`cards/signature.ts`) | Design saved as `brand.signature` (auto-save, the design has no Save button) and used everywhere signatures are made; real preview; "Download HTML" zip; QR image `GET /public/cards/:id/qr.png` | Deploy to Outlook / Gmail |
| Billing | Real invoices with printable download (`GET /settings/invoices/:id`), console prices, billing email, hiring pace; "Talk to Vellaire" opens Support (the account manager was invented) | Card payments (Stripe), tax number |
| Sync activity | Stopped writing sample runs and two made-up people into the database; issues come from the latest real sync; removed `fix-issue`, which put a typed email on a random employee; sidebar badge is real | |

Tested with read-only requests against the shared database. **Saving was not tried there** (QR style, company settings, wallet design, signature design, SCIM token), so try each once on a test workspace.

### 18 October: password links for many employees at once
Why: without email, admins could make a password link for only one employee at a time. With a whole company that means hundreds of clicks.

- **Employees page** (`apps/web/src/app/app/employees/page.tsx`): select two or more people → **Password links** in the selection bar downloads `password-links.csv` (name, email, password_link, expires, note). One person selected still opens the single "Password link" modal.
- **API** (`apps/api/src/modules/auth/auth.controller.ts`): `POST /auth/reset-link/employees` with `{ ids }`, for owner, admin and HR manager. It makes the app account first if needed (`ensureMemberUser`). Links last 7 days, like invites. People without an email, suspended, outside the company, or an owner (when the admin is not an owner) stay in the file with the reason in `note`. One audit line: "Password links made for N people".
- Type-checked; the route answers 401 when signed out. **Not yet tried with real data or pushed**: the local `.env` points at the shared Atlas database.
- Tell admins the file is sensitive: anyone holding a row's link can set that person's password until it is used or expires.

### 15 October: password sign-in, and email that is ready but optional (commit `396c417`)
Why: the sign-in form had been hidden behind demo buttons, and with no email service nobody could sign in for real. The owner asked for sign-in, sign-up and forgot password to work without email, with email switched on later only through `.env`.

- **Sign-in page** (`apps/web/src/app/signin/page.tsx`): email + password again, "Forgot password?" link, Google/Microsoft, and "Email me a sign-in link" only once email works. Demo buttons moved into a small "Demo access" box that shows only while demo access is on.
- **Sign-up** (`signup/page.tsx`): password field with the strength bar from the design (12+ characters, a number, a symbol). The account is signed in straight away and goes to `/setup`; no email needed.
- **New pages:** `/forgot-password`, `/reset-password?token=...`.
- **API** (`apps/api/src/modules/auth/auth.controller.ts`): `POST /auth/password` (sign in), `/auth/forgot`, `/auth/reset`, `/auth/change-password`, `GET /auth/password` (has a password?), `POST /auth/reset-link/:userId` and `/auth/reset-link/employee/:employeeId` (admin password links). `startSession()` is shared by every way of signing in.
- **Passwords** (`apps/api/src/common/password.ts`): scrypt hashes, `User.passwordHash` (never sent to the browser), `failedLogins` + `lockedUntil` (5 wrong → 15-minute lock). `MagicToken.purpose` is `signin` or `reset`; a reset link can never be used as a sign-in link.
- **Password links for people without email:** Employees (select one → Password link), Settings → Team (edit → Make a password link), console Users (Password link). The modal copies the message or opens WhatsApp (`components/password-link.tsx`). Owners: `npm run password-link -w apps/api -- you@email`.
- **Set or change password:** dashboard avatar menu → Password, console sidebar → Password, app Settings → Password (`components/change-password.tsx`).
- **Email** (`apps/api/src/common/mail.ts`): sends through Resend (`RESEND_API_KEY`) or any SMTP server (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`), from `MAIL_FROM`. Without them nothing is sent, the email is printed in the API log, and no flow breaks. `mailReady()` tells the rest of the code. Invite and welcome emails now carry a 7-day "Choose a password" link.
- **Security fix:** before this, the live API had no email key, so `/auth/start` returned the sign-in link on screen in production: anyone could type someone else's email and get into their account. Now links are shown on screen only in local development (`showLinksOnScreen()` in `signin-link.ts`).
- Tested: weak password refused, sign-up, wrong and right password, lockout after 5, forgot → reset → old password refused, reused link refused, change password, admin links, and a member being refused an admin link. On the live site: no link is returned and "Forgot password" says to ask an admin.

### 13–14 October: installable app (PWA) (commits `56c9255` to `bf61d72`)
- The installed app opened blank: layouts returned nothing when `/auth/me` failed. Now a signed-out app goes to `/signin`, and other errors show a retry screen (`ScreenError`).
- On iPhone the installed app keeps its own sign-in, separate from Safari, so the email link signed in Safari instead. Sign-in emails now carry a 6-digit code (`/auth/verify-code`, 5 tries per code, 5 emails per 15 minutes).
- "Install the Vellaire app" banner in the dashboard and the employee app, plus a Settings row, with step-by-step help for iPhone, Android and computers (`components/pwa.tsx`).
- The installed app is the employee card app only (My card, Share, Leads, Insights, Settings), matching section 5 of the design. The dashboard and the console redirect to `/m` inside the app; on a phone `/open` goes to `/m`.
- The employee app screens were compared with design artboards E1–E5 side by side and match.

---

## 8. Still open, and why

| What | Why it is not done | Who or what unblocks it |
|---|---|---|
| Real emails (sign-in link, reset, invites, lead alerts) | No email account or domain yet. The code is finished | Owner: add `RESEND_API_KEY` or `SMTP_*` and `MAIL_FROM` to the **vellaire-api** project in Vercel. Before that, the "card ready" email (`publishCard` in `common/cards.ts`) needs a "Choose a password" link like the invite email; today it only has "Open my card" |
| Web pushes reaching the live site by themselves | The Vercel web project's Production Branch is not `master`, so pushes become Preview builds. Each release so far was promoted by hand (`vercel promote <url>`). The API project already deploys `master` to production | Owner: Vercel → project `vellaire` → Settings → Git → Production Branch = `master` |
| Console (owner panel) has no login | The seeded `owner@vellaire.app` was removed with the demo data, and `PLATFORM_ADMIN_EMAILS` is empty locally and on Vercel | Owner: give a real email; put it in `PLATFORM_ADMIN_EMAILS` (apps/api/.env and Vercel **vellaire-api**), redeploy, then `npm run password-link -w apps/api -- <email>` |
| Wallet passes | Code done; Apple and Google accounts and certificates are needed | Client: Apple Developer Program and a Google Wallet issuer account (§5C) |
| NFC chips | Software done; the chip-link export for the supplier is not built, and no chips have been written or tap-tested | Next coding task (export), then the client's supplier |
| Google / Microsoft sign-in | Needs apps in Google Cloud and Microsoft Entra | Owner: create them and add the keys |
| Payments (Stripe), Terms and Privacy pages | Not started | Owner decides prices and legal text first |
| Rotating the MongoDB password | It was shared in a screenshot | Owner, in MongoDB Atlas; then update `MONGODB_URI` in Vercel and `apps/api/.env` |
