import { schema } from '@getnextbike/db';
import { asc, desc, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { createVariantAction } from '../actions';
import { VariantForm } from '../variant-form';

export default async function NewVariantPage() {
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

  if (modelYears.length === 0) {
    return (
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">New variant</h1>
        <p className="mt-2 text-sm text-muted-foreground">Create a model year first.</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">New variant</h1>
      <div className="mt-6">
        <VariantForm
          action={createVariantAction}
          modelYears={modelYears.map((my) => ({
            id: my.id,
            label: `${my.year} · ${my.brandName ?? '?'} ${my.modelName ?? '?'}`,
          }))}
          regions={regions.map((r) => ({ id: r.id, label: `${r.code} — ${r.name}` }))}
          submitLabel="Create"
        />
      </div>
    </div>
  );
}
