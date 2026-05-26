'use server';

import { schema } from '@getnextbike/db';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { recordAudit } from '@/lib/audit';
import { db } from '@/lib/db';

import { NONE_REGION_VALUE as NONE } from './constants';

const variantSchema = z.object({
  modelYearId: z.string().uuid(),
  regionId: z
    .string()
    .transform((v) => (v === NONE || v === '' ? null : v))
    .pipe(z.string().uuid().nullable()),
  sku: z
    .string()
    .max(120)
    .or(z.literal(''))
    .transform((v) => (v ? v : null)),
  buildName: z
    .string()
    .max(120)
    .or(z.literal(''))
    .transform((v) => (v ? v : null)),
  frameSize: z
    .string()
    .max(40)
    .or(z.literal(''))
    .transform((v) => (v ? v : null)),
  color: z
    .string()
    .max(80)
    .or(z.literal(''))
    .transform((v) => (v ? v : null)),
  weightGrams: z
    .string()
    .or(z.literal(''))
    .transform((v) => (v ? Number(v) : null))
    .pipe(z.number().int().min(1000).max(80_000).nullable()),
  notes: z
    .string()
    .max(2000)
    .or(z.literal(''))
    .transform((v) => (v ? v : null)),
});

export type VariantFormState = { error?: string; fieldErrors?: Record<string, string> } | undefined;

function parse(formData: FormData) {
  return variantSchema.safeParse({
    modelYearId: formData.get('modelYearId'),
    regionId: formData.get('regionId') ?? NONE,
    sku: formData.get('sku') ?? '',
    buildName: formData.get('buildName') ?? '',
    frameSize: formData.get('frameSize') ?? '',
    color: formData.get('color') ?? '',
    weightGrams: formData.get('weightGrams') ?? '',
    notes: formData.get('notes') ?? '',
  });
}

function flatten(parsed: z.SafeParseError<unknown>) {
  const out: Record<string, string> = {};
  for (const i of parsed.error.issues) out[i.path.join('.') || '_'] ??= i.message;
  return out;
}

export async function createVariantAction(
  _prev: VariantFormState,
  formData: FormData,
): Promise<VariantFormState> {
  const parsed = parse(formData);
  if (!parsed.success) return { fieldErrors: flatten(parsed) };
  try {
    const [row] = await db.insert(schema.modelVariants).values(parsed.data).returning();
    await recordAudit({
      action: 'model_variant.create',
      entityKind: 'model_variant',
      entityId: row?.id,
      after: row,
    });
  } catch (err) {
    return { error: `Insert failed: ${(err as Error).message}` };
  }
  revalidatePath('/admin/model-variants');
  redirect('/admin/model-variants');
}

export async function updateVariantAction(
  id: string,
  _prev: VariantFormState,
  formData: FormData,
): Promise<VariantFormState> {
  const parsed = parse(formData);
  if (!parsed.success) return { fieldErrors: flatten(parsed) };
  const [before] = await db
    .select()
    .from(schema.modelVariants)
    .where(eq(schema.modelVariants.id, id))
    .limit(1);
  if (!before) return { error: 'Not found' };
  try {
    const [after] = await db
      .update(schema.modelVariants)
      .set(parsed.data)
      .where(eq(schema.modelVariants.id, id))
      .returning();
    await recordAudit({
      action: 'model_variant.update',
      entityKind: 'model_variant',
      entityId: id,
      before,
      after,
    });
  } catch (err) {
    return { error: `Update failed: ${(err as Error).message}` };
  }
  revalidatePath('/admin/model-variants');
  redirect('/admin/model-variants');
}

export async function deleteVariantAction(id: string) {
  const [before] = await db
    .select()
    .from(schema.modelVariants)
    .where(eq(schema.modelVariants.id, id))
    .limit(1);
  if (!before) return;
  await db.delete(schema.modelVariants).where(eq(schema.modelVariants.id, id));
  await recordAudit({
    action: 'model_variant.delete',
    entityKind: 'model_variant',
    entityId: id,
    before,
  });
  revalidatePath('/admin/model-variants');
}
