import { schema } from '@getnextbike/db';
import { and, asc, eq, gt, type SQL } from 'drizzle-orm';
import { type NextRequest, NextResponse } from 'next/server';
import { encodeCursor, listResponse, parseCursor, parseLimit } from '@/lib/api';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Cursor = { slug: string };

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const limit = parseLimit(sp);
  const cursor = parseCursor<Cursor>(sp);
  const country = sp.get('country')?.toUpperCase() ?? null;
  const slug = sp.get('slug') ?? null;

  const where: SQL[] = [];
  if (country) where.push(eq(schema.brands.countryCode, country));
  if (slug) where.push(eq(schema.brands.slug, slug));
  if (cursor) where.push(gt(schema.brands.slug, cursor.slug));

  const rows = await db
    .select({
      id: schema.brands.id,
      slug: schema.brands.slug,
      name: schema.brands.name,
      countryCode: schema.brands.countryCode,
      websiteUrl: schema.brands.websiteUrl,
      description: schema.brands.description,
    })
    .from(schema.brands)
    .where(where.length > 0 ? and(...where) : undefined)
    .orderBy(asc(schema.brands.slug))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const next =
    hasMore && items.length > 0
      ? encodeCursor<Cursor>({ slug: items[items.length - 1]!.slug })
      : null;

  return listResponse(items, next);
}

export function HEAD() {
  return new NextResponse(null, { status: 200 });
}
