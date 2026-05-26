import { schema } from '@getnextbike/db';
import { asc, count, eq } from 'drizzle-orm';
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

export default async function StorefrontsPage() {
  const rows = await db
    .select({
      id: schema.resellerLocations.id,
      name: schema.resellerLocations.name,
      storefrontUrl: schema.resellerLocations.storefrontUrl,
      regionCode: schema.regions.code,
      resellerName: schema.resellers.name,
      selectorCount: count(schema.crawlSelectors.id),
    })
    .from(schema.resellerLocations)
    .innerJoin(schema.resellers, eq(schema.resellerLocations.resellerId, schema.resellers.id))
    .leftJoin(schema.regions, eq(schema.resellerLocations.regionId, schema.regions.id))
    .leftJoin(
      schema.crawlSelectors,
      eq(schema.crawlSelectors.resellerLocationId, schema.resellerLocations.id),
    )
    .where(eq(schema.resellerLocations.kind, 'online'))
    .groupBy(
      schema.resellerLocations.id,
      schema.resellerLocations.name,
      schema.resellerLocations.storefrontUrl,
      schema.regions.code,
      schema.resellers.name,
    )
    .orderBy(asc(schema.resellers.name), asc(schema.resellerLocations.name));

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Storefronts</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Online reseller locations and the crawler selectors that extract price/stock from them.
      </p>
      <div className="mt-6 rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Reseller · location</TableHead>
              <TableHead>Storefront URL</TableHead>
              <TableHead>Region</TableHead>
              <TableHead>Selectors configured</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  No online storefronts yet — add an online reseller location to manage selectors.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">
                    {r.resellerName} · {r.name}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground truncate max-w-sm">
                    {r.storefrontUrl}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{r.regionCode ?? '—'}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{r.selectorCount}</Badge>
                  </TableCell>
                  <TableCell>
                    <Link className="text-sm underline" href={`/admin/storefronts/${r.id}`}>
                      Manage
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
