import { readFileSync, existsSync } from 'fs';
import jwt from 'jsonwebtoken';
import { cardUrl } from '../../common/cards';
import { config } from '../../config';

/**
 * Wallet passes.
 * Apple: needs a Pass Type ID certificate. Give each certificate as a file path (APPLE_*_PATH, for servers)
 *   or as base64 text (APPLE_WWDR_CERT, APPLE_SIGNER_CERT, APPLE_SIGNER_KEY, for Vercel, which has no files).
 * Google: needs a Google Wallet issuer and service account (GOOGLE_WALLET_* env vars).
 * Without them the buttons show a friendly "not set up yet" message.
 */
/** A certificate from NAME (base64 text) or NAME_PATH (a file); null when neither is set. */
function certificate(name: string): Buffer | null {
  if (process.env[name]) return Buffer.from(process.env[name]!, 'base64');
  const path = process.env[`${name}_PATH`];
  return path && existsSync(path) ? readFileSync(path) : null;
}

export const walletConfig = {
  apple: {
    passTypeId: process.env.APPLE_PASS_TYPE_ID || '',
    teamId: process.env.APPLE_TEAM_ID || '',
    wwdr: certificate('APPLE_WWDR_CERT'),
    signerCert: certificate('APPLE_SIGNER_CERT'),
    signerKey: certificate('APPLE_SIGNER_KEY'),
    keyPassphrase: process.env.APPLE_SIGNER_KEY_PASSPHRASE || '',
  },
  google: {
    issuerId: process.env.GOOGLE_WALLET_ISSUER_ID || '',
    serviceEmail: process.env.GOOGLE_WALLET_SERVICE_EMAIL || '',
    privateKey: (process.env.GOOGLE_WALLET_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
  },
};

export const appleReady = () => {
  const a = walletConfig.apple;
  return !!(a.passTypeId && a.teamId && a.wwdr && a.signerCert && a.signerKey);
};
export const googleReady = () => !!(walletConfig.google.issuerId && walletConfig.google.serviceEmail && walletConfig.google.privateKey);

const hexToRgb = (h: string) => {
  const n = parseInt(h.replace('#', ''), 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
};

/** Pass backgrounds offered on the Wallet passes page. Keep in step with apps/web/src/app/app/wallet/page.tsx. */
export const PASS_BACKGROUNDS: Record<string, { bg: string; fg: string; label: string }> = {
  Obsidian: { bg: '#17171B', fg: '#F6F1E7', label: '#C9A96E' },
  Navy: { bg: '#13203A', fg: '#F6F1E7', label: '#C9A96E' },
  Emerald: { bg: '#0F2E25', fg: '#F6F1E7', label: '#C9A96E' },
  Ivory: { bg: '#F6F1E7', fg: '#17171B', label: '#876A33' },
};

/** The saved pass design, or the brand colours with every field on when none was saved. */
export function passDesign(company: any) {
  const w = company?.brand?.wallet;
  const preset = w?.bg ? PASS_BACKGROUNDS[w.bg] : undefined;
  const colors = preset || {
    bg: company?.brand?.colors?.[0]?.hex || '#17171B',
    label: company?.brand?.colors?.[1]?.hex || '#C9A96E',
    fg: company?.brand?.colors?.[2]?.hex || '#F6F1E7',
  };
  const f = w?.fields || {};
  return { ...colors, fields: { name: f.name !== false, title: f.title !== false, office: f.office !== false, photo: f.photo !== false } };
}

const absolute = (u?: string) => (!u ? '' : /^https?:/.test(u) ? u : `${config.webUrl}${u.startsWith('/') ? '' : '/'}${u}`);

export async function applePass(card: any, company: any): Promise<Buffer> {
  // Loaded lazily so the API starts without the certificates
  const { PKPass } = await import('passkit-generator');
  const a = walletConfig.apple;
  const d = passDesign(company);
  const url = `${cardUrl(company, card.slug)}?src=wallet`;
  const pass = new PKPass(
    {},
    {
      wwdr: a.wwdr!,
      signerCert: a.signerCert!,
      signerKey: a.signerKey!,
      signerKeyPassphrase: a.keyPassphrase || undefined,
    },
    {
      formatVersion: 1,
      passTypeIdentifier: a.passTypeId,
      teamIdentifier: a.teamId,
      serialNumber: String(card._id),
      organizationName: company.name,
      description: `${card.fields?.name} · ${company.name}`,
      backgroundColor: hexToRgb(d.bg),
      foregroundColor: hexToRgb(d.fg),
      labelColor: hexToRgb(d.label),
      logoText: company.name.toUpperCase(),
    } as any,
  );
  pass.type = 'generic';
  if (d.fields.name) pass.primaryFields.push({ key: 'name', label: 'NAME', value: card.fields?.name || '' });
  if (d.fields.title) pass.secondaryFields.push({ key: 'title', label: 'TITLE', value: card.fields?.title || '' });
  if (d.fields.office) pass.auxiliaryFields.push({ key: 'office', label: 'OFFICE', value: card.fields?.office || '' });
  pass.backFields.push({ key: 'link', label: 'Online card', value: url });
  pass.setBarcodes({ message: url, format: 'PKBarcodeFormatQR', messageEncoding: 'iso-8859-1' });
  // A 1×1 icon keeps the pass valid when no logo has been uploaded
  const icon = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');
  pass.addBuffer('icon.png', icon);
  pass.addBuffer('icon@2x.png', icon);
  return pass.getAsBuffer();
}

export function googleSaveUrl(card: any, company: any) {
  const g = walletConfig.google;
  const url = `${cardUrl(company, card.slug)}?src=wallet`;
  const classId = `${g.issuerId}.vellaire_${company.slug.replace(/[^a-z0-9_]/gi, '_')}`;
  const objectId = `${g.issuerId}.card_${String(card._id)}`;
  const d = passDesign(company);
  // Google shows the photo only from a public https address
  const photo = d.fields.photo ? absolute(card.fields?.photoUrl) : '';
  const payload = {
    iss: g.serviceEmail,
    aud: 'google',
    typ: 'savetowallet',
    payload: {
      genericClasses: [{ id: classId }],
      genericObjects: [
        {
          id: objectId,
          classId,
          hexBackgroundColor: d.bg,
          cardTitle: { defaultValue: { language: 'en', value: company.name } },
          // Google requires a header, so the name stays even when switched off
          header: { defaultValue: { language: 'en', value: d.fields.name ? card.fields?.name || '' : company.name } },
          ...(d.fields.title && card.fields?.title ? { subheader: { defaultValue: { language: 'en', value: card.fields.title } } } : {}),
          ...(d.fields.office && card.fields?.office ? { textModulesData: [{ id: 'office', header: 'OFFICE', body: card.fields.office }] } : {}),
          ...(photo.startsWith('https://') ? { logo: { sourceUri: { uri: photo } } } : {}),
          barcode: { type: 'QR_CODE', value: url },
          linksModuleData: { uris: [{ uri: url, description: 'Online card' }] },
        },
      ],
    },
  };
  const token = jwt.sign(payload, g.privateKey, { algorithm: 'RS256' });
  return `https://pay.google.com/gp/v/save/${token}`;
}
