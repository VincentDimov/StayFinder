import type { NextConfig } from 'next';
const config: NextConfig = {
  transpilePackages: ['@stayfinder/shared', '@stayfinder/backend'],
  poweredByHeader: false,
};
export default config;
