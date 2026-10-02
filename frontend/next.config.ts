import type { NextConfig } from 'next';
// Låter Next.js kompilera de delade TypeScript-paketen och stänger av X-Powered-By-headern.
const config: NextConfig = {
  transpilePackages: ['@stayfinder/shared', '@stayfinder/backend'],
  poweredByHeader: false,
};
export default config;
