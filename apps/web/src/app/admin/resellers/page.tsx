import { schema } from '@getnextbike/db';
import { asc, count, eq } from 'drizzle-orm';
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

export const dynamic = 'force-dynamic';

export default async function ResellersPage() {
  const rows = await db
    .select({
      id: schema.resellers.id,
      slug: schema.resellers.slug,
      name: schema.resellers.name,
      status: schema.resellers.status,
      locationCount: count(schema.resellerLocations.id),
    })
    .from(schema.resellers)
    .leftJoin(
      schema.resellerLocations,
      eq(schema.resellerLocations.resellerId, schema.resellers.id),
    )
    .groupBy(schema.resellers.id)
    .orderBy(asc(schema.resellers.name));

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Resellers</h1>
        <Button asChild>
          <Link href="/admin/resellers/new">Add reseller</Link>
        </Button>
      </div>
      <div className="mt-6 rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Locations</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  No resellers yet.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell className="font-mono text-xs">{r.slug}</TableCell>
                  <TableCell>
                    <Badge variant={r.status === 'active' ? 'default' : 'secondary'}>
                      {r.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">{r.locationCount}</TableCell>
                  <TableCell>
                    <Link className="text-sm underline" href={`/admin/resellers/${r.id}`}>
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
