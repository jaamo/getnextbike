'use server';

import { schema } from '@getnextbike/db';
import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { recordAudit } from '@/lib/audit';
import { db } from '@/lib/db';

const kinds = schema.resellerLocationKind.enumValues;
const statuses = schema.resellerLocationStatus.enumValues;
const robotsPolicies = schema.robotsPolicy.enumValues;

const optionalText = (max: number) =>
  z
    .string()
    .max(max)
    .or(z.literal(''))
    .transform((v) => (v ? v : null));

const optionalNumeric = z
  .string()
  .or(z.literal(''))
  .transform((v) => (v ? v : null))
  .pipe(
    z
      .string()
      .regex(/^-?\d+(\.\d+)?$/)
      .nullable(),
  );

const baseSchema = z.object({
  slug: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-z0-9][a-z0-9-]*$/, 'lowercase, digits, hyphens'),
  name: z.string().min(1).max(160),
  regionId: z.string().uuid(),
  kind: z.enum(kinds),
  status: z.enum(statuses),
  countryCode: z
    .string()
    .or(z.literal(''))
    .transform((v) => (v ? v.toUpperCase() : null))
    .pipe(
      z
        .string()
        .length(2)
        .regex(/^[A-Z]{2}$/)
        .nullable(),
    ),
  countriesServed: z
    .string()
    .transform((v) =>
      v
        .split(',')
        .map((c) => c.trim().toUpperCase())
        .filter(Boolean),
    )
    .pipe(
      z.array(
        z
          .string()
          .length(2)
          .regex(/^[A-Z]{2}$/),
      ),
    ),
});

const physicalFields = z.object({
  addressLine1: optionalText(200),
  addressLine2: optionalText(200),
  city: optionalText(120),
  postalCode: optionalText(40),
  latitude: optionalNumeric,
  longitude: optionalNumeric,
  phone: optionalText(40),
  email: optionalText(160),
  timezone: optionalText(64),
  openingHoursJson: z
    .string()
    .or(z.literal(''))
    .transform((v, ctx) => {
      if (!v) return null;
      try {
        return JSON.parse(v) as Record<string, unknown>;
      } catch {
        ctx.addIssue({ code: 'custom', message: 'Must be valid JSON' });
        return z.NEVER;
      }
    }),
});

const onlineFields = z.object({
  storefrontUrl: z.string().url(),
  robotsPolicy: z.enum(robotsPolicies).default('respect'),
  crawlRateLimitPerMin: z.coerce.number().int().min(1).max(600).default(10),
  rendersWithJs: z
    .string()
    .or(z.literal(''))
    .transform((v) => v === 'on' || v === 'true'),
});

export type LocationFormState =
  | { error?: string; fieldErrors?: Record<string, string> }
  | undefined;

interface ParsedLocation {
  base: z.infer<typeof baseSchema>;
  physical?: z.infer<typeof physicalFields>;
  online?: z.infer<typeof onlineFields>;
}

function parse(
  formData: FormData,
): { ok: true; value: ParsedLocation } | { ok: false; errors: Record<string, string> } {
  const base = baseSchema.safeParse({
    slug: formData.get('slug'),
    name: formData.get('name'),
    regionId: formData.get('regionId'),
    kind: formData.get('kind'),
    status: formData.get('status') ?? 'active',
    countryCode: formData.get('countryCode') ?? '',
    countriesServed: formData.get('countriesServed') ?? '',
  });
  if (!base.success) return { ok: false, errors: flatten(base) };

  if (base.data.kind === 'physical') {
    const p = physicalFields.safeParse({
      addressLine1: formData.get('addressLine1') ?? '',
      addressLine2: formData.get('addressLine2') ?? '',
      city: formData.get('city') ?? '',
      postalCode: formData.get('postalCode') ?? '',
      latitude: formData.get('latitude') ?? '',
      longitude: formData.get('longitude') ?? '',
      phone: formData.get('phone') ?? '',
      email: formData.get('email') ?? '',
      timezone: formData.get('timezone') ?? '',
      openingHoursJson: formData.get('openingHoursJson') ?? '',
    });
    if (!p.success) return { ok: false, errors: flatten(p) };
    return { ok: true, value: { base: base.data, physical: p.data } };
  }

  const o = onlineFields.safeParse({
    storefrontUrl: formData.get('storefrontUrl'),
    robotsPolicy: formData.get('robotsPolicy') ?? 'respect',
    crawlRateLimitPerMin: formData.get('crawlRateLimitPerMin') ?? 10,
    rendersWithJs: formData.get('rendersWithJs') ?? '',
  });
  if (!o.success) return { ok: false, errors: flatten(o) };
  return { ok: true, value: { base: base.data, online: o.data } };
}

function flatten(parsed: z.SafeParseError<unknown>) {
  const out: Record<string, string> = {};
  for (const i of parsed.error.issues) out[i.path.join('.') || '_'] ??= i.message;
  return out;
}

function rowValues(resellerId: string, parsed: ParsedLocation) {
  const { base, physical, online } = parsed;
  return {
    resellerId,
    slug: base.slug,
    name: base.name,
    regionId: base.regionId,
    kind: base.kind,
    status: base.status,
    countryCode: base.countryCode,
    countriesServed: base.countriesServed,
    addressLine1: physical?.addressLine1 ?? null,
    addressLine2: physical?.addressLine2 ?? null,
    city: physical?.city ?? null,
    postalCode: physical?.postalCode ?? null,
    latitude: physical?.latitude ?? null,
    longitude: physical?.longitude ?? null,
    phone: physical?.phone ?? null,
    email: physical?.email ?? null,
    timezone: physical?.timezone ?? null,
    openingHoursJson: physical?.openingHoursJson ?? null,
    storefrontUrl: online?.storefrontUrl ?? null,
    robotsPolicy: online?.robotsPolicy ?? null,
    crawlRateLimitPerMin: online?.crawlRateLimitPerMin ?? null,
    rendersWithJs: online?.rendersWithJs ?? null,
  };
}

export async function createLocationAction(
  resellerId: string,
  _prev: LocationFormState,
  formData: FormData,
): Promise<LocationFormState> {
  const parsed = parse(formData);
  if (!parsed.ok) return { fieldErrors: parsed.errors };
  try {
    const [row] = await db
      .insert(schema.resellerLocations)
      .values(rowValues(resellerId, parsed.value))
      .returning();
    await recordAudit({
      action: 'reseller_location.create',
      entityKind: 'reseller_location',
      entityId: row?.id,
      after: row,
    });
  } catch (err) {
    return { error: `Insert failed: ${(err as Error).message}` };
  }
  revalidatePath(`/admin/resellers/${resellerId}`);
  redirect(`/admin/resellers/${resellerId}`);
}

export async function updateLocationAction(
  resellerId: string,
  locationId: string,
  _prev: LocationFormState,
  formData: FormData,
): Promise<LocationFormState> {
  const parsed = parse(formData);
  if (!parsed.ok) return { fieldErrors: parsed.errors };
  const [before] = await db
    .select()
    .from(schema.resellerLocations)
    .where(
      and(
        eq(schema.resellerLocations.id, locationId),
        eq(schema.resellerLocations.resellerId, resellerId),
      ),
    )
    .limit(1);
  if (!before) return { error: 'Not found' };
  try {
    const [after] = await db
      .update(schema.resellerLocations)
      .set(rowValues(resellerId, parsed.value))
      .where(eq(schema.resellerLocations.id, locationId))
      .returning();
    await recordAudit({
      action: 'reseller_location.update',
      entityKind: 'reseller_location',
      entityId: locationId,
      before,
      after,
    });
  } catch (err) {
    return { error: `Update failed: ${(err as Error).message}` };
  }
  revalidatePath(`/admin/resellers/${resellerId}`);
  redirect(`/admin/resellers/${resellerId}`);
}

export async function deleteLocationAction(resellerId: string, locationId: string) {
  const [before] = await db
    .select()
    .from(schema.resellerLocations)
    .where(eq(schema.resellerLocations.id, locationId))
    .limit(1);
  if (!before) return;
  await db.delete(schema.resellerLocations).where(eq(schema.resellerLocations.id, locationId));
  await recordAudit({
    action: 'reseller_location.delete',
    entityKind: 'reseller_location',
    entityId: locationId,
    before,
  });
  revalidatePath(`/admin/resellers/${resellerId}`);
  redirect(`/admin/resellers/${resellerId}`);
}
