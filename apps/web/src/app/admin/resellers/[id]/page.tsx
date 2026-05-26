import { schema } from '@getnextbike/db';
import { asc, eq } from 'drizzle-orm';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { db } from '@/lib/db';
import { deleteResellerAction, updateResellerAction } from '../actions';
import { resellerStatuses } from '../enums';
import { ResellerForm } from '../reseller-form';

export default async function EditResellerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [reseller] = await db
    .select()
    .from(schema.resellers)
    .where(eq(schema.resellers.id, id))
    .limit(1);
  if (!reseller) notFound();

  const locations = await db
    .select({
      id: schema.resellerLocations.id,
      slug: schema.resellerLocations.slug,
      name: schema.resellerLocations.name,
      kind: schema.resellerLocations.kind,
      status: schema.resellerLocations.status,
      regionCode: schema.regions.code,
      city: schema.resellerLocations.city,
      storefrontUrl: schema.resellerLocations.storefrontUrl,
    })
    .from(schema.resellerLocations)
    .leftJoin(schema.regions, eq(schema.resellerLocations.regionId, schema.regions.id))
    .where(eq(schema.resellerLocations.resellerId, id))
    .orderBy(asc(schema.resellerLocations.kind), asc(schema.resellerLocations.name));

  const update = updateResellerAction.bind(null, id);
  const del = deleteResellerAction.bind(null, id);

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{reseller.name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">Reseller settings.</p>
        <div className="mt-6">
          <ResellerForm
            action={update}
            statuses={resellerStatuses}
            initial={reseller}
            submitLabel="Save"
          />
        </div>
      </div>

      <section>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold tracking-tight">Locations</h2>
          <Button asChild size="sm">
            <Link href={`/admin/resellers/${id}/locations/new`}>Add location</Link>
          </Button>
        </div>
        <div className="mt-4 rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Kind</TableHead>
                <TableHead>Region</TableHead>
                <TableHead>City / storefront</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {locations.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    No locations yet.
                  </TableCell>
                </TableRow>
              ) : (
                locations.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="font-medium">{l.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{l.kind}</Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{l.regionCode ?? '—'}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {l.kind === 'online' ? l.storefrontUrl : (l.city ?? '—')}
                    </TableCell>
                    <TableCell>
                      <Badge variant={l.status === 'active' ? 'default' : 'secondary'}>
                        {l.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Link
                        className="text-sm underline"
                        href={`/admin/resellers/${id}/locations/${l.id}`}
                      >
                        Edit
                      </Link>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      <form action={del} className="pt-6 border-t">
        <p className="text-sm text-muted-foreground">
          Deleting a reseller cascades to all locations and inventory.
        </p>
        <Button type="submit" variant="destructive" size="sm" className="mt-3">
          Delete reseller
        </Button>
      </form>
    </div>
  );
}
