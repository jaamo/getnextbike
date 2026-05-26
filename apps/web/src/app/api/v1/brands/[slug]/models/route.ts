import { schema } from '@getnextbike/db';
import { and, asc, eq, gt, type SQL } from 'drizzle-orm';
import type { NextRequest } from 'next/server';
import { encodeCursor, listResponse, notFound, parseCursor, parseLimit } from '@/lib/api';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Cursor = { slug: string };

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [brand] = await db
    .select({ id: schema.brands.id })
    .from(schema.brands)
    .where(eq(schema.brands.slug, slug))
    .limit(1);
  if (!brand) return notFound('Brand not found');

  const sp = req.nextUrl.searchParams;
  const limit = parseLimit(sp);
  const cursor = parseCursor<Cursor>(sp);

  const where: SQL[] = [eq(schema.models.brandId, brand.id)];
  if (cursor) where.push(gt(schema.models.slug, cursor.slug));

  const rows = await db
    .select({
      id: schema.models.id,
      slug: schema.models.slug,
      name: schema.models.name,
      category: schema.models.category,
      disciplineTags: schema.models.disciplineTags,
    })
    .from(schema.models)
    .where(and(...where))
    .orderBy(asc(schema.models.slug))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const next =
    hasMore && items.length > 0
      ? encodeCursor<Cursor>({ slug: items[items.length - 1]!.slug })
      : null;

  return listResponse(items, next);
}
