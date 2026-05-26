import { schema } from '@getnextbike/db';
import { asc, eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { db } from '@/lib/db';
import { deleteModelAction, updateModelAction } from '../actions';
import { modelCategories } from '../enums';
import { ModelForm } from '../model-form';

export default async function EditModelPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [row] = await db.select().from(schema.models).where(eq(schema.models.id, id)).limit(1);
  if (!row) notFound();
  const brands = await db
    .select({ id: schema.brands.id, name: schema.brands.name })
    .from(schema.brands)
    .orderBy(asc(schema.brands.name));
  const update = updateModelAction.bind(null, id);
  const del = deleteModelAction.bind(null, id);
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Edit model</h1>
      <p className="mt-1 text-sm text-muted-foreground">{row.name}</p>
      <div className="mt-6">
        <ModelForm
          action={update}
          brands={brands}
          categories={modelCategories}
          initial={row}
          submitLabel="Save"
        />
      </div>
      <form action={del} className="mt-10 pt-6 border-t">
        <Button type="submit" variant="destructive" size="sm">
          Delete model
        </Button>
      </form>
    </div>
  );
}
