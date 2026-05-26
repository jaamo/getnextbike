import { schema } from '@getnextbike/db';
import { and, desc, eq, type SQL } from 'drizzle-orm';
import Link from 'next/link';
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

const STATUSES = ['success', 'partial', 'failed', 'blocked', 'timeout'] as const;

export default async function CrawlRunsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const sp = await searchParams;
  const where: SQL[] = [];
  if (sp.status && (STATUSES as readonly string[]).includes(sp.status)) {
    where.push(eq(schema.crawlRuns.status, sp.status as (typeof STATUSES)[number]));
  }

  const rows = await db
    .select({
      id: schema.crawlRuns.id,
      startedAt: schema.crawlRuns.startedAt,
      finishedAt: schema.crawlRuns.finishedAt,
      status: schema.crawlRuns.status,
      httpStatus: schema.crawlRuns.httpStatus,
      fetchDurationMs: schema.crawlRuns.fetchDurationMs,
      trigger: schema.crawlRuns.trigger,
      errorClass: schema.crawlRuns.errorClass,
      errorMessage: schema.crawlRuns.errorMessage,
      itemTitle: schema.inventoryItems.titleAtSource,
      itemId: schema.inventoryItems.id,
    })
    .from(schema.crawlRuns)
    .leftJoin(schema.inventoryItems, eq(schema.crawlRuns.inventoryItemId, schema.inventoryItems.id))
    .where(where.length > 0 ? and(...where) : undefined)
    .orderBy(desc(schema.crawlRuns.startedAt))
    .limit(200);

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Crawl runs</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Last 200 runs. Phase 2 = schema only; runs will populate once the crawler worker lands in
        Phase 3.
      </p>
      <div className="mt-4 flex gap-2 text-xs">
        <Link className="rounded-md border px-2 py-1 hover:bg-accent" href="/admin/crawl-runs">
          All
        </Link>
        {STATUSES.map((s) => (
          <Link
            key={s}
            className="rounded-md border px-2 py-1 hover:bg-accent"
            href={`/admin/crawl-runs?status=${s}`}
          >
            {s}
          </Link>
        ))}
      </div>
      <div className="mt-4 rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-44">Started</TableHead>
              <TableHead>Item</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>HTTP</TableHead>
              <TableHead>Fetch ms</TableHead>
              <TableHead>Trigger</TableHead>
              <TableHead>Error</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  No crawl runs yet.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs">
                    {r.startedAt.toISOString().replace('T', ' ').slice(0, 19)}
                  </TableCell>
                  <TableCell className="text-sm">
                    {r.itemId ? (
                      <Link className="underline" href={`/admin/inventory/${r.itemId}`}>
                        {r.itemTitle ?? r.itemId}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={r.status === 'success' ? 'default' : 'secondary'}>
                      {r.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{r.httpStatus ?? '—'}</TableCell>
                  <TableCell className="font-mono text-xs">{r.fetchDurationMs ?? '—'}</TableCell>
                  <TableCell className="text-xs">{r.trigger}</TableCell>
                  <TableCell className="text-xs text-destructive">
                    {r.errorClass ? `${r.errorClass}: ${r.errorMessage ?? ''}` : ''}
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
