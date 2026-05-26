import { schema } from '@getnextbike/db';
import { desc, eq } from 'drizzle-orm';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function AuditLogPage() {
  const rows = await db
    .select({
      id: schema.auditLog.id,
      createdAt: schema.auditLog.createdAt,
      action: schema.auditLog.action,
      entityKind: schema.auditLog.entityKind,
      entityId: schema.auditLog.entityId,
      actorEmail: schema.users.email,
    })
    .from(schema.auditLog)
    .leftJoin(schema.users, eq(schema.auditLog.actorUserId, schema.users.id))
    .orderBy(desc(schema.auditLog.createdAt))
    .limit(200);

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Audit log</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Last 200 admin mutations. Every create / update / delete writes a row here (spec §6).
      </p>
      <div className="mt-6 rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-44">When</TableHead>
              <TableHead>Actor</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Entity</TableHead>
              <TableHead>ID</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  No audit entries yet.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs">
                    {r.createdAt.toISOString().replace('T', ' ').slice(0, 19)}
                  </TableCell>
                  <TableCell>
                    {r.actorEmail ?? <span className="text-muted-foreground">system</span>}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{r.action}</Badge>
                  </TableCell>
                  <TableCell>{r.entityKind}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {r.entityId ?? '—'}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
