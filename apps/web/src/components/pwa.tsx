'use client';

import { useEffect } from 'react';

/** Registers the service worker that makes the employee app installable and shows an offline page. */
export function ServiceWorker() {
  useEffect(() => {
    // Production only: in development it would cache builds that are still changing
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Not fatal: the app works the same, only without the offline page
    });
  }, []);
  return null;
}
