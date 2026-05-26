'use server';

import { schema } from '@getnextbike/db';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { recordAudit } from '@/lib/audit';
import { db } from '@/lib/db';
import { NONE_VARIANT_VALUE as NONE } from './constants';

const statuses = schema.inventoryItemStatus.enumValues;

const createSchema = z.object({
  resellerLocationId: z.string().uuid(),
  productUrl: z.string().url(),
  resellerSku: z
    .string()
    .max(160)
    .or(z.literal(''))
    .transform((v) => (v ? v : null)),
  titleAtSource: z
    .string()
    .max(400)
    .or(z.literal(''))
    .transform((v) => (v ? v : null)),
});

const updateSchema = z.object({
  variantId: z
    .string()
    .transform((v) => (v === NONE || v === '' ? null : v))
    .pipe(z.string().uuid().nullable()),
  status: z.enum(statuses),
  resellerSku: z
    .string()
    .max(160)
    .or(z.literal(''))
    .transform((v) => (v ? v : null)),
  titleAtSource: z
    .string()
    .max(400)
    .or(z.literal(''))
    .transform((v) => (v ? v : null)),
});

export type InventoryCreateState =
  | { error?: string; fieldErrors?: Record<string, string> }
  | undefined;
export type InventoryUpdateState =
  | { error?: string; fieldErrors?: Record<string, string> }
  | undefined;

function flatten(parsed: z.SafeParseError<unknown>) {
  const out: Record<string, string> = {};
  for (const i of parsed.error.issues) out[i.path.join('.') || '_'] ??= i.message;
  return out;
}

export async function createInventoryAction(
  _prev: InventoryCreateState,
  formData: FormData,
): Promise<InventoryCreateState> {
  const parsed = createSchema.safeParse({
    resellerLocationId: formData.get('resellerLocationId'),
    productUrl: formData.get('productUrl'),
    resellerSku: formData.get('resellerSku') ?? '',
    titleAtSource: formData.get('titleAtSource') ?? '',
  });
  if (!parsed.success) return { fieldErrors: flatten(parsed) };
  let createdId: string | undefined;
  try {
    const [row] = await db.insert(schema.inventoryItems).values(parsed.data).returning();
    createdId = row?.id;
    await recordAudit({
      action: 'inventory_item.create',
      entityKind: 'inventory_item',
      entityId: row?.id,
      after: row,
    });
  } catch (err) {
    return { error: `Insert failed: ${(err as Error).message}` };
  }
  revalidatePath('/admin/inventory');
  redirect(createdId ? `/admin/inventory/${createdId}` : '/admin/inventory');
}

export async function updateInventoryAction(
  id: string,
  _prev: InventoryUpdateState,
  formData: FormData,
): Promise<InventoryUpdateState> {
  const parsed = updateSchema.safeParse({
    variantId: formData.get('variantId') ?? NONE,
    status: formData.get('status'),
    resellerSku: formData.get('resellerSku') ?? '',
    titleAtSource: formData.get('titleAtSource') ?? '',
  });
  if (!parsed.success) return { fieldErrors: flatten(parsed) };

  const [before] = await db
    .select()
    .from(schema.inventoryItems)
    .where(eq(schema.inventoryItems.id, id))
    .limit(1);
  if (!before) return { error: 'Not found' };
  try {
    const [after] = await db
      .update(schema.inventoryItems)
      .set(parsed.data)
      .where(eq(schema.inventoryItems.id, id))
      .returning();
    await recordAudit({
      action: 'inventory_item.update',
      entityKind: 'inventory_item',
      entityId: id,
      before,
      after,
    });
  } catch (err) {
    return { error: `Update failed: ${(err as Error).message}` };
  }
  revalidatePath('/admin/inventory');
  revalidatePath(`/admin/inventory/${id}`);
  redirect('/admin/inventory');
}

export async function archiveInventoryAction(id: string) {
  const [before] = await db
    .select()
    .from(schema.inventoryItems)
    .where(eq(schema.inventoryItems.id, id))
    .limit(1);
  if (!before) return;
  const [after] = await db
    .update(schema.inventoryItems)
    .set({ status: 'archived' })
    .where(eq(schema.inventoryItems.id, id))
    .returning();
  await recordAudit({
    action: 'inventory_item.archive',
    entityKind: 'inventory_item',
    entityId: id,
    before,
    after,
  });
  revalidatePath('/admin/inventory');
  revalidatePath(`/admin/inventory/${id}`);
}
