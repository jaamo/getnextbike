import { schema } from '@getnextbike/db';
import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { notFound } from '@/lib/api';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string; locationSlug: string }> },
) {
  const { slug, locationSlug } = await params;
  const [reseller] = await db
    .select({ id: schema.resellers.id, status: schema.resellers.status })
    .from(schema.resellers)
    .where(eq(schema.resellers.slug, slug))
    .limit(1);
  if (!reseller || reseller.status !== 'active') return notFound();

  const [row] = await db
    .select({
      slug: schema.resellerLocations.slug,
      kind: schema.resellerLocations.kind,
      name: schema.resellerLocations.name,
      regionCode: schema.regions.code,
      countryCode: schema.resellerLocations.countryCode,
      countriesServed: schema.resellerLocations.countriesServed,
      addressLine1: schema.resellerLocations.addressLine1,
      city: schema.resellerLocations.city,
      postalCode: schema.resellerLocations.postalCode,
      latitude: schema.resellerLocations.latitude,
      longitude: schema.resellerLocations.longitude,
      phone: schema.resellerLocations.phone,
      email: schema.resellerLocations.email,
      timezone: schema.resellerLocations.timezone,
      openingHoursJson: schema.resellerLocations.openingHoursJson,
      storefrontUrl: schema.resellerLocations.storefrontUrl,
    })
    .from(schema.resellerLocations)
    .leftJoin(schema.regions, eq(schema.resellerLocations.regionId, schema.regions.id))
    .where(
      and(
        eq(schema.resellerLocations.resellerId, reseller.id),
        eq(schema.resellerLocations.slug, locationSlug),
      ),
    )
    .limit(1);

  if (!row) return notFound();
  return NextResponse.json({ data: row });
}
