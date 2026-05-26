import { schema } from '@getnextbike/db';
import { and, asc, eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { db } from '@/lib/db';
import { deleteLocationAction, updateLocationAction } from '../actions';
import { locationKinds, locationStatuses, robotsPolicies } from '../enums';
import { LocationForm } from '../location-form';

export default async function EditLocationPage({
  params,
}: {
  params: Promise<{ id: string; locId: string }>;
}) {
  const { id, locId } = await params;
  const [location] = await db
    .select()
    .from(schema.resellerLocations)
    .where(and(eq(schema.resellerLocations.id, locId), eq(schema.resellerLocations.resellerId, id)))
    .limit(1);
  if (!location) notFound();

  const [reseller] = await db
    .select({ name: schema.resellers.name })
    .from(schema.resellers)
    .where(eq(schema.resellers.id, id))
    .limit(1);

  const regions = await db
    .select({ id: schema.regions.id, code: schema.regions.code, name: schema.regions.name })
    .from(schema.regions)
    .orderBy(asc(schema.regions.code));

  const update = updateLocationAction.bind(null, id, locId);
  const del = deleteLocationAction.bind(null, id, locId);

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">
        Edit location · {reseller?.name ?? 'Reseller'}
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">{location.name}</p>
      <div className="mt-6">
        <LocationForm
          action={update}
          regions={regions.map((r) => ({ id: r.id, label: `${r.code} — ${r.name}` }))}
          kinds={locationKinds}
          statuses={locationStatuses}
          robotsPolicies={robotsPolicies}
          initial={{
            ...location,
            openingHoursJson: location.openingHoursJson as Record<string, unknown> | null,
            latitude: location.latitude as string | null,
            longitude: location.longitude as string | null,
          }}
          submitLabel="Save"
          kindLocked
        />
      </div>
      <form action={del} className="mt-10 pt-6 border-t">
        <Button type="submit" variant="destructive" size="sm">
          Delete location
        </Button>
      </form>
    </div>
  );
}
