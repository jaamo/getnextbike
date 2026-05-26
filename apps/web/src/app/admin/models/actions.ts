'use server';

import { schema } from '@getnextbike/db';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { recordAudit } from '@/lib/audit';
import { db } from '@/lib/db';

const categories = schema.modelCategory.enumValues;

const modelSchema = z.object({
  brandId: z.string().uuid(),
  slug: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-z0-9][a-z0-9-]*$/, 'lowercase, digits and hyphens'),
  name: z.string().min(1).max(160),
  category: z.enum(categories),
  disciplineTags: z
    .string()
    .transform((v) =>
      v
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    )
    .pipe(z.array(z.string().min(1).max(40))),
  description: z
    .string()
    .max(4000)
    .or(z.literal(''))
    .transform((v) => (v ? v : null)),
});

export type ModelFormState = { error?: string; fieldErrors?: Record<string, string> } | undefined;

function parse(formData: FormData) {
  return modelSchema.safeParse({
    brandId: formData.get('brandId'),
    slug: formData.get('slug'),
    name: formData.get('name'),
    category: formData.get('category'),
    disciplineTags: formData.get('disciplineTags') ?? '',
    description: formData.get('description') ?? '',
  });
}

function flatten(parsed: z.SafeParseError<unknown>) {
  const out: Record<string, string> = {};
  for (const i of parsed.error.issues) out[i.path.join('.') || '_'] ??= i.message;
  return out;
}

export async function createModelAction(
  _prev: ModelFormState,
  formData: FormData,
): Promise<ModelFormState> {
  const parsed = parse(formData);
  if (!parsed.success) return { fieldErrors: flatten(parsed) };
  try {
    const [row] = await db.insert(schema.models).values(parsed.data).returning();
    await recordAudit({
      action: 'model.create',
      entityKind: 'model',
      entityId: row?.id,
      after: row,
    });
  } catch (err) {
    return { error: `Insert failed: ${(err as Error).message}` };
  }
  revalidatePath('/admin/models');
  redirect('/admin/models');
}

export async function updateModelAction(
  id: string,
  _prev: ModelFormState,
  formData: FormData,
): Promise<ModelFormState> {
  const parsed = parse(formData);
  if (!parsed.success) return { fieldErrors: flatten(parsed) };
  const [before] = await db.select().from(schema.models).where(eq(schema.models.id, id)).limit(1);
  if (!before) return { error: 'Not found' };
  try {
    const [after] = await db
      .update(schema.models)
      .set(parsed.data)
      .where(eq(schema.models.id, id))
      .returning();
    await recordAudit({
      action: 'model.update',
      entityKind: 'model',
      entityId: id,
      before,
      after,
    });
  } catch (err) {
    return { error: `Update failed: ${(err as Error).message}` };
  }
  revalidatePath('/admin/models');
  redirect('/admin/models');
}

export async function deleteModelAction(id: string) {
  const [before] = await db.select().from(schema.models).where(eq(schema.models.id, id)).limit(1);
  if (!before) return;
  await db.delete(schema.models).where(eq(schema.models.id, id));
  await recordAudit({ action: 'model.delete', entityKind: 'model', entityId: id, before });
  revalidatePath('/admin/models');
}
