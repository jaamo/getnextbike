import { schema } from '@getnextbike/db';
import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { notFound } from '@/lib/api';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [variant] = await db
    .select({
      id: schema.modelVariants.id,
      sku: schema.modelVariants.sku,
      buildName: schema.modelVariants.buildName,
      frameSize: schema.modelVariants.frameSize,
      color: schema.modelVariants.color,
      weightGrams: schema.modelVariants.weightGrams,
      notes: schema.modelVariants.notes,
      year: schema.modelYears.year,
      model: {
        slug: schema.models.slug,
        name: schema.models.name,
        category: schema.models.category,
      },
      brand: {
        slug: schema.brands.slug,
        name: schema.brands.name,
      },
      region: {
        code: schema.regions.code,
        name: schema.regions.name,
      },
    })
    .from(schema.modelVariants)
    .innerJoin(schema.modelYears, eq(schema.modelVariants.modelYearId, schema.modelYears.id))
    .innerJoin(schema.models, eq(schema.modelYears.modelId, schema.models.id))
    .innerJoin(schema.brands, eq(schema.models.brandId, schema.brands.id))
    .leftJoin(schema.regions, eq(schema.modelVariants.regionId, schema.regions.id))
    .where(eq(schema.modelVariants.id, id))
    .limit(1);

  if (!variant) return notFound();

  const components = await db
    .select({
      role: schema.modelVariantComponents.role,
      id: schema.components.id,
      type: schema.components.type,
      manufacturer: schema.components.manufacturer,
      name: schema.components.name,
      tier: schema.components.tier,
    })
    .from(schema.modelVariantComponents)
    .innerJoin(
      schema.components,
      eq(schema.modelVariantComponents.componentId, schema.components.id),
    )
    .where(eq(schema.modelVariantComponents.variantId, id));

  return NextResponse.json({ data: { ...variant, components } });
}
