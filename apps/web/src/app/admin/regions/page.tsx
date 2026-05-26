import { schema } from '@getnextbike/db';
import { asc } from 'drizzle-orm';
import Link from 'next/link';
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

export default async function RegionsPage() {
  const rows = await db.select().from(schema.regions).orderBy(asc(schema.regions.code));
  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Regions</h1>
        <Button asChild>
          <Link href="/admin/regions/new">Add region</Link>
        </Button>
      </div>
      <div className="mt-6 rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Currency</TableHead>
              <TableHead>Countries</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  No regions yet.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono">{r.code}</TableCell>
                  <TableCell>{r.name}</TableCell>
                  <TableCell>{r.defaultCurrency}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {r.countries.join(', ') || '—'}
                  </TableCell>
                  <TableCell>
                    <Link className="text-sm underline" href={`/admin/regions/${r.id}`}>
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
