// Opens every route as the right role and reports console errors, failed requests and crashes.
import { chromium } from 'playwright';
const WEB = 'http://localhost:3000';
const API = 'http://localhost:4000';
async function cookieFor(email) {
  const s = await (await fetch(`${API}/auth/start`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) })).json();
  const v = await fetch(`${API}/auth/verify`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: new URL(s.devLink).searchParams.get('token') }) });
  return v.headers.getSetCookie().map((c) => c.split(';')[0].split('='));
}
const browser = await chromium.launch();
const results = [];
async function run(email, routes, mobile = false) {
  const ctx = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 } });
  if (email) for (const [name, value] of await cookieFor(email)) await ctx.addCookies([{ name, value, url: WEB }]);
  const page = await ctx.newPage();
  let issues = [];
  page.on('console', (m) => m.type() === 'error' && issues.push(`console: ${m.text().slice(0, 160)}`));
  page.on('pageerror', (e) => issues.push(`crash: ${e.message.slice(0, 160)}`));
  page.on('response', (r) => r.status() >= 400 && !r.url().includes('_next') && issues.push(`${r.status()} ${r.url().replace(WEB, '').slice(0, 100)}`));
  for (let route of routes) {
    if (typeof route === 'function') route = await route(page);
    issues = [];
    try {
      await page.goto(WEB + route, { waitUntil: 'networkidle', timeout: 45000 });
      await page.waitForTimeout(600);
      const notFound = await page.locator('text=/page could not be found|Something went wrong/i').count();
      if (notFound) issues.push('shows error/404 screen');
    } catch (e) { issues.push(`load: ${e.message.slice(0, 120)}`); }
    results.push({ who: email || 'public', route, issues: [...new Set(issues)] });
  }
  await ctx.close();
}
const firstCard = async (page) => {
  const r = await page.request.get(`${WEB}/api/cards`);
  const j = await r.json();
  return `/app/cards/${(j.rows || j.cards || [])[0]?.id}`;
};
const firstCompany = async (page) => {
  const j = await (await page.request.get(`${WEB}/api/console/companies`)).json();
  return `/console/companies/${(j.rows || j)[0]?.id}`;
};
await run(null, ['/', '/signin', '/signup', '/c/meridian-capital', '/c/meridian-capital/sara-khan']);
await run('sara.khan@meridian.com', ['/app', '/app/cards', firstCard, '/app/create', '/app/templates', '/app/brand', '/app/employees', '/app/departments', '/app/approvals', '/app/qr', '/app/nfc', '/app/wallet', '/app/signatures', '/app/analytics', '/app/leads', '/app/integrations', '/app/integrations/workday', '/app/integrations/activity', '/app/settings/team', '/app/settings/security', '/app/settings/billing', '/app/settings/company', '/app/settings/domain', '/app/support']);
await run('sara.khan@meridian.com', ['/m', '/m/share', '/m/leads', '/m/insights', '/m/settings', '/m/edit'], true);
await run('owner@vellaire.app', ['/console', '/console/companies', firstCompany, '/console/users', '/console/plans', '/console/revenue', '/console/revenue-analytics', '/console/partners', '/console/nfc', '/console/integrations', '/console/templates', '/console/ai', '/console/support', '/console/announcements', '/console/security', '/console/flags', '/console/health']);
await browser.close();
const bad = results.filter((r) => r.issues.length);
console.log(`checked ${results.length} pages, ${bad.length} with problems`);
for (const r of bad) console.log(`\n[${r.who}] ${r.route}\n  - ${r.issues.join('\n  - ')}`);
