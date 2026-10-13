import { HttpException, HttpStatus } from '@nestjs/common';
import { randomInt } from 'crypto';
import { config } from '../../config';
import { sendMail } from '../../common/mail';
import { sha256, token } from '../../common/util';
import { db } from '../../db/db';

const VALID_MINUTES = 15;
export const MAX_CODE_ATTEMPTS = 5;

/** Codes are stored hashed with the email, so a leaked hash cannot be tried against another address. */
export const codeHash = (email: string, code: string) => sha256(`${email.toLowerCase()}:${code}`);

/**
 * Emails a one-time sign-in link and the same sign-in as a 6-digit code (15 minutes).
 * The code is for the installed app on iPhone, where the link opens in Safari instead of the app.
 * Without an email provider (local development) the link is returned instead, so you can still sign in.
 */
export async function sendSignInLink(email: string, copy = { heading: 'Sign in to Vellaire', line: 'Use the button below to sign in.' }) {
  // Caps guessing: at most 5 codes x 5 tries per address every 15 minutes
  const recent = await db.MagicToken.countDocuments({ email, createdAt: { $gt: new Date(Date.now() - VALID_MINUTES * 60_000) } });
  if (recent >= 5) throw new HttpException('Too many sign-in emails. Wait a few minutes, then try again.', HttpStatus.TOO_MANY_REQUESTS);
  const t = token(32);
  const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
  await db.MagicToken.create({ email, tokenHash: sha256(t), codeHash: codeHash(email, code), expiresAt: new Date(Date.now() + VALID_MINUTES * 60_000) });
  const link = `${config.webUrl}/auth/verify?token=${t}`;
  await sendMail({
    template: 'signin',
    to: email,
    subject: `${code} is your Vellaire sign-in code`,
    heading: copy.heading,
    lines: [copy.line, `Using the Vellaire app? Type this code instead: ${code.slice(0, 3)} ${code.slice(3)}`, `The link and the code work once and expire in ${VALID_MINUTES} minutes.`],
    button: { label: 'Sign in', url: link },
  });
  return config.mail.resendKey ? null : link;
}
