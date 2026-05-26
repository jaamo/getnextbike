import { schema } from '@getnextbike/db';
import { asc, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { createModelYearAction } from '../actions';
import { ModelYearForm } from '../model-year-form';

export default async function NewModelYearPage() {
  const models = await db
    .select({
      id: schema.models.id,
      name: schema.models.name,
      brandName: schema.brands.name,
    })
    .from(schema.models)
    .leftJoin(schema.brands, eq(schema.models.brandId, schema.brands.id))
    .orderBy(asc(schema.brands.name), asc(schema.models.name));

  if (models.length === 0) {
    return (
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">New model year</h1>
        <p className="mt-2 text-sm text-muted-foreground">Create a model first.</p>
      </div>
    );
  }

  const opts = models.map((m) => ({ id: m.id, label: `${m.brandName ?? '?'} — ${m.name}` }));

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">New model year</h1>
      <div className="mt-6">
        <ModelYearForm action={createModelYearAction} models={opts} submitLabel="Create" />
      </div>
    </div>
  );
}
