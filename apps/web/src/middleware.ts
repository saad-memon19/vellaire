import { NextRequest, NextResponse } from 'next/server';

const APP_HOSTS = (process.env.APP_HOSTS || 'localhost,127.0.0.1')
  .split(',')
  .map((h) => h.trim().toLowerCase())
  .filter(Boolean);

/**
 * A company's own card domain (cards.meridian.com) serves only cards:
 * cards.meridian.com/sara-khan → /d/cards.meridian.com/sara-khan
 */
export function middleware(req: NextRequest) {
  const host = (req.headers.get('host') || '').split(':')[0]!.toLowerCase();
  if (!host || APP_HOSTS.includes(host) || host.endsWith('.vercel.app')) return NextResponse.next();
  const { pathname } = req.nextUrl;
  if (pathname.startsWith('/api') || pathname.startsWith('/_next') || pathname.startsWith('/files') || pathname.startsWith('/t/')) {
    return NextResponse.next();
  }
  const slug = pathname.split('/').filter(Boolean)[0];
  if (!slug) return NextResponse.next();
  const url = req.nextUrl.clone();
  url.pathname = `/d/${host}/${slug}`;
  return NextResponse.rewrite(url);
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] };
