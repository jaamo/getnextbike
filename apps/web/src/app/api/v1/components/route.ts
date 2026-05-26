import { schema } from '@getnextbike/db';
import { and, asc, eq, gt, type SQL } from 'drizzle-orm';
import type { NextRequest } from 'next/server';
import { encodeCursor, listResponse, parseCursor, parseLimit } from '@/lib/api';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Cursor = { name: string; id: string };

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const limit = parseLimit(sp);
  const cursor = parseCursor<Cursor>(sp);
  const type = sp.get('type');
  const manufacturer = sp.get('manufacturer');

  const where: SQL[] = [];
  if (type) {
    const allowed = schema.componentType.enumValues;
    if ((allowed as readonly string[]).includes(type)) {
      where.push(eq(schema.components.type, type as (typeof allowed)[number]));
    }
  }
  if (manufacturer) where.push(eq(schema.components.manufacturer, manufacturer));
  if (cursor) where.push(gt(schema.components.name, cursor.name));

  const rows = await db
    .select({
      id: schema.components.id,
      type: schema.components.type,
      manufacturer: schema.components.manufacturer,
      name: schema.components.name,
      tier: schema.components.tier,
      specJson: schema.components.specJson,
    })
    .from(schema.components)
    .where(where.length > 0 ? and(...where) : undefined)
    .orderBy(asc(schema.components.name), asc(schema.components.id))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const tail = items[items.length - 1];
  const next = hasMore && tail ? encodeCursor<Cursor>({ name: tail.name, id: tail.id }) : null;

  return listResponse(items, next);
}
