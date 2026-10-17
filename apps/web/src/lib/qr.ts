import QRCode from 'qrcode';

/** The company QR style. Keep in step with apps/api/src/common/qr.ts, which draws the same code for downloads. */
export type QrStyle = { shape: 'rounded' | 'square' | 'dots'; fg: string; bg: string; centre: 'logo' | 'seal' | 'none'; frameText: string };

export const SEAL_PATHS =
  '<g fill="none" stroke="#B08D4F" stroke-width="1.2"><circle cx="20" cy="20" r="18.5"/><rect x="17.6" y="8" width="4.8" height="21" rx="0.8" transform="rotate(-20 20 29)"/><rect x="17.6" y="8" width="4.8" height="21" rx="0.8" transform="rotate(20 20 29)"/></g>';

/** Real QR modules for a link, with the middle cleared when a centre mark covers it (error correction H). */
export function qrMatrix(text: string, clearCentre: boolean) {
  const qr = QRCode.create(text, { errorCorrectionLevel: 'H' });
  const n = qr.modules.size;
  const c0 = Math.floor(n * 0.4);
  const c1 = n - c0 - 1;
  const cells: boolean[] = [];
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) cells.push(!!qr.modules.get(y, x) && !(clearCentre && x >= c0 && x <= c1 && y >= c0 && y <= c1));
  // The three corner squares stay square whatever the dot shape, or scanners miss them
  const finder = (i: number) => {
    const x = i % n;
    const y = Math.floor(i / n);
    return (x < 7 && y < 7) || (x >= n - 7 && y < 7) || (x < 7 && y >= n - 7);
  };
  return { n, cells, c0, c1, finder };
}

/** The same code as an SVG file. `logo` should be a data URI so it survives download and printing. */
export function qrSvg(text: string, style: QrStyle, logo?: string) {
  const centre = style.centre !== 'none';
  const { n, cells, c0, c1, finder } = qrMatrix(text, centre);
  const margin = 2;
  const full = n + margin * 2;
  // Modules overlap slightly: hairline gaps stop scanners reading the code
  const r = style.shape === 'dots' ? 0.5 : style.shape === 'rounded' ? 0.3 : 0;
  let dots = '';
  cells.forEach((on, i) => {
    if (on) dots += `<rect x="${(i % n) + margin - 0.03}" y="${Math.floor(i / n) + margin - 0.03}" width="1.06" height="1.06"${r && !finder(i) ? ` rx="${r}"` : ''}/>`;
  });
  let mid = '';
  if (centre) {
    const size = c1 - c0 + 1;
    const at = c0 + margin;
    const pad = size * 0.14;
    mid = `<rect x="${at}" y="${at}" width="${size}" height="${size}" rx="${size * 0.2}" fill="#FFFFFF"/>`;
    if (style.centre === 'seal') mid += `<g transform="translate(${at + pad} ${at + pad}) scale(${(size - pad * 2) / 40})">${SEAL_PATHS}</g>`;
    else if (logo) mid += `<image href="${logo}" x="${at + pad}" y="${at + pad}" width="${size - pad * 2}" height="${size - pad * 2}" preserveAspectRatio="xMidYMid meet"/>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${full} ${full}" width="${full * 12}" height="${full * 12}" shape-rendering="geometricPrecision"><rect width="${full}" height="${full}" fill="${style.bg}"/><g fill="${style.fg}">${dots}</g>${mid}</svg>`;
}

/** Fetches an image (the company logo) as a data URI; undefined if it cannot be read. */
export async function toDataUri(url?: string | null) {
  if (!url) return undefined;
  if (url.startsWith('data:')) return url;
  try {
    const blob = await (await fetch(url)).blob();
    return await new Promise<string>((ok, fail) => {
      const fr = new FileReader();
      fr.onload = () => ok(String(fr.result));
      fr.onerror = fail;
      fr.readAsDataURL(blob);
    });
  } catch {
    return undefined;
  }
}

/** Draws an SVG onto a canvas at `size` pixels and returns a PNG data URL. */
export function svgToPng(svg: string, size: number) {
  return new Promise<string>((ok, fail) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      canvas.getContext('2d')!.drawImage(img, 0, 0, size, size);
      ok(canvas.toDataURL('image/png'));
    };
    img.onerror = fail;
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  });
}
