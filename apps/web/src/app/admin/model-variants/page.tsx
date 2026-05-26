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

export default async function VariantsPage() {
  const rows = await db
    .select({
      id: schema.modelVariants.id,
      buildName: schema.modelVariants.buildName,
      frameSize: schema.modelVariants.frameSize,
      color: schema.modelVariants.color,
      year: schema.modelYears.year,
      modelName: schema.models.name,
      brandName: schema.brands.name,
      regionCode: schema.regions.code,
    })
    .from(schema.modelVariants)
    .leftJoin(schema.modelYears, eq(schema.modelVariants.modelYearId, schema.modelYears.id))
    .leftJoin(schema.models, eq(schema.modelYears.modelId, schema.models.id))
    .leftJoin(schema.brands, eq(schema.models.brandId, schema.brands.id))
    .leftJoin(schema.regions, eq(schema.modelVariants.regionId, schema.regions.id))
    .orderBy(desc(schema.modelYears.year), asc(schema.brands.name), asc(schema.models.name));

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Variants</h1>
        <Button asChild>
          <Link href="/admin/model-variants/new">Add variant</Link>
        </Button>
      </div>
      <div className="mt-6 rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Year</TableHead>
              <TableHead>Brand · Model</TableHead>
              <TableHead>Build</TableHead>
              <TableHead>Size / Color</TableHead>
              <TableHead>Region</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  No variants yet.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((v) => (
                <TableRow key={v.id}>
                  <TableCell className="font-mono">{v.year ?? '—'}</TableCell>
                  <TableCell>
                    {v.brandName ?? '—'} · {v.modelName ?? '—'}
                  </TableCell>
                  <TableCell>{v.buildName ?? '—'}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {[v.frameSize, v.color].filter(Boolean).join(' / ') || '—'}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{v.regionCode ?? 'Global'}</TableCell>
                  <TableCell>
                    <Link className="text-sm underline" href={`/admin/model-variants/${v.id}`}>
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
