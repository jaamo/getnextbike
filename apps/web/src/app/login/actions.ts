'use server';

import { AuthError } from 'next-auth';
import { signIn } from '@/lib/auth';

export type LoginState = { error?: string } | undefined;

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  try {
    await signIn('credentials', {
      email: formData.get('email'),
      password: formData.get('password'),
      redirectTo:
        typeof formData.get('callbackUrl') === 'string'
          ? String(formData.get('callbackUrl'))
          : '/admin',
    });
    return undefined;
  } catch (err) {
    if (err instanceof AuthError) {
      return { error: 'Invalid email or password' };
    }
    // NEXT_REDIRECT errors are thrown by signIn on success — must propagate.
    throw err;
  }
}
