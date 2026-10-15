import { randomBytes, scrypt, timingSafeEqual } from 'crypto';
import { promisify } from 'util';
import { z } from 'zod';

const scryptAsync = promisify(scrypt) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;

/** The rule the sign-up design shows: 12+ characters, a number and a symbol. */
export const passwordSchema = z
  .string()
  .min(12, 'Use at least 12 characters')
  .max(200)
  .regex(/\d/, 'Add a number')
  .regex(/[^A-Za-z0-9]/, 'Add a symbol');

/** Stored as scrypt$<salt>$<hash>; the plain password is never kept. */
export async function hashPassword(pw: string) {
  const salt = randomBytes(16);
  const hash = await scryptAsync(pw, salt, 64);
  return `scrypt$${salt.toString('base64')}$${hash.toString('base64')}`;
}

export async function checkPassword(pw: string, stored?: string | null) {
  const [kind, salt, hash] = (stored || '').split('$');
  if (kind !== 'scrypt' || !salt || !hash) return false;
  const expected = Buffer.from(hash, 'base64');
  const actual = await scryptAsync(pw, Buffer.from(salt, 'base64'), expected.length);
  return timingSafeEqual(actual, expected);
}
