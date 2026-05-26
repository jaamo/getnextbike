import { schema } from '@getnextbike/db';
import { and, asc, eq, gt, or, type SQL } from 'drizzle-orm';
import type { NextRequest } from 'next/server';
import { encodeCursor, listResponse, parseCursor, parseLimit } from '@/lib/api';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Cursor = { brandSlug: string; modelSlug: string };

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const limit = parseLimit(sp);
  const cursor = parseCursor<Cursor>(sp);
  const brand = sp.get('brand');
  const category = sp.get('category');
  const year = sp.get('year') ? Number.parseInt(sp.get('year')!, 10) : null;
  const region = sp.get('region');

  const where: SQL[] = [];
  if (brand) where.push(eq(schema.brands.slug, brand));
  if (category) {
    const allowed = schema.modelCategory.enumValues;
    if ((allowed as readonly string[]).includes(category)) {
      where.push(eq(schema.models.category, category as (typeof allowed)[number]));
    }
  }
  if (year && Number.isFinite(year)) where.push(eq(schema.modelYears.year, year));
  if (region) {
    where.push(or(eq(schema.regions.code, region.toUpperCase()), eq(schema.regions.code, region))!);
  }
  if (cursor) {
    where.push(
      or(
        gt(schema.brands.slug, cursor.brandSlug),
        and(eq(schema.brands.slug, cursor.brandSlug), gt(schema.models.slug, cursor.modelSlug)),
      )!,
    );
  }

  const baseQuery = db
    .selectDistinct({
      id: schema.models.id,
      slug: schema.models.slug,
      name: schema.models.name,
      category: schema.models.category,
      brandSlug: schema.brands.slug,
      brandName: schema.brands.name,
    })
    .from(schema.models)
    .innerJoin(schema.brands, eq(schema.models.brandId, schema.brands.id));

  // Only join modelYears / regions when filtering by them — avoids needless cartesian rows.
  const query =
    year || region
      ? baseQuery
          .innerJoin(schema.modelYears, eq(schema.modelYears.modelId, schema.models.id))
          .leftJoin(
            schema.modelVariants,
            eq(schema.modelVariants.modelYearId, schema.modelYears.id),
          )
          .leftJoin(schema.regions, eq(schema.modelVariants.regionId, schema.regions.id))
      : baseQuery;

  const rows = await query
    .where(where.length > 0 ? and(...where) : undefined)
    .orderBy(asc(schema.brands.slug), asc(schema.models.slug))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const tail = items[items.length - 1];
  const next =
    hasMore && tail
      ? encodeCursor<Cursor>({ brandSlug: tail.brandSlug, modelSlug: tail.slug })
      : null;

  return listResponse(items, next);
}
