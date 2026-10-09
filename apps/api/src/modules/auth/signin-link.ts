import { config } from '../../config';
import { sendMail } from '../../common/mail';
import { sha256, token } from '../../common/util';
import { db } from '../../db/db';

/**
 * Emails a one-time sign-in link (15 minutes). Without an email provider (local development)
 * the link is returned instead, so you can still sign in.
 */
export async function sendSignInLink(
  email: string,
  copy = { heading: 'Sign in to Vellaire', line: 'Use the button below to sign in. The link works once and expires in 15 minutes.' },
) {
  const t = token(32);
  await db.MagicToken.create({ email, tokenHash: sha256(t), expiresAt: new Date(Date.now() + 15 * 60_000) });
  const link = `${config.webUrl}/auth/verify?token=${t}`;
  await sendMail({ template: 'signin', to: email, subject: 'Your Vellaire sign-in link', heading: copy.heading, lines: [copy.line], button: { label: 'Sign in', url: link } });
  return config.mail.resendKey ? null : link;
}
