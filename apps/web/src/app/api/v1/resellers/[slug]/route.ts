import { schema } from '@getnextbike/db';
import { asc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { notFound } from '@/lib/api';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [reseller] = await db
    .select({
      id: schema.resellers.id,
      slug: schema.resellers.slug,
      name: schema.resellers.name,
      logoUrl: schema.resellers.logoUrl,
      description: schema.resellers.description,
      primaryWebsiteUrl: schema.resellers.primaryWebsiteUrl,
      status: schema.resellers.status,
    })
    .from(schema.resellers)
    .where(eq(schema.resellers.slug, slug))
    .limit(1);
  if (!reseller || reseller.status !== 'active') return notFound();

  const locations = await db
    .select({
      slug: schema.resellerLocations.slug,
      kind: schema.resellerLocations.kind,
      name: schema.resellerLocations.name,
      regionCode: schema.regions.code,
      countryCode: schema.resellerLocations.countryCode,
      countriesServed: schema.resellerLocations.countriesServed,
      city: schema.resellerLocations.city,
      latitude: schema.resellerLocations.latitude,
      longitude: schema.resellerLocations.longitude,
      storefrontUrl: schema.resellerLocations.storefrontUrl,
    })
    .from(schema.resellerLocations)
    .leftJoin(schema.regions, eq(schema.resellerLocations.regionId, schema.regions.id))
    .where(eq(schema.resellerLocations.resellerId, reseller.id))
    .orderBy(asc(schema.resellerLocations.kind), asc(schema.resellerLocations.name));

  return NextResponse.json({ data: { ...reseller, locations } });
}
