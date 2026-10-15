/**
 * Prints a one-time link to set a password, for when email is not set up yet.
 * Uses the database in apps/api/.env, so run it against the live database to set the owner's password there.
 *   npm run password-link -w apps/api -- owner@vellaire.app
 * The link opens on WEB_URL from .env; to use it on the live site, swap the start of the link for the live address.
 */
import mongoose from 'mongoose';
import { config } from '../config';
import { connectDb, db } from '../db/db';
import { createResetLink } from '../modules/auth/signin-link';

async function main() {
  const email = (process.argv[2] || '').toLowerCase().trim();
  if (!email) throw new Error('Give an email: npm run password-link -w apps/api -- name@company.com');
  await connectDb(config.mongoUri);
  const user = await db.User.findOne({ email }).lean<any>();
  if (!user) throw new Error(`No account for ${email}`);
  const url = await createResetLink(email, 24 * 60);
  console.log(`\nPassword link for ${user.name || email} (works once, for 24 hours):\n\n  ${url}\n`);
}

main()
  .catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
