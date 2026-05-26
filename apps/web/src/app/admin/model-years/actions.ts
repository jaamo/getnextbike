'use server';

import { schema } from '@getnextbike/db';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { recordAudit } from '@/lib/audit';
import { db } from '@/lib/db';

const yearSchema = z.object({
  modelId: z.string().uuid(),
  year: z.coerce.number().int().min(1980).max(2100),
  msrpAmount: z
    .string()
    .or(z.literal(''))
    .transform((v) => (v ? v : null))
    .pipe(
      z
        .string()
        .regex(/^\d+(\.\d{1,2})?$/, 'decimal with up to 2 places')
        .nullable(),
    ),
  msrpCurrency: z
    .string()
    .or(z.literal(''))
    .transform((v) => (v ? v.toUpperCase() : null))
    .pipe(
      z
        .string()
        .length(3)
        .regex(/^[A-Z]{3}$/)
        .nullable(),
    ),
  heroImageUrl: z
    .string()
    .url()
    .or(z.literal(''))
    .transform((v) => (v ? v : null)),
  specSheetUrl: z
    .string()
    .url()
    .or(z.literal(''))
    .transform((v) => (v ? v : null)),
});

export type ModelYearFormState =
  | { error?: string; fieldErrors?: Record<string, string> }
  | undefined;

function parse(formData: FormData) {
  return yearSchema.safeParse({
    modelId: formData.get('modelId'),
    year: formData.get('year'),
    msrpAmount: formData.get('msrpAmount') ?? '',
    msrpCurrency: formData.get('msrpCurrency') ?? '',
    heroImageUrl: formData.get('heroImageUrl') ?? '',
    specSheetUrl: formData.get('specSheetUrl') ?? '',
  });
}

function flatten(parsed: z.SafeParseError<unknown>) {
  const out: Record<string, string> = {};
  for (const i of parsed.error.issues) out[i.path.join('.') || '_'] ??= i.message;
  return out;
}

export async function createModelYearAction(
  _prev: ModelYearFormState,
  formData: FormData,
): Promise<ModelYearFormState> {
  const parsed = parse(formData);
  if (!parsed.success) return { fieldErrors: flatten(parsed) };
  try {
    const [row] = await db.insert(schema.modelYears).values(parsed.data).returning();
    await recordAudit({
      action: 'model_year.create',
      entityKind: 'model_year',
      entityId: row?.id,
      after: row,
    });
  } catch (err) {
    return { error: `Insert failed: ${(err as Error).message}` };
  }
  revalidatePath('/admin/model-years');
  redirect('/admin/model-years');
}

export async function updateModelYearAction(
  id: string,
  _prev: ModelYearFormState,
  formData: FormData,
): Promise<ModelYearFormState> {
  const parsed = parse(formData);
  if (!parsed.success) return { fieldErrors: flatten(parsed) };
  const [before] = await db
    .select()
    .from(schema.modelYears)
    .where(eq(schema.modelYears.id, id))
    .limit(1);
  if (!before) return { error: 'Not found' };
  try {
    const [after] = await db
      .update(schema.modelYears)
      .set(parsed.data)
      .where(eq(schema.modelYears.id, id))
      .returning();
    await recordAudit({
      action: 'model_year.update',
      entityKind: 'model_year',
      entityId: id,
      before,
      after,
    });
  } catch (err) {
    return { error: `Update failed: ${(err as Error).message}` };
  }
  revalidatePath('/admin/model-years');
  redirect('/admin/model-years');
}

export async function deleteModelYearAction(id: string) {
  const [before] = await db
    .select()
    .from(schema.modelYears)
    .where(eq(schema.modelYears.id, id))
    .limit(1);
  if (!before) return;
  await db.delete(schema.modelYears).where(eq(schema.modelYears.id, id));
  await recordAudit({
    action: 'model_year.delete',
    entityKind: 'model_year',
    entityId: id,
    before,
  });
  revalidatePath('/admin/model-years');
}
