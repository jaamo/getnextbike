import { schema } from '@getnextbike/db';
import { asc, desc, eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { db } from '@/lib/db';
import { deleteVariantAction, updateVariantAction } from '../actions';
import { VariantForm } from '../variant-form';

export default async function EditVariantPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [row] = await db
    .select()
    .from(schema.modelVariants)
    .where(eq(schema.modelVariants.id, id))
    .limit(1);
  if (!row) notFound();

  const [modelYears, regions] = await Promise.all([
    db
      .select({
        id: schema.modelYears.id,
        year: schema.modelYears.year,
        modelName: schema.models.name,
        brandName: schema.brands.name,
      })
      .from(schema.modelYears)
      .leftJoin(schema.models, eq(schema.modelYears.modelId, schema.models.id))
      .leftJoin(schema.brands, eq(schema.models.brandId, schema.brands.id))
      .orderBy(desc(schema.modelYears.year), asc(schema.brands.name), asc(schema.models.name)),
    db
      .select({ id: schema.regions.id, code: schema.regions.code, name: schema.regions.name })
      .from(schema.regions)
      .orderBy(asc(schema.regions.code)),
  ]);

  const update = updateVariantAction.bind(null, id);
  const del = deleteVariantAction.bind(null, id);

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Edit variant</h1>
      <div className="mt-6">
        <VariantForm
          action={update}
          modelYears={modelYears.map((my) => ({
            id: my.id,
            label: `${my.year} · ${my.brandName ?? '?'} ${my.modelName ?? '?'}`,
          }))}
          regions={regions.map((r) => ({ id: r.id, label: `${r.code} — ${r.name}` }))}
          initial={row}
          submitLabel="Save"
        />
      </div>
      <form action={del} className="mt-10 pt-6 border-t">
        <Button type="submit" variant="destructive" size="sm">
          Delete variant
        </Button>
      </form>
    </div>
  );
}
