// Joins name_d.png and name_b.png side by side into name_pair.png. usage: node pair.mjs <dir> <width> <names...>
import { chromium } from 'playwright';
import { writeFileSync } from 'fs';
import { pathToFileURL } from 'url';
const [dir, w, ...names] = process.argv.slice(2);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: Number(w) * 2 + 20, height: 900 } });
for (const n of names) {
  const html = `${dir}/_pair.html`;
  writeFileSync(html, `<body style="margin:0;display:flex;gap:16px;background:#888;align-items:flex-start"><div><div style="font:bold 18px sans-serif;padding:4px;background:#fff">DESIGN</div><img src="${n}_d.png" style="width:${w}px;display:block"></div><div><div style="font:bold 18px sans-serif;padding:4px;background:#fff">BUILT</div><img src="${n}_b.png" style="width:${w}px;display:block"></div></body>`);
  await page.goto(pathToFileURL(html).href, { waitUntil: 'load' });
  await page.screenshot({ path: `${dir}/${n}_pair.png`, fullPage: true });
}
await browser.close();
console.log('paired', names.length);
