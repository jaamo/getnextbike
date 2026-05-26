import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  // Workspace packages are TS source — Next has to transpile them.
  transpilePackages: ['@getnextbike/db', '@getnextbike/core'],
  experimental: {
    typedRoutes: true,
  },
};

export default nextConfig;
