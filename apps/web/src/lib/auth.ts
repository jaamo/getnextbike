import NextAuth from 'next-auth';

// Auth.js v5 scaffold. Providers and a database adapter land in the Phase 1
// follow-up that builds the users/sessions schema and the admin login flow
// (spec §6). For now this exists so route handlers and middleware can import
// the canonical `auth` helper from one place.
export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [],
  session: { strategy: 'jwt' },
});
