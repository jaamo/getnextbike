import { schema } from '@getnextbike/db';
import { asc, desc, eq } from 'drizzle-orm';
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

export default async function ModelYearsPage() {
  const rows = await db
    .select({
      id: schema.modelYears.id,
      year: schema.modelYears.year,
      modelName: schema.models.name,
      brandName: schema.brands.name,
      msrpAmount: schema.modelYears.msrpAmount,
      msrpCurrency: schema.modelYears.msrpCurrency,
    })
    .from(schema.modelYears)
    .leftJoin(schema.models, eq(schema.modelYears.modelId, schema.models.id))
    .leftJoin(schema.brands, eq(schema.models.brandId, schema.brands.id))
    .orderBy(desc(schema.modelYears.year), asc(schema.models.name));

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Model years</h1>
        <Button asChild>
          <Link href="/admin/model-years/new">Add model year</Link>
        </Button>
      </div>
      <div className="mt-6 rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Year</TableHead>
              <TableHead>Brand</TableHead>
              <TableHead>Model</TableHead>
              <TableHead>MSRP</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  No model years yet.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((y) => (
                <TableRow key={y.id}>
                  <TableCell className="font-mono">{y.year}</TableCell>
                  <TableCell>{y.brandName ?? '—'}</TableCell>
                  <TableCell>{y.modelName ?? '—'}</TableCell>
                  <TableCell>
                    {y.msrpAmount ? `${y.msrpAmount} ${y.msrpCurrency ?? ''}` : '—'}
                  </TableCell>
                  <TableCell>
                    <Link className="text-sm underline" href={`/admin/model-years/${y.id}`}>
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
