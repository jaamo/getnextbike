import { schema } from '@getnextbike/db';
import { asc, eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { db } from '@/lib/db';
import { deleteModelYearAction, updateModelYearAction } from '../actions';
import { ModelYearForm } from '../model-year-form';

export default async function EditModelYearPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [row] = await db
    .select()
    .from(schema.modelYears)
    .where(eq(schema.modelYears.id, id))
    .limit(1);
  if (!row) notFound();

  const models = await db
    .select({
      id: schema.models.id,
      name: schema.models.name,
      brandName: schema.brands.name,
    })
    .from(schema.models)
    .leftJoin(schema.brands, eq(schema.models.brandId, schema.brands.id))
    .orderBy(asc(schema.brands.name), asc(schema.models.name));

  const opts = models.map((m) => ({ id: m.id, label: `${m.brandName ?? '?'} — ${m.name}` }));

  const update = updateModelYearAction.bind(null, id);
  const del = deleteModelYearAction.bind(null, id);

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Edit model year</h1>
      <div className="mt-6">
        <ModelYearForm action={update} models={opts} initial={row} submitLabel="Save" />
      </div>
      <form action={del} className="mt-10 pt-6 border-t">
        <Button type="submit" variant="destructive" size="sm">
          Delete model year
        </Button>
      </form>
    </div>
  );
}
