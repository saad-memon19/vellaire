
const API = process.env.API_URL || 'http://localhost:4000';

/** Server-side fetch to the API (public endpoints only). */
export async function serverGet<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${API}${path}`, { cache: 'no-store' });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}
