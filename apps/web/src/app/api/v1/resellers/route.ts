import { schema } from '@getnextbike/db';
import { and, asc, eq, gt, type SQL, sql } from 'drizzle-orm';
import type { NextRequest } from 'next/server';
import { encodeCursor, listResponse, parseCursor, parseLimit } from '@/lib/api';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Cursor = { slug: string };

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const limit = parseLimit(sp);
  const cursor = parseCursor<Cursor>(sp);
  const region = sp.get('region');
  const country = sp.get('country')?.toUpperCase() ?? null;

  const where: SQL[] = [eq(schema.resellers.status, 'active')];
  if (cursor) where.push(gt(schema.resellers.slug, cursor.slug));

  // For region/country filtering we need to join through reseller_locations.
  const filterByLocation = !!(region || country);

  const baseQuery = db
    .selectDistinct({
      id: schema.resellers.id,
      slug: schema.resellers.slug,
      name: schema.resellers.name,
      logoUrl: schema.resellers.logoUrl,
      primaryWebsiteUrl: schema.resellers.primaryWebsiteUrl,
    })
    .from(schema.resellers);

  // biome-ignore lint/suspicious/noImplicitAnyLet: Drizzle's chained-builder types are infeasible to annotate here.
  let query;
  if (filterByLocation) {
    const withLocation = baseQuery.innerJoin(
      schema.resellerLocations,
      eq(schema.resellerLocations.resellerId, schema.resellers.id),
    );
    if (region) {
      query = withLocation.innerJoin(
        schema.regions,
        eq(schema.resellerLocations.regionId, schema.regions.id),
      );
      where.push(eq(schema.regions.code, region.toUpperCase()));
    } else {
      query = withLocation;
    }
    if (country) {
      where.push(
        sql`(${schema.resellerLocations.countryCode} = ${country} OR ${country} = ANY(${schema.resellerLocations.countriesServed}))`,
      );
    }
  } else {
    query = baseQuery;
  }

  const rows = await query
    .where(and(...where))
    .orderBy(asc(schema.resellers.slug))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const next =
    hasMore && items.length > 0
      ? encodeCursor<Cursor>({ slug: items[items.length - 1]!.slug })
      : null;

  return listResponse(items, next);
}
