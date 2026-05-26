'use server';

import { schema } from '@getnextbike/db';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { recordAudit } from '@/lib/audit';
import { db } from '@/lib/db';

const types = schema.componentType.enumValues;

const componentSchema = z.object({
  type: z.enum(types),
  manufacturer: z
    .string()
    .max(120)
    .or(z.literal(''))
    .transform((v) => (v ? v : null)),
  name: z.string().min(1).max(200),
  tier: z
    .string()
    .max(80)
    .or(z.literal(''))
    .transform((v) => (v ? v : null)),
  specJson: z
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

export type ComponentFormState =
  | { error?: string; fieldErrors?: Record<string, string> }
  | undefined;

function parse(formData: FormData) {
  return componentSchema.safeParse({
    type: formData.get('type'),
    manufacturer: formData.get('manufacturer') ?? '',
    name: formData.get('name'),
    tier: formData.get('tier') ?? '',
    specJson: formData.get('specJson') ?? '',
  });
}

function flatten(parsed: z.SafeParseError<unknown>) {
  const out: Record<string, string> = {};
  for (const i of parsed.error.issues) out[i.path.join('.') || '_'] ??= i.message;
  return out;
}

export async function createComponentAction(
  _prev: ComponentFormState,
  formData: FormData,
): Promise<ComponentFormState> {
  const parsed = parse(formData);
  if (!parsed.success) return { fieldErrors: flatten(parsed) };
  try {
    const [row] = await db
      .insert(schema.components)
      .values(parsed.data as never)
      .returning();
    await recordAudit({
      action: 'component.create',
      entityKind: 'component',
      entityId: row?.id,
      after: row,
    });
  } catch (err) {
    return { error: `Insert failed: ${(err as Error).message}` };
  }
  revalidatePath('/admin/components');
  redirect('/admin/components');
}

export async function updateComponentAction(
  id: string,
  _prev: ComponentFormState,
  formData: FormData,
): Promise<ComponentFormState> {
  const parsed = parse(formData);
  if (!parsed.success) return { fieldErrors: flatten(parsed) };
  const [before] = await db
    .select()
    .from(schema.components)
    .where(eq(schema.components.id, id))
    .limit(1);
  if (!before) return { error: 'Not found' };
  try {
    const [after] = await db
      .update(schema.components)
      .set(parsed.data as never)
      .where(eq(schema.components.id, id))
      .returning();
    await recordAudit({
      action: 'component.update',
      entityKind: 'component',
      entityId: id,
      before,
      after,
    });
  } catch (err) {
    return { error: `Update failed: ${(err as Error).message}` };
  }
  revalidatePath('/admin/components');
  redirect('/admin/components');
}

export async function deleteComponentAction(id: string) {
  const [before] = await db
    .select()
    .from(schema.components)
    .where(eq(schema.components.id, id))
    .limit(1);
  if (!before) return;
  await db.delete(schema.components).where(eq(schema.components.id, id));
  await recordAudit({
    action: 'component.delete',
    entityKind: 'component',
    entityId: id,
    before,
  });
  revalidatePath('/admin/components');
}
