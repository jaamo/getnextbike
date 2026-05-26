import type { NextAuthConfig } from 'next-auth';
import type { AppUserRole } from '@/types/next-auth';

// Edge-safe slice of the auth config — no Node-only deps so it can be imported
// from `middleware.ts`. Providers (which need bcrypt + the DB) are added in
// `auth.ts` for the Node runtime.
export const authConfig = {
  pages: { signIn: '/login' },
  session: { strategy: 'jwt' },
  providers: [],
  callbacks: {
    authorized: ({ request, auth }) => {
      const { pathname } = request.nextUrl;
      if (pathname.startsWith('/admin')) return !!auth;
      return true;
    },
    jwt: ({ token, user }) => {
      if (user) {
        token.id = user.id;
        token.role = (user as { role?: AppUserRole }).role;
      }
      return token;
    },
    session: ({ session, token }) => {
      if (token?.id && session.user) {
        session.user.id = String(token.id);
        session.user.role = (token.role ?? 'editor') as AppUserRole;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
