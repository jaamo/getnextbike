import { timestamp } from 'drizzle-orm/pg-core';

// Standard created_at / updated_at. $onUpdate must return a JS value that
// goes through column serialization, so it has to be a Date — a sql`now()`
// fragment trips PgTimestamp.mapToDriverValue (TypeError: toISOString is
// not a function).
export const timestamps = {
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};
