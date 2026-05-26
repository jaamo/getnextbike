import { schema } from '@getnextbike/db';
import { and, asc, eq, type SQL } from 'drizzle-orm';
import { type NextRequest, NextResponse } from 'next/server';
import { assembleOffers } from '@/app/api/v1/_offers';
import { notFound } from '@/lib/api';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const sp = req.nextUrl.searchParams;
  const locationSlug = sp.get('location');

  const [reseller] = await db
    .select({ id: schema.resellers.id, status: schema.resellers.status })
    .from(schema.resellers)
    .where(eq(schema.resellers.slug, slug))
    .limit(1);
  if (!reseller || reseller.status !== 'active') return notFound('Reseller not found');

  const where: SQL[] = [
    eq(schema.resellerLocations.resellerId, reseller.id),
    eq(schema.resellerLocations.kind, 'online'),
    eq(schema.inventoryItems.status, 'live'),
  ];
  if (locationSlug) where.push(eq(schema.resellerLocations.slug, locationSlug));

  const items = await db
    .select({ id: schema.inventoryItems.id })
    .from(schema.inventoryItems)
    .innerJoin(
      schema.resellerLocations,
      eq(schema.inventoryItems.resellerLocationId, schema.resellerLocations.id),
    )
    .where(and(...where))
    .orderBy(asc(schema.inventoryItems.id));

  const offers = await assembleOffers(items.map((i) => i.id));
  return NextResponse.json({ data: offers });
}
