import { schema } from '@getnextbike/db';
import { eq } from 'drizzle-orm';
import Link from 'next/link';
import { notFound } from 'next/navigation';
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
import { selectorFields } from '../enums';

export const dynamic = 'force-dynamic';

export default async function StorefrontDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [storefront] = await db
    .select({
      id: schema.resellerLocations.id,
      name: schema.resellerLocations.name,
      storefrontUrl: schema.resellerLocations.storefrontUrl,
      resellerName: schema.resellers.name,
      kind: schema.resellerLocations.kind,
    })
    .from(schema.resellerLocations)
    .innerJoin(schema.resellers, eq(schema.resellerLocations.resellerId, schema.resellers.id))
    .where(eq(schema.resellerLocations.id, id))
    .limit(1);
  if (!storefront || storefront.kind !== 'online') notFound();

  const selectorRows = await db
    .select({
      selectorId: schema.crawlSelectors.id,
      field: schema.crawlSelectors.field,
      status: schema.crawlSelectors.status,
      currentVersionId: schema.crawlSelectors.currentVersionId,
      updatedAt: schema.crawlSelectors.updatedAt,
      versionNumber: schema.crawlSelectorVersions.version,
      selectorType: schema.crawlSelectorVersions.selectorType,
      expression: schema.crawlSelectorVersions.expression,
      origin: schema.crawlSelectorVersions.origin,
    })
    .from(schema.crawlSelectors)
    .leftJoin(
      schema.crawlSelectorVersions,
      eq(schema.crawlSelectorVersions.id, schema.crawlSelectors.currentVersionId),
    )
    .where(eq(schema.crawlSelectors.resellerLocationId, id));

  const byField = new Map(selectorRows.map((row) => [row.field as string, row] as const));

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {storefront.resellerName} · {storefront.name}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          One selector per field. Saving creates a new version and makes it current.
        </p>
        <a
          className="mt-1 inline-block text-xs underline text-muted-foreground"
          href={storefront.storefrontUrl ?? '#'}
          rel="noopener noreferrer"
          target="_blank"
        >
          {storefront.storefrontUrl}
        </a>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Field</TableHead>
              <TableHead>Current selector</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Version</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {selectorFields.map((field) => {
              const sel = byField.get(field);
              return (
                <TableRow key={field}>
                  <TableCell className="font-mono text-xs">{field}</TableCell>
                  <TableCell className="font-mono text-xs truncate max-w-md">
                    {sel?.expression ?? (
                      <span className="text-muted-foreground">— not configured —</span>
                    )}
                  </TableCell>
                  <TableCell>{sel?.selectorType ?? '—'}</TableCell>
                  <TableCell>
                    {sel ? (
                      <Badge variant={sel.status === 'active' ? 'default' : 'secondary'}>
                        {sel.status}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {sel?.versionNumber ? (
                      <Badge variant="outline">v{sel.versionNumber}</Badge>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                  <TableCell>
                    <Link className="text-sm underline" href={`/admin/storefronts/${id}/${field}`}>
                      {sel ? 'Edit' : 'Add'}
                    </Link>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
