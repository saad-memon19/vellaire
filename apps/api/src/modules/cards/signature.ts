import { config } from '../../config';
import { cardUrl, displayUrl } from '../../common/cards';

const esc = (s = '') => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

export type SignatureDesign = { style: 'Classic' | 'Compact' | 'With banner'; photo: boolean; qr: boolean; phone: boolean; social: boolean; booking: boolean; legal: string };

export const savedSignature = (company: any): SignatureDesign | null => (company?.brand?.signature?.style ? company.brand.signature : null);

/**
 * Email signature HTML for Outlook and Gmail. Table-based so every mail client renders it.
 * Uses the company design from Email signatures once saved (or `design` for a preview); otherwise the original layout.
 */
export function signatureHtml(card: any, company: any, design: SignatureDesign | null = savedSignature(company)) {
  if (design) return designedSignature(card, company, design);
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

const SOCIAL: Record<string, string> = { linkedin: 'LinkedIn', x: 'X', instagram: 'Instagram', whatsapp: 'WhatsApp' };

/** The layout from the Email signatures page: gold rule, photo, name, title, phone and card link, QR, legal line. */
function designedSignature(card: any, company: any, d: SignatureDesign) {
  const f = card.fields || {};
  const accent = company.brand?.colors?.[1]?.hex || '#B08D4F';
  const ink = company.brand?.colors?.[0]?.hex || '#17171B';
  const url = `${cardUrl(company, card.slug)}?src=signature`;
  const abs = (u?: string) => (u && u.startsWith('/') ? `${config.webUrl}${u}` : u);
  const compact = d.style === 'Compact';
  const size = compact ? 48 : 64;
  const links: { type: string; url: string }[] = card.links || [];
  const phone = d.phone ? f.mobile || f.phone : '';
  const booking = d.booking ? links.find((l) => l.type === 'booking') : undefined;
  const social = d.social ? links.filter((l) => SOCIAL[l.type]) : [];
  const line = (html: string) => `<div style="font-size:${compact ? 12 : 12.5}px;color:#5E5952">${html}</div>`;
  const a = (href: string, text: string, style = 'color:#5E5952') => `<a href="${esc(href)}" style="${style};text-decoration:none">${esc(text)}</a>`;

  const photo = d.photo && f.photoUrl ? `<td style="padding-right:16px;vertical-align:middle"><img src="${esc(abs(f.photoUrl))}" alt="" width="${size}" height="${size}" style="display:block;border-radius:50%"></td>` : '';
  // Mail clients need a hosted image, so the QR comes from the public API
  const qrImg = `${config.webUrl}/api/public/cards/${card._id}/qr.png`;
  const qr = d.qr ? `<td style="padding-left:18px;vertical-align:middle"><a href="${esc(url)}"><img src="${esc(qrImg)}" alt="QR code to my card" width="${size}" height="${size}" style="display:block"></a></td>` : '';
  const banner = d.style === 'With banner' ? `<tr><td colspan="2" style="padding-bottom:12px"><div style="background:${ink};color:#F6F1E7;font-size:11px;letter-spacing:2px;padding:8px 14px">${esc(company.name.toUpperCase())}</div></td></tr>` : '';
  const contact = [phone && a(`tel:${phone}`, phone), a(url, displayUrl(cardUrl(company, card.slug)))].filter(Boolean).join(' · ');
  const bookingRow = booking ? `<div style="font-size:12px;margin-top:2px">${a(booking.url, `Book a meeting with ${(f.name || '').split(' ')[0]}`, `color:${accent};font-weight:600`)}</div>` : '';
  const socialRow = social.length ? `<div style="font-size:11.5px;margin-top:2px">${social.map((l) => a(l.url, SOCIAL[l.type]!, 'color:#8E887E')).join(' · ')}</div>` : '';
  const legal = d.legal ? `<tr><td colspan="2" style="padding-top:12px;font-size:11px;color:#8E887E">${esc(d.legal)}</td></tr>` : '';

  return `<table cellpadding="0" cellspacing="0" border="0" style="font-family:Helvetica,Arial,sans-serif;color:#17171B;line-height:1.5">
${banner}<tr>
<td style="width:2px;background:${accent}"></td>
<td style="padding-left:18px"><table cellpadding="0" cellspacing="0" border="0"><tr>
${photo}<td style="vertical-align:middle">
<div style="font-family:Georgia,serif;font-size:${compact ? 17 : 21}px;font-weight:600">${esc(f.name)}</div>
${line(esc([f.title, company.name].filter(Boolean).join(' · ')))}
${line(contact)}
${bookingRow}${socialRow}
</td>${qr}
</tr></table></td>
</tr>
${legal}
</table>`;
}
