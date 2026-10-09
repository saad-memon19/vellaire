# Vellaire

Branded digital business cards for whole companies — created from the HR system, shared by NFC tap, QR, wallet pass or link.

## What is inside

| Part | Where | URL (local) |
|---|---|---|
| Website (landing + book a demo) | `apps/web/src/app/page.tsx` | http://localhost:3000 |
| Sign in (magic link, Google, Microsoft) | `apps/web/src/app/signin` | /signin |
| Company dashboard | `apps/web/src/app/app` | /app |
| Employee app (mobile, installable) | `apps/web/src/app/m` | /m |
| Public card (what clients see) | `apps/web/src/app/c/[company]/[slug]` | /c/meridian-capital/sara-khan |
| NFC tap redirect | `apps/web/src/app/t/[uid]` | /t/&lt;chip id&gt; |
| Product owner console | `apps/web/src/app/console` | /console |
| API (NestJS + MongoDB) | `apps/api` | http://localhost:4000 |

The browser only talks to the web app; `/api/*` and `/files/*` are forwarded to the API.

## Run it

Requirements: Node 20+ and a MongoDB database (Atlas works).

```bash
npm install
# 1. Put your MongoDB connection string in apps/api/.env (see apps/api/.env.example)
# 2. Fill the database with demo data (wipes it first)
npm run seed
# 3. Start API and web together
npm run dev
```

Open http://localhost:3000/signin. Without an email provider the sign-in link is shown on screen.
New companies can sign up themselves at http://localhost:3000/signup and are walked through five setup steps.

To add only the owner-console demo data (partners, coupons, flags, announcements, AI usage) without wiping anything: `npm run seed:platform -w apps/api`.

| Sign in as | Email | Lands on |
|---|---|---|
| Company owner | `sara.khan@meridian.com` | Company dashboard |
| Brand manager | `layla.mansour@meridian.com` | Company dashboard |
| Employee (no card yet) | `omar.haddad@meridian.com` | Employee app |
| Vellaire staff | `owner@vellaire.app` (change with `PLATFORM_ADMIN_EMAILS`) | Console |

## Configuration (`apps/api/.env`)

| Variable | Needed for |
|---|---|
| `MONGODB_URI` | Database (required) |
| `JWT_SECRET` | Sessions (required, long random string) |
| `ENCRYPTION_KEY` | Encrypting stored HR credentials (defaults to `JWT_SECRET`) |
| `WEB_URL` | Links in emails and card URLs |
| `PLATFORM_ADMIN_EMAILS` | Who can open the console (comma separated) |
| `RESEND_API_KEY`, `MAIL_FROM` | Real emails. Without it, emails print in the API console |
| `AI_PROVIDER` = `none` / `claude` / `openai`, `AI_API_KEY`, `AI_MODEL` | AI features (bio, translation, follow-up drafts, field matching, card scan, brand extraction). Everything works without AI |
| `AI_COST_IN_PER_MTOK`, `AI_COST_OUT_PER_MTOK` | Optional. Your AI price per million tokens, so the console can estimate AI cost |
| `GOOGLE_CLIENT_ID/SECRET`, `MICROSOFT_CLIENT_ID/SECRET` | Sign in with Google / Microsoft. Redirect URI: `<WEB_URL>/api/auth/oauth/<google|microsoft>/callback` |
| `APPLE_PASS_*`, `APPLE_TEAM_ID`, `APPLE_*_PATH` | Apple Wallet passes |
| `GOOGLE_WALLET_ISSUER_ID`, `GOOGLE_WALLET_SERVICE_EMAIL`, `GOOGLE_WALLET_PRIVATE_KEY` | Google Wallet passes |
| `CARD_CNAME_TARGET` | The host companies point their card domain at |
| `UPLOAD_DIR` | Where uploaded logos and photos are stored (default `uploads`) |

`apps/web/.env.local`: `API_URL` (where the API runs) and `APP_HOSTS` (hosts that serve the app; any other host is treated as a company card domain).

Prices per seat live in `apps/api/src/config.ts` (`PLANS`). Card layouts, themes and NFC materials live in `apps/api/src/common/catalog.ts` and `apps/web/src/lib/catalog.ts` (keep the ids in step).

## How the main pieces work

- **Tenancy.** Every record carries `companyId`; the API reads it from the session, never from the request. Employees (role `member`) can only reach their own card, their own leads and the AI helpers.
- **HR sync** (`apps/api/src/modules/integrations`). Workday (RaaS JSON report), SAP SuccessFactors (OData) and BambooHR are read every hour; Microsoft Entra ID and Okta push changes through the SCIM endpoint at `/api/scim/v2`. Each sync plans joiners, movers and leavers, shows a dry run, and pauses when it would switch off more than the sync-guard share of cards.
- **Publishing.** A card goes live now, on the person's start date, or after approval. Publishing emails the person, can order an NFC card, and enables the wallet pass and email signature.
- **Leavers.** The card switches off, NFC chips are disabled and sign-in stops. Leads stay with the company.
- **Analytics.** The public card records views, saves, clicks and leads with the channel (`?src=nfc|qr|wallet|link|signature`).
- **AI** (`apps/api/src/modules/ai`). One `AiService`, swappable providers. With `AI_PROVIDER=none` the AI buttons hide and template or rule-based versions are used instead.
- **Background jobs** (`apps/api/src/jobs.ts`). Scheduled cards go live every minute; HR systems sync hourly; ended trials are marked; service checks are saved every five minutes for System health.
- **Owner console** (`apps/api/src/modules/platform`). Users, plans (prices edited here apply everywhere), revenue analytics, partners and coupons, integration health, template library, AI usage and switches, announcements and email copy, security audit and privacy requests, feature flags, and system health. Staff actions are logged with their IP address.
- **Feature flags.** `/auth/me` returns `company.flags`, the flags on for that company. A rollout percentage keeps the same companies in as it grows.

## Build for production

```bash
npm run build
NODE_ENV=production npm start
```

Run the API behind HTTPS (cookies are `secure` in production) and set `WEB_URL` to the public address.
