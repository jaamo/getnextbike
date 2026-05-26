import { schema } from '@getnextbike/db';
import { and, asc, eq, type SQL } from 'drizzle-orm';
import type { NextRequest } from 'next/server';
import { listResponse, notFound } from '@/lib/api';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const KINDS = schema.resellerLocationKind.enumValues;

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [reseller] = await db
    .select({ id: schema.resellers.id, status: schema.resellers.status })
    .from(schema.resellers)
    .where(eq(schema.resellers.slug, slug))
    .limit(1);
  if (!reseller || reseller.status !== 'active') return notFound('Reseller not found');

  const sp = req.nextUrl.searchParams;
  const kind = sp.get('kind');
  const region = sp.get('region');

  const where: SQL[] = [eq(schema.resellerLocations.resellerId, reseller.id)];
  if (kind && (KINDS as readonly string[]).includes(kind)) {
    where.push(eq(schema.resellerLocations.kind, kind as (typeof KINDS)[number]));
  }
  if (region) where.push(eq(schema.regions.code, region.toUpperCase()));

  const rows = await db
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
    .where(and(...where))
    .orderBy(asc(schema.resellerLocations.kind), asc(schema.resellerLocations.name));

  return listResponse(rows, null);
}
