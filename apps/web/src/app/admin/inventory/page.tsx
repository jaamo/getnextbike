import { schema } from '@getnextbike/db';
import { and, desc, eq, type SQL } from 'drizzle-orm';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { db } from '@/lib/db';
import { inventoryStatuses } from './enums';

export const dynamic = 'force-dynamic';

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; reseller?: string }>;
}) {
  const sp = await searchParams;
  const where: SQL[] = [];
  if (sp.status && (inventoryStatuses as readonly string[]).includes(sp.status)) {
    where.push(eq(schema.inventoryItems.status, sp.status as (typeof inventoryStatuses)[number]));
  }
  if (sp.reseller) where.push(eq(schema.resellers.slug, sp.reseller));

  const rows = await db
    .select({
      id: schema.inventoryItems.id,
      productUrl: schema.inventoryItems.productUrl,
      titleAtSource: schema.inventoryItems.titleAtSource,
      status: schema.inventoryItems.status,
      firstSeenAt: schema.inventoryItems.firstSeenAt,
      lastCrawledAt: schema.inventoryItems.lastCrawledAt,
      variantBuildName: schema.modelVariants.buildName,
      modelName: schema.models.name,
      brandName: schema.brands.name,
      resellerName: schema.resellers.name,
      locationName: schema.resellerLocations.name,
    })
    .from(schema.inventoryItems)
    .leftJoin(schema.modelVariants, eq(schema.inventoryItems.variantId, schema.modelVariants.id))
    .leftJoin(schema.modelYears, eq(schema.modelVariants.modelYearId, schema.modelYears.id))
    .leftJoin(schema.models, eq(schema.modelYears.modelId, schema.models.id))
    .leftJoin(schema.brands, eq(schema.models.brandId, schema.brands.id))
    .innerJoin(
      schema.resellerLocations,
      eq(schema.inventoryItems.resellerLocationId, schema.resellerLocations.id),
    )
    .innerJoin(schema.resellers, eq(schema.resellerLocations.resellerId, schema.resellers.id))
    .where(where.length > 0 ? and(...where) : undefined)
    .orderBy(desc(schema.inventoryItems.firstSeenAt))
    .limit(200);

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Inventory</h1>
        <Button asChild>
          <Link href="/admin/inventory/new">Register product URL</Link>
        </Button>
      </div>

      <div className="mt-4 flex gap-2 text-xs">
        <Link className="rounded-md border px-2 py-1 hover:bg-accent" href="/admin/inventory">
          All
        </Link>
        {inventoryStatuses.map((s) => (
          <Link
            key={s}
            className="rounded-md border px-2 py-1 hover:bg-accent"
            href={`/admin/inventory?status=${s}`}
          >
            {s}
          </Link>
        ))}
      </div>

      <div className="mt-4 rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Reseller · location</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Matched variant</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last crawled</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  No inventory items.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-sm">
                    {r.resellerName} · {r.locationName}
                  </TableCell>
                  <TableCell className="font-medium">
                    {r.titleAtSource ?? <span className="text-muted-foreground">—</span>}
                    <div className="text-xs text-muted-foreground truncate max-w-md">
                      {r.productUrl}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">
                    {r.brandName && r.modelName ? (
                      `${r.brandName} ${r.modelName}${
                        r.variantBuildName ? ` · ${r.variantBuildName}` : ''
                      }`
                    ) : (
                      <Badge variant="outline">unmatched</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={r.status === 'live' ? 'default' : 'secondary'}>
                      {r.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {r.lastCrawledAt ? r.lastCrawledAt.toISOString().slice(0, 16) : '—'}
                  </TableCell>
                  <TableCell>
                    <Link className="text-sm underline" href={`/admin/inventory/${r.id}`}>
                      Edit
                    </Link>
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
