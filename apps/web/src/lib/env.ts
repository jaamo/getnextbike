import { z } from 'zod';

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  AUTH_SECRET: z.string().min(1).optional(),
  ANTHROPIC_API_KEY: z.string().min(1).optional(),
});

export const env = (() => {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    // Throw lazily — server-side modules import this; production must fail fast.
    throw new Error(`Invalid environment: ${parsed.error.message}`);
  }
  return parsed.data;
})();
