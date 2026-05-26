import { sql } from 'drizzle-orm';
import {
  boolean,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import { timestamps } from './_shared';
import { regions } from './regions';
import { resellers } from './resellers';

export const resellerLocationKind = pgEnum('reseller_location_kind', ['physical', 'online']);
export const resellerLocationStatus = pgEnum('reseller_location_status', [
  'active',
  'paused',
  'archived',
]);
export const robotsPolicy = pgEnum('robots_policy', ['respect', 'ignore_with_consent']);

export const resellerLocations = pgTable(
  'reseller_locations',
  {
    id: uuid().primaryKey().defaultRandom(),
    resellerId: uuid()
      .notNull()
      .references(() => resellers.id, { onDelete: 'cascade' }),
    slug: text().notNull(),
    kind: resellerLocationKind().notNull(),
    name: text().notNull(),
    regionId: uuid()
      .notNull()
      .references(() => regions.id, { onDelete: 'restrict' }),
    status: resellerLocationStatus().notNull().default('active'),
    countryCode: text(),
    countriesServed: text().array().notNull().default(sql`'{}'::text[]`),

    // Physical-only fields. Null when kind = 'online'.
    addressLine1: text(),
    addressLine2: text(),
    city: text(),
    postalCode: text(),
    latitude: numeric({ precision: 9, scale: 6 }),
    longitude: numeric({ precision: 9, scale: 6 }),
    phone: text(),
    email: text(),
    openingHoursJson: jsonb(),
    timezone: text(),

    // Online-only fields. Null when kind = 'physical'.
    storefrontUrl: text(),
    robotsPolicy: robotsPolicy(),
    crawlRateLimitPerMin: integer().default(10),
    rendersWithJs: boolean().default(false),

    ...timestamps,
  },
  (t) => [unique('reseller_locations_reseller_id_slug_unique').on(t.resellerId, t.slug)],
);

export type ResellerLocation = typeof resellerLocations.$inferSelect;
export type NewResellerLocation = typeof resellerLocations.$inferInsert;
export type ResellerLocationKind = (typeof resellerLocationKind.enumValues)[number];
