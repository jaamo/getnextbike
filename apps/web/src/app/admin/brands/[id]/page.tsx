import { schema } from '@getnextbike/db';
import { eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { db } from '@/lib/db';
import { deleteBrandAction, updateBrandAction } from '../actions';
import { BrandForm } from '../brand-form';

export default async function EditBrandPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [brand] = await db.select().from(schema.brands).where(eq(schema.brands.id, id)).limit(1);
  if (!brand) notFound();

  const updateBound = updateBrandAction.bind(null, id);
  const deleteBound = deleteBrandAction.bind(null, id);

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Edit brand</h1>
      <p className="mt-1 text-sm text-muted-foreground">{brand.name}</p>
      <div className="mt-6">
        <BrandForm action={updateBound} initial={brand} submitLabel="Save" />
      </div>
      <form action={deleteBound} className="mt-10 pt-6 border-t">
        <p className="text-sm text-muted-foreground">
          Deleting a brand is permanent. Models linked to it will block deletion.
        </p>
        <Button type="submit" variant="destructive" size="sm" className="mt-3">
          Delete brand
        </Button>
      </form>
    </div>
  );
}
