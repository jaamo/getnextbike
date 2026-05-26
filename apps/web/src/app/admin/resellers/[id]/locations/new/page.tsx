import { schema } from '@getnextbike/db';
import { asc, eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { createLocationAction } from '../actions';
import { locationKinds, locationStatuses, robotsPolicies } from '../enums';
import { LocationForm } from '../location-form';

export default async function NewLocationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [reseller] = await db
    .select({ id: schema.resellers.id, name: schema.resellers.name })
    .from(schema.resellers)
    .where(eq(schema.resellers.id, id))
    .limit(1);
  if (!reseller) notFound();

  const regions = await db
    .select({ id: schema.regions.id, code: schema.regions.code, name: schema.regions.name })
    .from(schema.regions)
    .orderBy(asc(schema.regions.code));

  if (regions.length === 0) {
    return (
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">New location</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Create a region first — locations need an owning region.
        </p>
      </div>
    );
  }

  const create = createLocationAction.bind(null, id);

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">New location · {reseller.name}</h1>
      <div className="mt-6">
        <LocationForm
          action={create}
          regions={regions.map((r) => ({ id: r.id, label: `${r.code} — ${r.name}` }))}
          kinds={locationKinds}
          statuses={locationStatuses}
          robotsPolicies={robotsPolicies}
          submitLabel="Create"
        />
      </div>
    </div>
  );
}
