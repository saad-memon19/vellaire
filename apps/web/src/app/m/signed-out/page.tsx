'use client';

import { SessionExpired } from '../system';

/** "Please sign in again": the employee app's session ended (the layout skips the account check here). */
export default function SignedOut() {
  return <SessionExpired />;
}
