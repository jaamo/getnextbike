import { bigserial, index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { users } from './users';

// Every admin mutation appends one row here. Spec §6: actor, action, target,
// before/after diff. `entityId` is stored as text so the same table can
// reference any of our domain tables without a polymorphic FK.
export const auditLog = pgTable(
  'audit_log',
  {
    id: bigserial({ mode: 'number' }).primaryKey(),
    actorUserId: uuid().references(() => users.id, { onDelete: 'set null' }),
    action: text().notNull(),
    entityKind: text().notNull(),
    entityId: text(),
    beforeJson: jsonb(),
    afterJson: jsonb(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('audit_log_created_at_idx').on(t.createdAt.desc()),
    index('audit_log_entity_idx').on(t.entityKind, t.entityId),
    index('audit_log_actor_idx').on(t.actorUserId, t.createdAt.desc()),
  ],
);

export type AuditLogRow = typeof auditLog.$inferSelect;
export type NewAuditLogRow = typeof auditLog.$inferInsert;
