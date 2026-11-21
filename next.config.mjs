import path from 'path';
const root = path.resolve('.');
const headers = [
  { key: 'X-Frame-Options', value: 'DENY' }, { key: 'X-Content-Type-Options', value: 'nosniff' }, { key: 'Referrer-Policy', value: 'same-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' }, { key: 'Strict-Transport-Security', value: 'max-age=31536000' },
];
export default {
  serverExternalPackages: ['better-sqlite3'], poweredByHeader: false, outputFileTracingRoot: root,
  webpack: (config) => { config.resolve.alias['@'] = root; return config; },
  async headers() { return [{ source: '/:path*', headers }]; },
};
