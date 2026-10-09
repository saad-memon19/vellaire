import { config } from '../../config';
import { cardUrl, displayUrl } from '../../common/cards';

const esc = (s = '') => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** Email signature HTML for Outlook and Gmail. Table-based so every mail client renders it. */
export function signatureHtml(card: any, company: any) {
  const f = card.fields || {};
  const accent = company.brand?.colors?.[1]?.hex || '#B08D4F';
  const url = `${cardUrl(company, card.slug)}?src=signature`;
  const logo = company.brand?.logos?.light;
  const abs = (u?: string) => (u && u.startsWith('/') ? `${config.webUrl}${u}` : u);
  const rows = [
    f.phone && `<a href="tel:${esc(f.phone)}" style="color:#17171B;text-decoration:none">${esc(f.phone)}</a>`,
    f.email && `<a href="mailto:${esc(f.email)}" style="color:#17171B;text-decoration:none">${esc(f.email)}</a>`,
  ].filter(Boolean);
  return `<table cellpadding="0" cellspacing="0" border="0" style="font-family:Helvetica,Arial,sans-serif;color:#17171B;font-size:13px;line-height:1.5">
<tr>
${logo ? `<td style="padding-right:16px;border-right:1px solid ${accent};vertical-align:top"><img src="${esc(abs(logo))}" alt="${esc(company.name)}" width="56" style="display:block"></td>` : ''}
<td style="${logo ? 'padding-left:16px;' : ''}vertical-align:top">
<div style="font-family:Georgia,serif;font-size:18px">${esc(f.name)}</div>
<div style="color:#5E5952">${esc([f.title, company.name].filter(Boolean).join(' · '))}</div>
${rows.length ? `<div style="margin-top:6px">${rows.join(' &nbsp;·&nbsp; ')}</div>` : ''}
<div style="margin-top:6px"><a href="${esc(url)}" style="color:${accent};text-decoration:none">${esc(displayUrl(cardUrl(company, card.slug)))}</a></div>
</td>
</tr>
</table>`;
}
