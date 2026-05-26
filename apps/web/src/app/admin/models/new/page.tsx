import { schema } from '@getnextbike/db';
import { asc } from 'drizzle-orm';
import { db } from '@/lib/db';
import { createModelAction } from '../actions';
import { modelCategories } from '../enums';
import { ModelForm } from '../model-form';

export default async function NewModelPage() {
  const brands = await db
    .select({ id: schema.brands.id, name: schema.brands.name })
    .from(schema.brands)
    .orderBy(asc(schema.brands.name));

  if (brands.length === 0) {
    return (
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">New model</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Create a brand first — models need an owning brand.
        </p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">New model</h1>
      <div className="mt-6">
        <ModelForm
          action={createModelAction}
          brands={brands}
          categories={modelCategories}
          submitLabel="Create"
        />
      </div>
    </div>
  );
}
