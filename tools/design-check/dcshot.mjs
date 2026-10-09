// Renders design artboards (.dc.html) with their own renderVals() data, and screenshots
// the matching built page, so the two can be compared side by side.
// usage: node dcshot.mjs <projectDir> <outDir> <email|-> <Board.dc.html=/route> ...
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'fs';
import { pathToFileURL } from 'url';

const [projectDir, out, email, ...pairs] = process.argv.slice(2);
const BASE = 'http://localhost:3000';

/* Runs inside the page: expands sc-for / sc-if / {{path}} using the board's Component. */
function expand() {
  const script = document.querySelector('script[data-dc-script]');
  class DCLogic {
    constructor(props) { this.props = props || {}; this.state = {}; }
    setState(s) { Object.assign(this.state, s); }
  }
  window.DCLogic = DCLogic;
  const Component = new Function('DCLogic', `${script.textContent}; return Component;`)(DCLogic);
  const vals = new Component({}).renderVals();
  const get = (scope, path) => path.trim().split('.').reduce((o, k) => (o == null ? undefined : o[k]), scope);
  const fill = (s, scope) => s.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_, p) => { const v = get(scope, p); return v == null || typeof v === 'function' ? '' : String(v); });
  const walk = (node, scope) => {
    for (const child of [...node.childNodes]) {
      if (child.nodeType === 3) { if (child.nodeValue.includes('{{')) child.nodeValue = fill(child.nodeValue, scope); continue; }
      if (child.nodeType !== 1) continue;
      const tag = child.tagName.toLowerCase();
      if (tag === 'sc-for') {
        const m = (child.getAttribute('list') || '').match(/\{\{\s*([^}]+?)\s*\}\}/);
        const list = (m && get(scope, m[1])) || [];
        const as = child.getAttribute('as') || 'item';
        const frag = document.createDocumentFragment();
        for (const item of list) {
          const tmp = document.createElement('div');
          tmp.innerHTML = child.innerHTML;
          walk(tmp, { ...scope, [as]: item });
          while (tmp.firstChild) frag.appendChild(tmp.firstChild);
        }
        child.replaceWith(frag);
        continue;
      }
      if (tag === 'sc-if') {
        const m = (child.getAttribute('value') || '').match(/\{\{\s*([^}]+?)\s*\}\}/);
        const v = m ? get(scope, m[1]) : false;
        if (!v || (Array.isArray(v) && !v.length)) { child.remove(); continue; }
        walk(child, scope);
        child.replaceWith(...child.childNodes);
        continue;
      }
      for (const a of [...child.attributes]) if (a.value.includes('{{')) child.setAttribute(a.name, fill(a.value, scope));
      walk(child, scope);
    }
  };
  walk(document.querySelector('x-dc'), vals);
}

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
if (email !== '-') {
  const r = await fetch(`${BASE}/api/auth/start`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) });
  const { devLink } = await r.json();
  const p = await ctx.newPage();
  await p.goto(devLink);
  await p.waitForURL((u) => !u.pathname.startsWith('/auth/verify'), { timeout: 30000 });
  await p.close();
}
for (const pair of pairs) {
  const i = pair.indexOf('='); const board = pair.slice(0, i); const route = pair.slice(i + 1);
  const name = board.replace('.dc.html', '');
  // design
  const html = readFileSync(`${projectDir}/${board}`, 'utf8').replace('<script src="./support.js"></script>', '');
  const tmp = `${out}/${name}.design.html`;
  writeFileSync(tmp, html);
  const width = Number((html.match(/"\$preview":\{"width":(\d+)/) || [])[1]) || 1440;
  const d = await ctx.newPage();
  await d.setViewportSize({ width, height: 900 });
  await d.goto(pathToFileURL(tmp).href, { waitUntil: 'networkidle' });
  try { await d.evaluate(expand); } catch (e) { console.log(`  ${name}: expand failed ${e.message}`); }
  await d.addStyleTag({ content: '*{animation:none!important;transition:none!important}' });
  await d.waitForTimeout(600);
  await d.screenshot({ path: `${out}/${name}_d.png`, fullPage: true });
  await d.close();
  // built
  const b = await ctx.newPage();
  await b.setViewportSize({ width, height: 900 });
  await b.goto(BASE + route, { waitUntil: 'networkidle', timeout: 90000 });
  await b.addStyleTag({ content: '*{animation:none!important;transition:none!important} nextjs-portal{display:none!important}' });
  await b.waitForFunction(() => !document.querySelector('svg.animate-spin'), null, { timeout: 45000 }).catch(() => console.log('  still loading'));
  await b.waitForTimeout(1500);
  await b.screenshot({ path: `${out}/${name}_b.png`, fullPage: true });
  await b.close();
  console.log(`${name}: ${width}px  design vs ${route}`);
}
await browser.close();
