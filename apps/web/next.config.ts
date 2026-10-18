import type { NextConfig } from 'next';
import { version } from './package.json';

const API = process.env.API_URL || 'http://localhost:4000';

const nextConfig: NextConfig = {
  // Shown in the app's Settings ("Vellaire · version …")
  env: { NEXT_PUBLIC_APP_VERSION: version },
  // The browser talks to /api/* on the same origin; Next forwards it to the API server.
  async rewrites() {
    return [
      { source: '/api/:path*', destination: `${API}/:path*` },
      { source: '/files/:path*', destination: `${API}/files/:path*` },
    ];
  },
};

export default nextConfig;
