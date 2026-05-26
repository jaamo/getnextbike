import NextAuth from 'next-auth';
import { authConfig } from '@/lib/auth.config';

export const { auth: middleware } = NextAuth(authConfig);

export const config = {
  // Match everything except API auth + Next internals + static assets so the
  // `authorized` callback runs and can redirect unauthenticated /admin visits.
  matcher: ['/((?!api/auth|_next/static|_next/image|favicon.ico).*)'],
};
