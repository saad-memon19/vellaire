import QRCode from 'qrcode';
import { config } from '../config';

/** The company QR style from the QR studio. Keep in step with apps/web/src/lib/qr.ts. */
export type QrStyle = { shape: 'rounded' | 'square' | 'dots'; fg: string; bg: string; centre: 'logo' | 'seal' | 'none'; frameText: string };

export const DEFAULT_QR: QrStyle = { shape: 'rounded', fg: '#17171B', bg: '#FFFFFF', centre: 'logo', frameText: 'Scan to connect' };

/** The saved style, or null when the company never saved one (QR codes then stay plain, as before the studio). */
export const savedQrStyle = (company: any): QrStyle | null => (company?.brand?.qr?.shape ? { ...DEFAULT_QR, ...company.brand.qr } : null);
export const qrStyleOf = (company: any): QrStyle => savedQrStyle(company) || DEFAULT_QR;

const SEAL =
  '<g fill="none" stroke="#B08D4F" stroke-width="1.2"><circle cx="20" cy="20" r="18.5"/><rect x="17.6" y="8" width="4.8" height="21" rx="0.8" transform="rotate(-20 20 29)"/><rect x="17.6" y="8" width="4.8" height="21" rx="0.8" transform="rotate(20 20 29)"/></g>';

/**
 * A scannable QR as SVG in the company style. Error correction H keeps it readable with the centre covered.
 * `logo` is an image URL or data URI for the "Company logo" centre; without one the centre stays blank.
 */
export function qrSvg(text: string, style: QrStyle, logo?: string) {
  const qr = QRCode.create(text, { errorCorrectionLevel: 'H' });
  const n = qr.modules.size;
  const margin = 2;
  const full = n + margin * 2;
  const centre = style.centre !== 'none';
  // The middle fifth is cleared for the logo; H recovers up to 30% of the code
  const c0 = Math.floor(n * 0.4);
  const c1 = n - c0 - 1;
  // Modules overlap slightly so no hairline gaps show, and the three corner squares stay square: both are needed to scan reliably
  const r = style.shape === 'dots' ? 0.5 : style.shape === 'rounded' ? 0.3 : 0;
  const finder = (x: number, y: number) => (x < 7 && y < 7) || (x >= n - 7 && y < 7) || (x < 7 && y >= n - 7);
  let cells = '';
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      if (!qr.modules.get(y, x)) continue;
      if (centre && x >= c0 && x <= c1 && y >= c0 && y <= c1) continue;
      cells += `<rect x="${x + margin - 0.03}" y="${y + margin - 0.03}" width="1.06" height="1.06"${r && !finder(x, y) ? ` rx="${r}"` : ''}/>`;
    }
  let mid = '';
  if (centre) {
    const size = c1 - c0 + 1;
    const at = c0 + margin;
    mid = `<rect x="${at}" y="${at}" width="${size}" height="${size}" rx="${size * 0.2}" fill="#FFFFFF"/>`;
    const pad = size * 0.14;
    if (style.centre === 'seal') mid += `<g transform="translate(${at + pad} ${at + pad}) scale(${(size - pad * 2) / 40})">${SEAL}</g>`;
    else if (logo) mid += `<image href="${logo}" x="${at + pad}" y="${at + pad}" width="${size - pad * 2}" height="${size - pad * 2}" preserveAspectRatio="xMidYMid meet"/>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${full} ${full}" width="${full * 12}" height="${full * 12}" shape-rendering="geometricPrecision"><rect width="${full}" height="${full}" fill="${style.bg}"/><g fill="${style.fg}">${cells}</g>${mid}</svg>`;
}

/** The company logo as a data URI, so it shows inside an <img> and in downloaded files. */
export async function logoData(company: any) {
  const l = company?.brand?.logos?.icon || company?.brand?.logos?.light;
  if (!l) return undefined;
  if (l.startsWith('data:')) return l;
  try {
    const r = await fetch(/^https?:/.test(l) ? l : `${config.webUrl}${l.startsWith('/') ? '' : '/'}${l}`);
    if (!r.ok) return undefined;
    const type = r.headers.get('content-type') || 'image/png';
    return `data:${type};base64,${Buffer.from(await r.arrayBuffer()).toString('base64')}`;
  } catch {
    return undefined;
  }
}

/** A card's QR as SVG: the company style once saved in the QR studio, otherwise the plain code. */
export async function companyQrSvg(company: any, url: string, logo?: string) {
  const style = savedQrStyle(company);
  if (!style) return QRCode.toString(url, { type: 'svg', margin: 1, errorCorrectionLevel: 'H', color: { dark: '#17171B', light: '#FFFFFF' } });
  return qrSvg(url, style, style.centre === 'logo' ? (logo ?? (await logoData(company))) : undefined);
}
