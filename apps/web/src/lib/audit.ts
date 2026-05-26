import { schema } from '@getnextbike/db';
import { auth } from './auth';
import { db } from './db';

type Jsonable = Record<string, unknown> | unknown[] | null;

export interface RecordAuditInput {
  action: string;
  entityKind: string;
  entityId?: string | null;
  before?: Jsonable;
  after?: Jsonable;
}

export async function recordAudit({
  action,
  entityKind,
  entityId = null,
  before = null,
  after = null,
}: RecordAuditInput) {
  const session = await auth();
  await db.insert(schema.auditLog).values({
    actorUserId: session?.user?.id ?? null,
    action,
    entityKind,
    entityId,
    beforeJson: before as never,
    afterJson: after as never,
  });
}
