import { schema } from '@getnextbike/db';
import { eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { db } from '@/lib/db';
import { deleteComponentAction, updateComponentAction } from '../actions';
import { ComponentForm } from '../component-form';
import { componentTypes } from '../enums';

export default async function EditComponentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [row] = await db
    .select()
    .from(schema.components)
    .where(eq(schema.components.id, id))
    .limit(1);
  if (!row) notFound();
  const update = updateComponentAction.bind(null, id);
  const del = deleteComponentAction.bind(null, id);
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Edit component</h1>
      <p className="mt-1 text-sm text-muted-foreground">{row.name}</p>
      <div className="mt-6">
        <ComponentForm
          action={update}
          types={componentTypes}
          initial={{
            type: row.type,
            manufacturer: row.manufacturer,
            name: row.name,
            tier: row.tier,
            specJson: row.specJson as Record<string, unknown> | null,
          }}
          submitLabel="Save"
        />
      </div>
      <form action={del} className="mt-10 pt-6 border-t">
        <Button type="submit" variant="destructive" size="sm">
          Delete component
        </Button>
      </form>
    </div>
  );
}
