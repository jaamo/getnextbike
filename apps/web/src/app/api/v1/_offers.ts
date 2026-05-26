// Shared assembler for the spec §4.2 offers shape: one row per online
// inventory item, with an `availability` array covering its own online
// location plus any physical stores the storefront reports stock for.
//
// Inputs:
//   - inventoryItemIds: items to assemble
//
// We hit the DB three times:
//   1. inventory_items joined with reseller + online location
//   2. latest price_observation per item (DISTINCT ON)
//   3. current_stock view rows (already latest per item+location), enriched
//      with reseller_locations data.

import { schema } from '@getnextbike/db';
import { eq, inArray, type SQL, sql } from 'drizzle-orm';
import { db } from '@/lib/db';

export interface OfferAvailabilityEntry {
  location: {
    slug: string;
    kind: 'online' | 'physical';
    name: string;
    storefrontUrl?: string | null;
    countriesServed?: string[];
    city?: string | null;
    country?: string | null;
    lat?: string | null;
    lng?: string | null;
  };
  stock: { status: string; quantity: number | null };
  lastCheckedAt: string | null;
}

export interface Offer {
  inventoryItemId: string;
  reseller: { slug: string; name: string };
  productUrl: string;
  price: { amount: string; currency: string; originalAmount: string | null } | null;
  availability: OfferAvailabilityEntry[];
}

export async function assembleOffers(itemIds: string[]): Promise<Offer[]> {
  if (itemIds.length === 0) return [];

  // 1. Items + reseller + online location
  const items = await db
    .select({
      itemId: schema.inventoryItems.id,
      productUrl: schema.inventoryItems.productUrl,
      onlineLocationSlug: schema.resellerLocations.slug,
      onlineLocationName: schema.resellerLocations.name,
      storefrontUrl: schema.resellerLocations.storefrontUrl,
      onlineCountriesServed: schema.resellerLocations.countriesServed,
      resellerId: schema.resellers.id,
      resellerSlug: schema.resellers.slug,
      resellerName: schema.resellers.name,
    })
    .from(schema.inventoryItems)
    .innerJoin(
      schema.resellerLocations,
      eq(schema.inventoryItems.resellerLocationId, schema.resellerLocations.id),
    )
    .innerJoin(schema.resellers, eq(schema.resellerLocations.resellerId, schema.resellers.id))
    .where(inArray(schema.inventoryItems.id, itemIds));

  if (items.length === 0) return [];

  // 2. Latest price per item via DISTINCT ON
  const priceRows = await db.execute<{
    inventory_item_id: string;
    amount: string;
    currency: string;
    original_amount: string | null;
    captured_at: Date | string;
  }>(sql`
    SELECT DISTINCT ON (inventory_item_id)
      inventory_item_id, amount, currency, original_amount, captured_at
    FROM price_observations
    WHERE inventory_item_id IN (${sql.join(
      itemIds.map((id) => sql`${id}::uuid`),
      sql`, `,
    )})
    ORDER BY inventory_item_id, captured_at DESC
  `);
  const priceByItem = new Map(priceRows.map((r) => [r.inventory_item_id, r]));

  // 3. Current stock rows from the view, joined with location data
  const stockRows = await db.execute<{
    inventory_item_id: string;
    status: string;
    quantity: number | null;
    captured_at: Date | string;
    location_slug: string;
    location_kind: 'online' | 'physical';
    location_name: string;
    location_storefront_url: string | null;
    location_city: string | null;
    location_country: string | null;
    location_latitude: string | null;
    location_longitude: string | null;
    location_countries_served: string[] | null;
  }>(sql`
    SELECT
      cs.inventory_item_id,
      cs.status::text AS status,
      cs.quantity,
      cs.captured_at,
      rl.slug AS location_slug,
      rl.kind::text AS location_kind,
      rl.name AS location_name,
      rl.storefront_url AS location_storefront_url,
      rl.city AS location_city,
      rl.country_code AS location_country,
      rl.latitude AS location_latitude,
      rl.longitude AS location_longitude,
      rl.countries_served AS location_countries_served
    FROM current_stock cs
    JOIN reseller_locations rl ON rl.id = cs.reseller_location_id
    WHERE cs.inventory_item_id IN (${sql.join(
      itemIds.map((id) => sql`${id}::uuid`),
      sql`, `,
    )})
  `);

  const stockByItem = new Map<string, OfferAvailabilityEntry[]>();
  for (const r of stockRows) {
    const entry: OfferAvailabilityEntry = {
      location: {
        slug: r.location_slug,
        kind: r.location_kind,
        name: r.location_name,
        storefrontUrl: r.location_storefront_url,
        countriesServed: r.location_countries_served ?? undefined,
        city: r.location_city,
        country: r.location_country,
        lat: r.location_latitude,
        lng: r.location_longitude,
      },
      stock: { status: r.status, quantity: r.quantity },
      // `db.execute(sql\`…\`)` bypasses drizzle's column mapper, so
      // captured_at can come back as a Date OR a string depending on the
      // postgres-js parser config. Normalize either way.
      lastCheckedAt: toIso(r.captured_at),
    };
    const list = stockByItem.get(r.inventory_item_id) ?? [];
    list.push(entry);
    stockByItem.set(r.inventory_item_id, list);
  }

  return items.map((it): Offer => {
    const price = priceByItem.get(it.itemId);
    // Fallback when no stock_observations exist yet: show the online location
    // with unknown status so the offer is still useful.
    const fallback: OfferAvailabilityEntry[] = [
      {
        location: {
          slug: it.onlineLocationSlug,
          kind: 'online',
          name: it.onlineLocationName,
          storefrontUrl: it.storefrontUrl,
          countriesServed: it.onlineCountriesServed,
        },
        stock: { status: 'unknown', quantity: null },
        lastCheckedAt: null,
      },
    ];
    return {
      inventoryItemId: it.itemId,
      reseller: { slug: it.resellerSlug, name: it.resellerName },
      productUrl: it.productUrl,
      price: price
        ? {
            amount: price.amount,
            currency: price.currency,
            originalAmount: price.original_amount,
          }
        : null,
      availability: stockByItem.get(it.itemId) ?? fallback,
    };
  });
}

export type { SQL };

function toIso(v: Date | string | null | undefined): string | null {
  if (v == null) return null;
  if (v instanceof Date) return v.toISOString();
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
