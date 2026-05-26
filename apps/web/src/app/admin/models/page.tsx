import { schema } from '@getnextbike/db';
import { asc, eq } from 'drizzle-orm';
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

export default async function ModelsPage() {
  const rows = await db
    .select({
      id: schema.models.id,
      slug: schema.models.slug,
      name: schema.models.name,
      category: schema.models.category,
      brandName: schema.brands.name,
    })
    .from(schema.models)
    .leftJoin(schema.brands, eq(schema.models.brandId, schema.brands.id))
    .orderBy(asc(schema.brands.name), asc(schema.models.name));

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Models</h1>
        <Button asChild>
          <Link href="/admin/models/new">Add model</Link>
        </Button>
      </div>
      <div className="mt-6 rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Brand</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>Category</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  No models yet.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((m) => (
                <TableRow key={m.id}>
                  <TableCell>{m.brandName ?? '—'}</TableCell>
                  <TableCell className="font-medium">{m.name}</TableCell>
                  <TableCell className="font-mono text-xs">{m.slug}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{m.category}</Badge>
                  </TableCell>
                  <TableCell>
                    <Link className="text-sm underline" href={`/admin/models/${m.id}`}>
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
