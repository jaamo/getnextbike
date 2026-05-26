import { sql } from 'drizzle-orm';
import { timestamp } from 'drizzle-orm/pg-core';

/**
 * Standard created_at / updated_at columns. updated_at refreshes on every
 * write via Drizzle's $onUpdate hook (no DB trigger needed).
 */
export const timestamps = {
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => sql`now()`),
};
