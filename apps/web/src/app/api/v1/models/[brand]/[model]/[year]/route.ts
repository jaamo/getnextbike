import { schema } from '@getnextbike/db';
import { and, eq } from 'drizzle-orm';
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

  const [row] = await db
    .select({
      id: schema.modelYears.id,
      year: schema.modelYears.year,
      msrpAmount: schema.modelYears.msrpAmount,
      msrpCurrency: schema.modelYears.msrpCurrency,
      heroImageUrl: schema.modelYears.heroImageUrl,
      specSheetUrl: schema.modelYears.specSheetUrl,
      model: {
        slug: schema.models.slug,
        name: schema.models.name,
        category: schema.models.category,
      },
      brand: {
        slug: schema.brands.slug,
        name: schema.brands.name,
      },
    })
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

  if (!row) return notFound();
  return NextResponse.json({ data: row });
}
