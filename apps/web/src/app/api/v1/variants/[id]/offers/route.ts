import { schema } from '@getnextbike/db';
import { and, asc, eq, type SQL } from 'drizzle-orm';
import { type NextRequest, NextResponse } from 'next/server';
import { assembleOffers } from '@/app/api/v1/_offers';
import { notFound } from '@/lib/api';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const KINDS = schema.resellerLocationKind.enumValues;

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sp = req.nextUrl.searchParams;
  const region = sp.get('region');
  const kind = sp.get('kind');

  const [variant] = await db
    .select({ id: schema.modelVariants.id })
    .from(schema.modelVariants)
    .where(eq(schema.modelVariants.id, id))
    .limit(1);
  if (!variant) return notFound();

  const where: SQL[] = [
    eq(schema.inventoryItems.variantId, id),
    eq(schema.inventoryItems.status, 'live'),
    eq(schema.resellerLocations.kind, 'online'),
  ];
  if (region) where.push(eq(schema.regions.code, region.toUpperCase()));
  if (kind && (KINDS as readonly string[]).includes(kind)) {
    where.push(eq(schema.resellerLocations.kind, kind as (typeof KINDS)[number]));
  }

  const items = await db
    .select({ id: schema.inventoryItems.id })
    .from(schema.inventoryItems)
    .innerJoin(
      schema.resellerLocations,
      eq(schema.inventoryItems.resellerLocationId, schema.resellerLocations.id),
    )
    .innerJoin(schema.regions, eq(schema.resellerLocations.regionId, schema.regions.id))
    .where(and(...where))
    .orderBy(asc(schema.inventoryItems.id));

  const offers = await assembleOffers(items.map((i) => i.id));
  return NextResponse.json({ data: offers });
}
