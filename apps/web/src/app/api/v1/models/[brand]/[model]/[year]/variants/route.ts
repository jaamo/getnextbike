import { schema } from '@getnextbike/db';
import { and, asc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { badRequest, notFound } from '@/lib/api';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ brand: string; model: string; year: string }> },
) {
  const { brand, model, year } = await params;
  const y = Number.parseInt(year, 10);
  if (!Number.isFinite(y)) return badRequest('year must be an integer');

  const [my] = await db
    .select({ id: schema.modelYears.id })
    .from(schema.modelYears)
    .innerJoin(schema.models, eq(schema.modelYears.modelId, schema.models.id))
    .innerJoin(schema.brands, eq(schema.models.brandId, schema.brands.id))
    .where(
      and(
        eq(schema.brands.slug, brand),
        eq(schema.models.slug, model),
        eq(schema.modelYears.year, y),
      ),
    )
    .limit(1);
  if (!my) return notFound();

  const rows = await db
    .select({
      id: schema.modelVariants.id,
      sku: schema.modelVariants.sku,
      buildName: schema.modelVariants.buildName,
      frameSize: schema.modelVariants.frameSize,
      color: schema.modelVariants.color,
      weightGrams: schema.modelVariants.weightGrams,
      notes: schema.modelVariants.notes,
      region: {
        code: schema.regions.code,
        name: schema.regions.name,
      },
    })
    .from(schema.modelVariants)
    .leftJoin(schema.regions, eq(schema.modelVariants.regionId, schema.regions.id))
    .where(eq(schema.modelVariants.modelYearId, my.id))
    .orderBy(asc(schema.modelVariants.buildName));

  return NextResponse.json({ data: rows });
}
