import { schema } from '@getnextbike/db';
import { and, desc, eq } from 'drizzle-orm';
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
import { rollbackSelectorAction, saveSelectorVersionAction } from '../../actions';
import { selectorFields, selectorTypes } from '../../enums';
import { SelectorForm } from './selector-form';

export default async function SelectorEditorPage({
  params,
}: {
  params: Promise<{ id: string; field: string }>;
}) {
  const { id, field } = await params;
  if (!(selectorFields as readonly string[]).includes(field)) notFound();
  const typedField = field as (typeof selectorFields)[number];

  const [storefront] = await db
    .select({
      id: schema.resellerLocations.id,
      name: schema.resellerLocations.name,
      resellerName: schema.resellers.name,
      kind: schema.resellerLocations.kind,
    })
    .from(schema.resellerLocations)
    .innerJoin(schema.resellers, eq(schema.resellerLocations.resellerId, schema.resellers.id))
    .where(eq(schema.resellerLocations.id, id))
    .limit(1);
  if (!storefront || storefront.kind !== 'online') notFound();

  const [selector] = await db
    .select()
    .from(schema.crawlSelectors)
    .where(
      and(
        eq(schema.crawlSelectors.resellerLocationId, id),
        eq(schema.crawlSelectors.field, typedField),
      ),
    )
    .limit(1);

  const [currentVersion] = selector?.currentVersionId
    ? await db
        .select()
        .from(schema.crawlSelectorVersions)
        .where(eq(schema.crawlSelectorVersions.id, selector.currentVersionId))
        .limit(1)
    : [undefined];

  const history = selector
    ? await db
        .select()
        .from(schema.crawlSelectorVersions)
        .where(eq(schema.crawlSelectorVersions.selectorId, selector.id))
        .orderBy(desc(schema.crawlSelectorVersions.version))
        .limit(20)
    : [];

  const save = saveSelectorVersionAction.bind(null, id, typedField);

  return (
    <div className="space-y-10">
      <div>
        <Link className="text-xs underline text-muted-foreground" href={`/admin/storefronts/${id}`}>
          ← back to storefront
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          {storefront.resellerName} · {storefront.name}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Selector field: <code className="rounded bg-muted px-1.5 py-0.5">{field}</code>
        </p>
      </div>

      <SelectorForm
        action={save}
        types={selectorTypes}
        initial={
          currentVersion
            ? {
                selectorType: currentVersion.selectorType,
                expression: currentVersion.expression,
                postProcessJson: currentVersion.postProcessJson as Record<string, unknown> | null,
              }
            : undefined
        }
      />

      {history.length > 0 ? (
        <section>
          <h2 className="text-lg font-semibold tracking-tight">Version history</h2>
          <div className="mt-3 rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Version</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Expression</TableHead>
                  <TableHead>Origin</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-32" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((v) => {
                  const isCurrent = v.id === selector?.currentVersionId;
                  const rollback = selector
                    ? rollbackSelectorAction.bind(null, id, selector.id, v.id)
                    : undefined;
                  return (
                    <TableRow key={v.id}>
                      <TableCell>
                        <Badge variant={isCurrent ? 'default' : 'outline'}>v{v.version}</Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{v.selectorType}</TableCell>
                      <TableCell className="font-mono text-xs truncate max-w-md">
                        {v.expression}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{v.origin}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {v.createdAt.toISOString().slice(0, 19).replace('T', ' ')}
                      </TableCell>
                      <TableCell>
                        {!isCurrent && rollback ? (
                          <form action={rollback}>
                            <Button type="submit" variant="outline" size="sm">
                              Roll back
                            </Button>
                          </form>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </section>
      ) : null}
    </div>
  );
}
