import { readFileSync, existsSync } from 'fs';
import jwt from 'jsonwebtoken';
import { cardUrl } from '../../common/cards';

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

export async function applePass(card: any, company: any): Promise<Buffer> {
  // Loaded lazily so the API starts without the certificates
  const { PKPass } = await import('passkit-generator');
  const a = walletConfig.apple;
  const bg = company.brand?.colors?.[0]?.hex || '#17171B';
  const accent = company.brand?.colors?.[1]?.hex || '#C9A96E';
  const fg = company.brand?.colors?.[2]?.hex || '#F6F1E7';
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
      backgroundColor: hexToRgb(bg),
      foregroundColor: hexToRgb(fg),
      labelColor: hexToRgb(accent),
      logoText: company.name.toUpperCase(),
    } as any,
  );
  pass.type = 'generic';
  pass.primaryFields.push({ key: 'name', label: 'NAME', value: card.fields?.name || '' });
  pass.secondaryFields.push({ key: 'title', label: 'TITLE', value: card.fields?.title || '' });
  pass.auxiliaryFields.push({ key: 'office', label: 'OFFICE', value: card.fields?.office || '' });
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
          hexBackgroundColor: company.brand?.colors?.[0]?.hex || '#17171B',
          cardTitle: { defaultValue: { language: 'en', value: company.name } },
          header: { defaultValue: { language: 'en', value: card.fields?.name || '' } },
          subheader: { defaultValue: { language: 'en', value: card.fields?.title || '' } },
          barcode: { type: 'QR_CODE', value: url },
          linksModuleData: { uris: [{ uri: url, description: 'Online card' }] },
        },
      ],
    },
  };
  const token = jwt.sign(payload, g.privateKey, { algorithm: 'RS256' });
  return `https://pay.google.com/gp/v/save/${token}`;
}
