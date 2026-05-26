import { schema } from '@getnextbike/db';
import { asc, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { NewInventoryForm } from '../new-form';

export default async function NewInventoryPage() {
  const onlineLocations = await db
    .select({
      id: schema.resellerLocations.id,
      name: schema.resellerLocations.name,
      resellerName: schema.resellers.name,
    })
    .from(schema.resellerLocations)
    .innerJoin(schema.resellers, eq(schema.resellerLocations.resellerId, schema.resellers.id))
    .where(eq(schema.resellerLocations.kind, 'online'))
    .orderBy(asc(schema.resellers.name), asc(schema.resellerLocations.name));

  if (onlineLocations.length === 0) {
    return (
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Register product URL</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Inventory items must attach to an online reseller location. Create one first.
        </p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Register product URL</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Adds a product page for the crawler to track. The variant match happens later — either
        manually here or automatically by reseller reverse-fill in Phase 4.
      </p>
      <div className="mt-6">
        <NewInventoryForm
          onlineLocations={onlineLocations.map((l) => ({
            id: l.id,
            label: `${l.resellerName} · ${l.name}`,
          }))}
        />
      </div>
    </div>
  );
}
