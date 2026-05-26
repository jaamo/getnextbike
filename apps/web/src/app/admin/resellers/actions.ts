'use server';

import { schema } from '@getnextbike/db';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { recordAudit } from '@/lib/audit';
import { db } from '@/lib/db';

const statuses = schema.resellerStatus.enumValues;

const resellerSchema = z.object({
  slug: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-z0-9][a-z0-9-]*$/, 'lowercase, digits, hyphens'),
  name: z.string().min(1).max(160),
  logoUrl: z
    .string()
    .url()
    .or(z.literal(''))
    .transform((v) => (v ? v : null)),
  description: z
    .string()
    .max(4000)
    .or(z.literal(''))
    .transform((v) => (v ? v : null)),
  primaryWebsiteUrl: z
    .string()
    .url()
    .or(z.literal(''))
    .transform((v) => (v ? v : null)),
  status: z.enum(statuses),
});

export type ResellerFormState =
  | { error?: string; fieldErrors?: Record<string, string> }
  | undefined;

function parse(formData: FormData) {
  return resellerSchema.safeParse({
    slug: formData.get('slug'),
    name: formData.get('name'),
    logoUrl: formData.get('logoUrl') ?? '',
    description: formData.get('description') ?? '',
    primaryWebsiteUrl: formData.get('primaryWebsiteUrl') ?? '',
    status: formData.get('status') ?? 'active',
  });
}

function flatten(parsed: z.SafeParseError<unknown>) {
  const out: Record<string, string> = {};
  for (const i of parsed.error.issues) out[i.path.join('.') || '_'] ??= i.message;
  return out;
}

export async function createResellerAction(
  _prev: ResellerFormState,
  formData: FormData,
): Promise<ResellerFormState> {
  const parsed = parse(formData);
  if (!parsed.success) return { fieldErrors: flatten(parsed) };
  let createdId: string | undefined;
  try {
    const [row] = await db.insert(schema.resellers).values(parsed.data).returning();
    createdId = row?.id;
    await recordAudit({
      action: 'reseller.create',
      entityKind: 'reseller',
      entityId: row?.id,
      after: row,
    });
  } catch (err) {
    return { error: `Insert failed: ${(err as Error).message}` };
  }
  revalidatePath('/admin/resellers');
  redirect(createdId ? `/admin/resellers/${createdId}` : '/admin/resellers');
}

export async function updateResellerAction(
  id: string,
  _prev: ResellerFormState,
  formData: FormData,
): Promise<ResellerFormState> {
  const parsed = parse(formData);
  if (!parsed.success) return { fieldErrors: flatten(parsed) };
  const [before] = await db
    .select()
    .from(schema.resellers)
    .where(eq(schema.resellers.id, id))
    .limit(1);
  if (!before) return { error: 'Not found' };
  try {
    const [after] = await db
      .update(schema.resellers)
      .set(parsed.data)
      .where(eq(schema.resellers.id, id))
      .returning();
    await recordAudit({
      action: 'reseller.update',
      entityKind: 'reseller',
      entityId: id,
      before,
      after,
    });
  } catch (err) {
    return { error: `Update failed: ${(err as Error).message}` };
  }
  revalidatePath('/admin/resellers');
  revalidatePath(`/admin/resellers/${id}`);
  redirect(`/admin/resellers/${id}`);
}

export async function deleteResellerAction(id: string) {
  const [before] = await db
    .select()
    .from(schema.resellers)
    .where(eq(schema.resellers.id, id))
    .limit(1);
  if (!before) return;
  await db.delete(schema.resellers).where(eq(schema.resellers.id, id));
  await recordAudit({
    action: 'reseller.delete',
    entityKind: 'reseller',
    entityId: id,
    before,
  });
  revalidatePath('/admin/resellers');
  redirect('/admin/resellers');
}
