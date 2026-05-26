'use server';

import { schema } from '@getnextbike/db';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { recordAudit } from '@/lib/audit';
import { db } from '@/lib/db';

const brandSchema = z.object({
  slug: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-z0-9][a-z0-9-]*$/, 'lowercase, digits and hyphens only'),
  name: z.string().min(1).max(120),
  countryCode: z
    .string()
    .length(2)
    .regex(/^[A-Z]{2}$/)
    .or(z.literal(''))
    .transform((v) => (v ? v : null)),
  websiteUrl: z
    .string()
    .url()
    .or(z.literal(''))
    .transform((v) => (v ? v : null)),
  description: z
    .string()
    .max(2000)
    .or(z.literal(''))
    .transform((v) => (v ? v : null)),
});

export type BrandFormState = { error?: string; fieldErrors?: Record<string, string> } | undefined;

function parseForm(formData: FormData) {
  return brandSchema.safeParse({
    slug: formData.get('slug'),
    name: formData.get('name'),
    countryCode: formData.get('countryCode'),
    websiteUrl: formData.get('websiteUrl'),
    description: formData.get('description'),
  });
}

function flattenErrors(parsed: z.SafeParseError<unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of parsed.error.issues) {
    const k = issue.path.join('.') || '_';
    if (!out[k]) out[k] = issue.message;
  }
  return out;
}

export async function createBrandAction(
  _prev: BrandFormState,
  formData: FormData,
): Promise<BrandFormState> {
  const parsed = parseForm(formData);
  if (!parsed.success) return { fieldErrors: flattenErrors(parsed) };

  let inserted: typeof schema.brands.$inferSelect | undefined;
  try {
    const [row] = await db.insert(schema.brands).values(parsed.data).returning();
    inserted = row;
  } catch (err) {
    return { error: `Insert failed: ${(err as Error).message}` };
  }
  if (!inserted) return { error: 'Insert returned no rows' };

  await recordAudit({
    action: 'brand.create',
    entityKind: 'brand',
    entityId: inserted.id,
    after: inserted,
  });
  revalidatePath('/admin/brands');
  redirect('/admin/brands');
}

export async function updateBrandAction(
  id: string,
  _prev: BrandFormState,
  formData: FormData,
): Promise<BrandFormState> {
  const parsed = parseForm(formData);
  if (!parsed.success) return { fieldErrors: flattenErrors(parsed) };

  const [before] = await db.select().from(schema.brands).where(eq(schema.brands.id, id)).limit(1);
  if (!before) return { error: 'Not found' };

  let after: typeof schema.brands.$inferSelect | undefined;
  try {
    const [row] = await db
      .update(schema.brands)
      .set(parsed.data)
      .where(eq(schema.brands.id, id))
      .returning();
    after = row;
  } catch (err) {
    return { error: `Update failed: ${(err as Error).message}` };
  }

  await recordAudit({
    action: 'brand.update',
    entityKind: 'brand',
    entityId: id,
    before,
    after: after as never,
  });
  revalidatePath('/admin/brands');
  revalidatePath(`/admin/brands/${id}`);
  redirect('/admin/brands');
}

export async function deleteBrandAction(id: string) {
  const [before] = await db.select().from(schema.brands).where(eq(schema.brands.id, id)).limit(1);
  if (!before) return;
  await db.delete(schema.brands).where(eq(schema.brands.id, id));
  await recordAudit({
    action: 'brand.delete',
    entityKind: 'brand',
    entityId: id,
    before,
  });
  revalidatePath('/admin/brands');
}
