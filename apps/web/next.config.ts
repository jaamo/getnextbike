import type { NextConfig } from 'next';

// Env: we point Next at the repo-root .env via the `apps/web/.env.local`
// symlink (created during dev setup). That's the only way to get env vars
// into the Edge-bundled middleware as well — loading env from next.config.ts
// covers Node-runtime pages but not the middleware.

const nextConfig: NextConfig = {
  output: 'standalone',
  // Workspace packages are TS source — Next has to transpile them.
  transpilePackages: ['@getnextbike/db', '@getnextbike/core'],
  typedRoutes: true,
};

export default nextConfig;
