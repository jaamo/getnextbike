'use server';

import { schema } from '@getnextbike/db';
import { and, eq, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { recordAudit } from '@/lib/audit';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

const fields = schema.crawlSelectorField.enumValues;
const types = schema.crawlSelectorType.enumValues;

const versionSchema = z.object({
  selectorType: z.enum(types),
  expression: z.string().min(1).max(2000),
  postProcessJson: z
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

export type SelectorFormState =
  | { error?: string; fieldErrors?: Record<string, string> }
  | undefined;

function flatten(parsed: z.SafeParseError<unknown>) {
  const out: Record<string, string> = {};
  for (const i of parsed.error.issues) out[i.path.join('.') || '_'] ??= i.message;
  return out;
}

/**
 * Save a new selector version for (storefront, field). Idempotent in shape:
 * - if no crawl_selectors row exists, create it + version 1
 * - if it exists, append a new version, bump current_version_id, close prev validity.
 */
export async function saveSelectorVersionAction(
  storefrontId: string,
  field: (typeof fields)[number],
  _prev: SelectorFormState,
  formData: FormData,
): Promise<SelectorFormState> {
  const parsed = versionSchema.safeParse({
    selectorType: formData.get('selectorType'),
    expression: formData.get('expression'),
    postProcessJson: formData.get('postProcessJson') ?? '',
  });
  if (!parsed.success) return { fieldErrors: flatten(parsed) };

  const session = await auth();
  const actor = session?.user?.email ?? 'system';

  try {
    await db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(schema.crawlSelectors)
        .where(
          and(
            eq(schema.crawlSelectors.resellerLocationId, storefrontId),
            eq(schema.crawlSelectors.field, field),
          ),
        )
        .limit(1);

      let selectorId: string;
      let nextVersion: number;
      const now = new Date();

      if (existing) {
        selectorId = existing.id;
        const maxRow = await tx
          .select({
            maxVersion: sql<number>`coalesce(max(${schema.crawlSelectorVersions.version}), 0)`,
          })
          .from(schema.crawlSelectorVersions)
          .where(eq(schema.crawlSelectorVersions.selectorId, selectorId));
        nextVersion = (maxRow[0]?.maxVersion ?? 0) + 1;

        // Close the previous active version's validity window.
        if (existing.currentVersionId) {
          await tx
            .update(schema.crawlSelectorVersions)
            .set({ validTo: now })
            .where(eq(schema.crawlSelectorVersions.id, existing.currentVersionId));
        }
      } else {
        const [row] = await tx
          .insert(schema.crawlSelectors)
          .values({
            resellerLocationId: storefrontId,
            field,
            status: 'active',
          })
          .returning({ id: schema.crawlSelectors.id });
        if (!row) throw new Error('failed to create crawl_selectors row');
        selectorId = row.id;
        nextVersion = 1;
      }

      const [versionRow] = await tx
        .insert(schema.crawlSelectorVersions)
        .values({
          selectorId,
          version: nextVersion,
          selectorType: parsed.data.selectorType,
          expression: parsed.data.expression,
          postProcessJson: parsed.data.postProcessJson,
          origin: 'manual',
          createdBy: actor,
          validFrom: now,
        })
        .returning({ id: schema.crawlSelectorVersions.id });

      await tx
        .update(schema.crawlSelectors)
        .set({
          currentVersionId: versionRow?.id,
          status: 'active',
          failedItemIds: sql`'{}'::uuid[]`,
          updatedAt: now,
        })
        .where(eq(schema.crawlSelectors.id, selectorId));

      await recordAudit({
        action: 'crawl_selector.save_version',
        entityKind: 'crawl_selector',
        entityId: selectorId,
        after: { field, version: nextVersion, selectorType: parsed.data.selectorType },
      });
    });
  } catch (err) {
    return { error: `Save failed: ${(err as Error).message}` };
  }
  revalidatePath(`/admin/storefronts/${storefrontId}`);
  redirect(`/admin/storefronts/${storefrontId}`);
}

export async function rollbackSelectorAction(
  storefrontId: string,
  selectorId: string,
  versionId: string,
) {
  const [version] = await db
    .select()
    .from(schema.crawlSelectorVersions)
    .where(eq(schema.crawlSelectorVersions.id, versionId))
    .limit(1);
  if (!version || version.selectorId !== selectorId) return;

  const now = new Date();
  await db.transaction(async (tx) => {
    const [selector] = await tx
      .select({ currentVersionId: schema.crawlSelectors.currentVersionId })
      .from(schema.crawlSelectors)
      .where(eq(schema.crawlSelectors.id, selectorId))
      .limit(1);
    if (selector?.currentVersionId && selector.currentVersionId !== versionId) {
      await tx
        .update(schema.crawlSelectorVersions)
        .set({ validTo: now })
        .where(eq(schema.crawlSelectorVersions.id, selector.currentVersionId));
    }
    await tx
      .update(schema.crawlSelectorVersions)
      .set({ validTo: null })
      .where(eq(schema.crawlSelectorVersions.id, versionId));
    await tx
      .update(schema.crawlSelectors)
      .set({
        currentVersionId: versionId,
        status: 'active',
        failedItemIds: sql`'{}'::uuid[]`,
        updatedAt: now,
      })
      .where(eq(schema.crawlSelectors.id, selectorId));
  });

  await recordAudit({
    action: 'crawl_selector.rollback',
    entityKind: 'crawl_selector',
    entityId: selectorId,
    after: { rolledBackTo: version.version },
  });
  revalidatePath(`/admin/storefronts/${storefrontId}`);
}
