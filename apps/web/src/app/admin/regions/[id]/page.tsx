import { schema } from '@getnextbike/db';
import { eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { db } from '@/lib/db';
import { deleteRegionAction, updateRegionAction } from '../actions';
import { RegionForm } from '../region-form';

export default async function EditRegionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [region] = await db.select().from(schema.regions).where(eq(schema.regions.id, id)).limit(1);
  if (!region) notFound();
  const update = updateRegionAction.bind(null, id);
  const del = deleteRegionAction.bind(null, id);
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Edit region</h1>
      <p className="mt-1 text-sm text-muted-foreground">{region.name}</p>
      <div className="mt-6">
        <RegionForm action={update} initial={region} submitLabel="Save" />
      </div>
      <form action={del} className="mt-10 pt-6 border-t">
        <Button type="submit" variant="destructive" size="sm">
          Delete region
        </Button>
      </form>
    </div>
  );
}
