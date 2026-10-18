/** The build that is live now; an open app compares it with its own to offer "Update now". */
export const dynamic = 'force-dynamic';

export function GET() {
  return Response.json({ build: process.env.NEXT_PUBLIC_BUILD_ID }, { headers: { 'Cache-Control': 'no-store' } });
}
