# Deploy Vellaire on Vercel

Vellaire runs as **two Vercel projects from this one repository**:

| Project | Root Directory | What it is | Example domain |
|---|---|---|---|
| `vellaire-web` | `apps/web` | Next.js website, dashboard, employee app, public cards | `app.vellaire.com` |
| `vellaire-api` | `apps/api` | NestJS API as one Vercel function, plus the cron jobs | `api.vellaire.com` |

The browser only talks to the web domain. The web project forwards `/api/*` to the API project, so sign-in cookies stay on the web domain.

---

## 1. Before you start

1. **MongoDB Atlas**
   - Change the database user's password (the old one was shared in a screenshot).
   - Network Access: allow `0.0.0.0/0`. Vercel has no fixed IP addresses.
2. Make two random secrets, for example with `openssl rand -hex 32`: one for `JWT_SECRET`, one for `CRON_SECRET`.

## 2. API project (`vellaire-api`)

1. Vercel → **Add New → Project** → import `saad-memon19/vellaire`.
2. **Root Directory:** `apps/api`. **Framework Preset:** Other. Leave build settings as they are; `apps/api/vercel.json` sets them.
3. **Storage → Create → Blob**, and connect it to this project. Vercel adds `BLOB_READ_WRITE_TOKEN` itself.
4. **Environment Variables** (Production):

| Name | Value |
|---|---|
| `MONGODB_URI` | the Atlas connection string with the new password |
| `JWT_SECRET` | random, at least 32 characters |
| `WEB_URL` | `https://app.vellaire.com` (the web project's domain, no trailing slash) |
| `PLATFORM_ADMIN_EMAILS` | your email(s); these accounts get the owner console |
| `CRON_SECRET` | random |
| `RESEND_API_KEY` or `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, and `MAIL_FROM` | to send email. Without them sign-in still works with passwords; admins share password links by hand |
| optional | `AI_PROVIDER`, `AI_API_KEY`, `GOOGLE_CLIENT_*`, `MICROSOFT_CLIENT_*`, wallet variables (see `apps/api/.env.example`) |

5. Deploy. Open `https://<api domain>/meta`; it should return JSON.

## 3. Web project (`vellaire-web`)

1. Import the same repository again as a second project.
2. **Root Directory:** `apps/web`. Framework: Next.js (detected).
3. **Environment Variables:**

| Name | Value |
|---|---|
| `API_URL` | `https://api.vellaire.com` (the API project's domain, no trailing slash) |
| `APP_HOSTS` | `app.vellaire.com,vellaire-web.vercel.app` (every domain of the web project). Any other domain is treated as a company's own card domain |

4. Deploy, then add your domain under **Settings → Domains**.

## 4. After the first deploy

- **First sign-in:** the API creates staff accounts for `PLATFORM_ADMIN_EMAILS` when it starts. Get a password link for yours with `npm run password-link -w apps/api -- you@email` (it uses the database in `apps/api/.env`), open it on the live address, choose a password, then sign in at `/signin`.
- **Do not run `npm run seed` against the live database.** It wipes everything and loads demo data.
- **Google / Microsoft sign-in:** set the redirect URLs in their consoles to
  `https://app.vellaire.com/api/auth/oauth/google/callback` and `.../microsoft/callback`.
- **Company card domains** (`cards.company.com`): add each domain to the **web** project in Vercel as well. The company also adds the DNS records shown in Company settings → Domain.

## 5. Background jobs

`apps/api/vercel.json` schedules four jobs through Vercel Cron:

| Job | What it does | Ideal frequency |
|---|---|---|
| `/cron/publish` | scheduled cards go live | every 5 minutes |
| `/cron/hr-sync` | HR systems sync joiners, movers and leavers | every hour |
| `/cron/trials` | ended trials become past due | every hour |
| `/cron/health` | System health checks | every 5 minutes |

**Vercel Hobby (free) allows cron jobs only once a day**, so the file schedules each job daily and deploys on any plan. For the ideal frequency, either:
- upgrade to **Vercel Pro** and change the schedules in `apps/api/vercel.json` (for example `*/5 * * * *` and `0 * * * *`), or
- keep Hobby and use a free scheduler such as cron-job.org to call `https://<api domain>/cron/publish` and the others, with the header `Authorization: Bearer <CRON_SECRET>`.

On Hobby a function can run for 60 seconds. A very large HR sync may need Pro, where `maxDuration` in `apps/api/vercel.json` can go up to 300.

## 6. Limits to know

- Uploads are limited to 4 MB (Vercel's request limit is 4.5 MB). Photos are shrunk in the browser before upload.
- Uploaded files live in Vercel Blob on their own domain, not under `/files`.
- Demo sign-in buttons are off in production unless `DEMO_LOGIN=1`.
- Locally nothing changes: `npm run dev` still runs the API as a normal server with its timers and disk uploads.
