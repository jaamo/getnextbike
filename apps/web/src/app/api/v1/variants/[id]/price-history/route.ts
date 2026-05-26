import { schema } from '@getnextbike/db';
import { and, asc, eq, gte, lte, type SQL } from 'drizzle-orm';
import { type NextRequest, NextResponse } from 'next/server';
import { badRequest, notFound } from '@/lib/api';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sp = req.nextUrl.searchParams;
  const reseller = sp.get('reseller');
  const location = sp.get('location');
  const from = sp.get('from');
  const to = sp.get('to');

  const [variant] = await db
    .select({ id: schema.modelVariants.id })
    .from(schema.modelVariants)
    .where(eq(schema.modelVariants.id, id))
    .limit(1);
  if (!variant) return notFound();

  let fromDate: Date | undefined;
  let toDate: Date | undefined;
  if (from) {
    const d = new Date(from);
    if (Number.isNaN(d.getTime())) return badRequest('from must be ISO 8601');
    fromDate = d;
  }
  if (to) {
    const d = new Date(to);
    if (Number.isNaN(d.getTime())) return badRequest('to must be ISO 8601');
    toDate = d;
  }

  const where: SQL[] = [eq(schema.inventoryItems.variantId, id)];
  if (reseller) where.push(eq(schema.resellers.slug, reseller));
  if (location) where.push(eq(schema.resellerLocations.slug, location));
  if (fromDate) where.push(gte(schema.priceObservations.capturedAt, fromDate));
  if (toDate) where.push(lte(schema.priceObservations.capturedAt, toDate));

  const rows = await db
    .select({
      capturedAt: schema.priceObservations.capturedAt,
      amount: schema.priceObservations.amount,
      currency: schema.priceObservations.currency,
      originalAmount: schema.priceObservations.originalAmount,
      reseller: { slug: schema.resellers.slug, name: schema.resellers.name },
      location: {
        slug: schema.resellerLocations.slug,
        name: schema.resellerLocations.name,
      },
    })
    .from(schema.priceObservations)
    .innerJoin(
      schema.inventoryItems,
      eq(schema.priceObservations.inventoryItemId, schema.inventoryItems.id),
    )
    .innerJoin(
      schema.resellerLocations,
      eq(schema.inventoryItems.resellerLocationId, schema.resellerLocations.id),
    )
    .innerJoin(schema.resellers, eq(schema.resellerLocations.resellerId, schema.resellers.id))
    .where(and(...where))
    .orderBy(asc(schema.priceObservations.capturedAt))
    .limit(2000);

  return NextResponse.json({ data: rows });
}
