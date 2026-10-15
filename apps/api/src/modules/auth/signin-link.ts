import { HttpException, HttpStatus } from '@nestjs/common';
import { randomInt } from 'crypto';
import { config } from '../../config';
import { mailReady, sendMail } from '../../common/mail';
import { sha256, token } from '../../common/util';
import { db } from '../../db/db';

const VALID_MINUTES = 15;
const RESET_MINUTES = 60;
export const MAX_CODE_ATTEMPTS = 5;

/** Codes are stored hashed with the email, so a leaked hash cannot be tried against another address. */
export const codeHash = (email: string, code: string) => sha256(`${email.toLowerCase()}:${code}`);

/**
 * Without an email provider, local development shows the link on screen so you can still sign in.
 * Never in production: anyone could type someone else's email and get into their account.
 */
export const showLinksOnScreen = () => !mailReady() && !config.isProd;

/** At most 5 emails per address every 15 minutes, so nobody can flood an inbox or guess codes. */
async function rateLimit(email: string) {
  const recent = await db.MagicToken.countDocuments({ email, createdAt: { $gt: new Date(Date.now() - VALID_MINUTES * 60_000) } });
  if (recent >= 5) throw new HttpException('Too many emails to this address. Wait a few minutes, then try again.', HttpStatus.TOO_MANY_REQUESTS);
}

/**
 * Emails a one-time sign-in link and the same sign-in as a 6-digit code (15 minutes).
 * The code is for the installed app on iPhone, where the link opens in Safari instead of the app.
 * Returns the link only when it may be shown on screen (see showLinksOnScreen).
 */
export async function sendSignInLink(email: string, copy = { heading: 'Sign in to Vellaire', line: 'Use the button below to sign in.' }) {
  await rateLimit(email);
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
  return showLinksOnScreen() ? link : null;
}

/** A one-time link to set a new password. Admins can create one for their people and share it by hand. */
export async function createResetLink(email: string, minutes = RESET_MINUTES) {
  const t = token(32);
  await db.MagicToken.create({ email: email.toLowerCase(), tokenHash: sha256(t), purpose: 'reset', expiresAt: new Date(Date.now() + minutes * 60_000) });
  return `${config.webUrl}/reset-password?token=${t}`;
}

/** "Forgot password": emails the reset link. Returns the link only when it may be shown on screen. */
export async function sendResetLink(email: string) {
  await rateLimit(email);
  const link = await createResetLink(email);
  await sendMail({
    template: 'password_reset',
    to: email,
    subject: 'Reset your Vellaire password',
    heading: 'Reset your password',
    lines: ['Someone asked to reset the password for this email. If it was you, use the button to choose a new one.', `The link works once and expires in ${RESET_MINUTES} minutes. If you did not ask, ignore this email.`],
    button: { label: 'Choose a new password', url: link },
  });
  return showLinksOnScreen() ? link : null;
}
