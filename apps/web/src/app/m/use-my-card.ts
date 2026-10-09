'use client';

import { useApi } from '@/lib/api';

/** The signed-in employee's card. 404 means the company has not created it yet. */
export function useMyCard() {
  return useApi<any>('/me/card', { shouldRetryOnError: false });
}
