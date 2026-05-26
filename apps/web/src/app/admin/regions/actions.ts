'use server';

import { schema } from '@getnextbike/db';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { recordAudit } from '@/lib/audit';
import { db } from '@/lib/db';

const regionSchema = z.object({
  code: z
    .string()
    .min(2)
    .max(16)
    .regex(/^[A-Z][A-Z0-9_]*$/, 'uppercase letters, digits, underscores'),
  name: z.string().min(1).max(120),
  defaultCurrency: z
    .string()
    .length(3)
    .regex(/^[A-Z]{3}$/, 'ISO 4217 code'),
  countries: z
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

export type RegionFormState = { error?: string; fieldErrors?: Record<string, string> } | undefined;

function parse(formData: FormData) {
  return regionSchema.safeParse({
    code: formData.get('code'),
    name: formData.get('name'),
    defaultCurrency: formData.get('defaultCurrency'),
    countries: formData.get('countries') ?? '',
  });
}

function flatten(parsed: z.SafeParseError<unknown>) {
  const out: Record<string, string> = {};
  for (const i of parsed.error.issues) out[i.path.join('.') || '_'] ??= i.message;
  return out;
}

export async function createRegionAction(
  _prev: RegionFormState,
  formData: FormData,
): Promise<RegionFormState> {
  const parsed = parse(formData);
  if (!parsed.success) return { fieldErrors: flatten(parsed) };
  try {
    const [row] = await db.insert(schema.regions).values(parsed.data).returning();
    await recordAudit({
      action: 'region.create',
      entityKind: 'region',
      entityId: row?.id,
      after: row,
    });
  } catch (err) {
    return { error: `Insert failed: ${(err as Error).message}` };
  }
  revalidatePath('/admin/regions');
  redirect('/admin/regions');
}

export async function updateRegionAction(
  id: string,
  _prev: RegionFormState,
  formData: FormData,
): Promise<RegionFormState> {
  const parsed = parse(formData);
  if (!parsed.success) return { fieldErrors: flatten(parsed) };
  const [before] = await db.select().from(schema.regions).where(eq(schema.regions.id, id)).limit(1);
  if (!before) return { error: 'Not found' };
  try {
    const [after] = await db
      .update(schema.regions)
      .set(parsed.data)
      .where(eq(schema.regions.id, id))
      .returning();
    await recordAudit({
      action: 'region.update',
      entityKind: 'region',
      entityId: id,
      before,
      after,
    });
  } catch (err) {
    return { error: `Update failed: ${(err as Error).message}` };
  }
  revalidatePath('/admin/regions');
  redirect('/admin/regions');
}

export async function deleteRegionAction(id: string) {
  const [before] = await db.select().from(schema.regions).where(eq(schema.regions.id, id)).limit(1);
  if (!before) return;
  await db.delete(schema.regions).where(eq(schema.regions.id, id));
  await recordAudit({ action: 'region.delete', entityKind: 'region', entityId: id, before });
  revalidatePath('/admin/regions');
}
