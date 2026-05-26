import { schema } from '@getnextbike/db';
import { and, asc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { assembleOffers } from '@/app/api/v1/_offers';
import { notFound } from '@/lib/api';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [location] = await db
    .select({ id: schema.resellerLocations.id, kind: schema.resellerLocations.kind })
    .from(schema.resellerLocations)
    .where(eq(schema.resellerLocations.id, id))
    .limit(1);
  if (!location) return notFound();

  // Physical locations have no inventory of their own — the storefront has it.
  if (location.kind !== 'online') {
    return NextResponse.json({ data: [] });
  }

  const items = await db
    .select({ id: schema.inventoryItems.id })
    .from(schema.inventoryItems)
    .where(
      and(
        eq(schema.inventoryItems.resellerLocationId, id),
        eq(schema.inventoryItems.status, 'live'),
      ),
    )
    .orderBy(asc(schema.inventoryItems.id));

  const offers = await assembleOffers(items.map((i) => i.id));
  return NextResponse.json({ data: offers });
}
