import { schema } from '@getnextbike/db';
import { and, asc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { notFound } from '@/lib/api';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ brand: string; model: string }> },
) {
  const { brand, model } = await params;
  const [row] = await db
    .select({
      id: schema.models.id,
      slug: schema.models.slug,
      name: schema.models.name,
      category: schema.models.category,
      disciplineTags: schema.models.disciplineTags,
      description: schema.models.description,
      brand: {
        slug: schema.brands.slug,
        name: schema.brands.name,
        countryCode: schema.brands.countryCode,
      },
    })
    .from(schema.models)
    .innerJoin(schema.brands, eq(schema.models.brandId, schema.brands.id))
    .where(and(eq(schema.brands.slug, brand), eq(schema.models.slug, model)))
    .limit(1);

  if (!row) return notFound();

  const years = await db
    .select({
      year: schema.modelYears.year,
      msrpAmount: schema.modelYears.msrpAmount,
      msrpCurrency: schema.modelYears.msrpCurrency,
      heroImageUrl: schema.modelYears.heroImageUrl,
    })
    .from(schema.modelYears)
    .where(eq(schema.modelYears.modelId, row.id))
    .orderBy(asc(schema.modelYears.year));

  return NextResponse.json({ data: { ...row, years } });
}
