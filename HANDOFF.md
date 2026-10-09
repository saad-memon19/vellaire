# Vellaire — handoff for the next developer or AI agent

Read this first, then `README.md` (setup, accounts, environment variables).
Last updated: 9 October 2026.

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

Sign in at `/signin` (without an email key the sign-in link is shown on screen):
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

## 4. Status against the design

Checked on 9 October 2026: all 52 routes open with no console errors, failed requests or crashes for every role (`tools/design-check/crawl.mjs`).

| Design file (`design/`) | Route | Status |
|---|---|---|
| Main | `/` | ✅ matches |
| SignIn, SignUp | `/signin`, `/signup` | ✅ (sign-up uses email links, no password: see §6) |
| OnboardCompany … OnboardDone | `/setup` | ✅ |
| Overview, Cards, Editor, Employees, BrandKit, NFC, Analytics, Leads, Integrations | `/app`, `/app/cards`, `/app/cards/:id`, `/app/employees`, `/app/brand`, `/app/nfc`, `/app/analytics`, `/app/leads`, `/app/integrations/workday` | ✅ (Cards, Brand kit, NFC are locked: rule 1) |
| CreateStep1–4, CreateDone | `/app/create` | ✅ step 1 checked; 2–4 not compared yet |
| MyCard, Share, MobileLeads, MobileInsights | `/m`, `/m/share`, `/m/leads`, `/m/insights` | ✅ |
| PublicCard, TeamPage | `/c/:company/:slug`, `/c/:company` | ✅ |
| Console, ConsoleCompanies, ConsoleCompany, ConsoleNFC, ConsoleSupport | `/console`, `/console/companies(/:id)`, `/console/nfc`, `/console/support` | ✅ |
| ConsoleUsers, Plans, Revenue, Partners, Integrations, Templates, AI, Announcements, Security, Flags, Health | `/console/users`, `/plans`, `/revenue-analytics`, `/partners`, `/integrations`, `/templates`, `/ai`, `/announcements`, `/security`, `/flags`, `/health` | ✅ |
| ConsoleSubscriptions | `/console/revenue` | ⚠️ built before its design; left as is |
| Templates | `/app/templates` | ⚠️ differs — 🔒 locked, do not change |
| Approvals | `/app/approvals` | ⚠️ differs — **next task** |
| InactiveCard | deactivated card at `/c/:company/:slug` | ⚠️ differs — **next task** |
| SyncActivity | `/app/integrations/activity` | ⚠️ differs — **next task** |
| EditMyCard | `/m/edit` | ⚠️ differs — **next task** |
| Team | `/app/settings/team` | ⚠️ differs — **next task** |
| Departments, Settings | `/app/departments`, `/app/settings/company` | ⚠️ differs — later |
| QRStudio, WalletPasses, Signatures, Security, Billing | `/app/qr`, `/app/wallet`, `/app/signatures`, `/app/settings/security`, `/app/settings/billing` | ⚠️ the designs need new features (see §5C) |
| ShareDetails | modal on the public card | built as a modal |
| Brand | — | brand reference sheet, not a page |

---

## 5. What to do next (agreed priority)

### A. Now — bring five pages to their design (the owner's go-ahead is still needed; ask first)

1. **Inactive card** (`apps/web/src/app/c/[company]/[slug]/public-card.tsx` → `InactiveCard`). Design: company logo tile, company name eyebrow, "This card is no longer active", short text, buttons "Contact {company}" (company website or email), "Find someone in our team" (only when the team page is on), the website link, small Vellaire mark. The public card API must return the company's website, logo and whether the team page is available.
2. **Approvals** (`apps/web/src/app/app/approvals/page.tsx`). Design: list on the left (avatar, name, what changed, source pill Workday/Employee, time; the selected row has a gold left border), and a detail panel on the right with NOW and AFTER APPROVAL cards side by side, a field table (Field / Before struck through / After highlighted), an optional note, then Reject and "Approve and publish". Plus a header button "Approve all N from Workday". The API must return the before and after values per change.
3. **Sync activity** (`/app/integrations/activity`). Design: an amber "N people need your help" box (missing work email → Add email / Skip; unmapped department → Map department / Skip), a "Recent syncs" list with created / updated / switched off / skipped and a status pill, the sync-guard note, and the buttons "Download log" and "Sync now".
4. **Edit my card** (`/m/edit`). Design: profile photo row ("New photo waiting for approval" / Change); fields that come from HR (name, title) shown read-only and labelled "From HR"; editable fields labelled "You can edit"; a light-gold About box with "Write with AI" and the languages; Save changes at the bottom.
5. **Team and roles** (`/app/settings/team`). Design: a people table (person, role pill, scope, last active, Edit) and a "What each role can do" permission matrix (Owner / Admin / Brand / Manager).

Use `tools/design-check` to compare each page with its design before and after.

### B. Later
Departments (managers, offices), Company settings (leaver rules, data retention, workspace deletion), Create card steps 2–4 comparison.

### C. New features the designs ask for (bigger work, plan with the owner)
QR style studio, Wallet pass designer, Email signature deployment to Outlook and Gmail, two-step sign-in and network rules (Security), card payments (Billing).

### D. Before launch
1. **Rotate the MongoDB password** (it was shared in a screenshot) and update `apps/api/.env`.
2. Add keys in `.env`: `RESEND_API_KEY` (email), Google and Microsoft OAuth, Apple and Google Wallet certificates, optional AI key and `AI_COST_*`.
3. Owner decision: keep email-link sign-in or add passwords; then turn off the demo buttons.
4. Write Terms and Privacy pages and link them from the landing footer and `/signup` (there is a TODO in `apps/web/src/app/signup/page.tsx`).
5. Payments (for example Stripe) for plans and NFC orders.
6. Finish the PWA (install, offline), NFC supplier export and chip encoding test, cloud storage for uploads, deployment (web, API, domain, HTTPS), backups and monitoring.

---

## 6. Decisions already made (do not undo without asking)

- Sign-up has no password field: sign-in everywhere is an email link or Google/Microsoft. Google/Microsoft sign-up keeps the company name in a short cookie until the provider returns.
- New sign-ups get a 14-day Professional trial and go through `/setup`. `company.setup.done` decides whether sign-in lands on `/setup` or `/app`.
- The team page is off by default. It needs both the `public.team_page` feature flag and the company's own switch in Company settings.
- Users directory has Suspend/Reactivate instead of "Reset 2FA" (there is no 2FA yet). A suspended user cannot sign in.
- Email "open rate" is shown as "Delivered" (opens are not tracked). Without an email key, emails print to the API log.
- Deleting a company workspace keeps its invoices and the staff audit trail.
