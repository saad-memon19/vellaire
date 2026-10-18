'use client';

import useSWR, { SWRConfiguration } from 'swr';
import { shrinkImage } from './image';

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

/** Sign-in endpoints answer 401 as part of their job; everything else (including /auth/me) means "go sign in". */
const isSignInCall = (path: string) => path.startsWith('/auth/') && !path.startsWith('/auth/me');

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      credentials: 'same-origin',
    });
  } catch {
    throw new ApiError('You are offline. Check your connection and try again.', 0);
  }
  if (res.status === 401 && typeof window !== 'undefined' && !isSignInCall(path)) {
    const here = window.location.pathname;
    // In the employee app, someone who was signed in on this phone sees "Please sign in again"
    let known = false;
    try {
      known = !!localStorage.getItem('vellaire.lastUser');
    } catch {}
    if (here === '/m/signed-out') {
      // Already there: stay
    } else if (here.startsWith('/m') && known) window.location.href = '/m/signed-out';
    else window.location.href = `/signin?next=${encodeURIComponent(here + window.location.search)}`;
  }
  const text = await res.text();
  const data = text ? (() => { try { return JSON.parse(text); } catch { return text; } })() : null;
  if (!res.ok) {
    const msg = Array.isArray(data?.message) ? data.message[0] : data?.message || `Something went wrong (${res.status})`;
    throw new ApiError(msg, res.status);
  }
  // Signing out forgets what this phone kept for offline use: the person's QR and their name
  if (path === '/auth/logout' && typeof window !== 'undefined') {
    try {
      localStorage.removeItem('vellaire.lastUser');
    } catch {}
    if ('caches' in window) caches.keys().then((keys) => keys.forEach((k) => caches.open(k).then((c) => c.delete('/api/me/qr')))).catch(() => {});
  }
  return data as T;
}

export const api = {
  get: <T = any>(p: string) => request<T>('GET', p),
  post: <T = any>(p: string, body: unknown = {}) => request<T>('POST', p, body),
  patch: <T = any>(p: string, body: unknown = {}) => request<T>('PATCH', p, body),
  del: <T = any>(p: string) => request<T>('DELETE', p),
  async upload(file: File): Promise<{ url: string; name: string }> {
    const fd = new FormData();
    fd.append('file', await shrinkImage(file));
    const res = await fetch('/api/uploads', { method: 'POST', body: fd });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new ApiError(data.message || 'Upload failed', res.status);
    return data;
  },
};

/** SWR hook over the API. Pass null to skip. */
export function useApi<T = any>(path: string | null, opts?: SWRConfiguration) {
  return useSWR<T>(path, (p: string) => api.get<T>(p), { revalidateOnFocus: false, keepPreviousData: true, ...opts });
}

export interface Me {
  user: {
    id: string;
    email: string;
    name: string;
    role: 'owner' | 'admin' | 'brand_manager' | 'member';
    platformRole: 'staff' | null;
    companyId: string | null;
    employeeId: string | null;
    impersonating: boolean;
  };
  company: {
    id: string;
    name: string;
    slug: string;
    plan: string;
    seats: number;
    status: string;
    logo: string | null;
    accent: string;
    cardHost: string | null;
    languages: string[];
    // Feature flags the Vellaire team turned on for this company
    flags: string[];
  } | null;
  badges: { approvals: number; leads: number; sync: number };
  features: { ai: boolean };
  home: string;
}

export const useMe = () => useApi<Me>('/auth/me');

export const qs = (o: Record<string, unknown>) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(o)) if (v !== undefined && v !== null && v !== '') p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : '';
};

export const isManager = (role?: string) => role === 'owner' || role === 'admin' || role === 'brand_manager';
export const isAdmin = (role?: string) => role === 'owner' || role === 'admin';
