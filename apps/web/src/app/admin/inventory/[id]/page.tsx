import { schema } from '@getnextbike/db';
import { and, asc, desc, eq, gte } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { PriceChart } from '@/components/charts/price-chart';
import { type LocationSeries, StockTimeline } from '@/components/charts/stock-timeline';
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
import { archiveInventoryAction, updateInventoryAction } from '../actions';
import { EditInventoryForm } from '../edit-form';
import { inventoryStatuses } from '../enums';

const CHART_WINDOW_DAYS = 90;
const CHART_OBSERVATION_CAP = 1000;

export default async function InventoryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [item] = await db
    .select({
      id: schema.inventoryItems.id,
      productUrl: schema.inventoryItems.productUrl,
      titleAtSource: schema.inventoryItems.titleAtSource,
      status: schema.inventoryItems.status,
      resellerSku: schema.inventoryItems.resellerSku,
      variantId: schema.inventoryItems.variantId,
      firstSeenAt: schema.inventoryItems.firstSeenAt,
      lastCrawledAt: schema.inventoryItems.lastCrawledAt,
      lastSuccessAt: schema.inventoryItems.lastSuccessAt,
      resellerName: schema.resellers.name,
      locationName: schema.resellerLocations.name,
    })
    .from(schema.inventoryItems)
    .innerJoin(
      schema.resellerLocations,
      eq(schema.inventoryItems.resellerLocationId, schema.resellerLocations.id),
    )
    .innerJoin(schema.resellers, eq(schema.resellerLocations.resellerId, schema.resellers.id))
    .where(eq(schema.inventoryItems.id, id))
    .limit(1);
  if (!item) notFound();

  const variants = await db
    .select({
      id: schema.modelVariants.id,
      buildName: schema.modelVariants.buildName,
      year: schema.modelYears.year,
      modelName: schema.models.name,
      brandName: schema.brands.name,
    })
    .from(schema.modelVariants)
    .innerJoin(schema.modelYears, eq(schema.modelVariants.modelYearId, schema.modelYears.id))
    .innerJoin(schema.models, eq(schema.modelYears.modelId, schema.models.id))
    .innerJoin(schema.brands, eq(schema.models.brandId, schema.brands.id))
    .orderBy(desc(schema.modelYears.year), asc(schema.brands.name), asc(schema.models.name))
    .limit(2000);

  const windowEnd = new Date();
  const windowStart = new Date(windowEnd.getTime() - CHART_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const pricesInWindow = await db
    .select({
      id: schema.priceObservations.id,
      amount: schema.priceObservations.amount,
      currency: schema.priceObservations.currency,
      originalAmount: schema.priceObservations.originalAmount,
      capturedAt: schema.priceObservations.capturedAt,
    })
    .from(schema.priceObservations)
    .where(
      and(
        eq(schema.priceObservations.inventoryItemId, id),
        gte(schema.priceObservations.capturedAt, windowStart),
      ),
    )
    .orderBy(asc(schema.priceObservations.capturedAt))
    .limit(CHART_OBSERVATION_CAP);

  const stockInWindow = await db
    .select({
      id: schema.stockObservations.id,
      status: schema.stockObservations.status,
      quantity: schema.stockObservations.quantity,
      capturedAt: schema.stockObservations.capturedAt,
      locationId: schema.stockObservations.resellerLocationId,
      locationName: schema.resellerLocations.name,
      locationKind: schema.resellerLocations.kind,
    })
    .from(schema.stockObservations)
    .innerJoin(
      schema.resellerLocations,
      eq(schema.stockObservations.resellerLocationId, schema.resellerLocations.id),
    )
    .where(
      and(
        eq(schema.stockObservations.inventoryItemId, id),
        gte(schema.stockObservations.capturedAt, windowStart),
      ),
    )
    .orderBy(asc(schema.stockObservations.capturedAt))
    .limit(CHART_OBSERVATION_CAP);

  const stockSeries = buildStockSeries(stockInWindow);
  const recentPrices = [...pricesInWindow].reverse().slice(0, 20);
  const recentStock = [...stockInWindow].reverse().slice(0, 20);
  const chartCurrency = pricesInWindow[0]?.currency ?? 'EUR';

  const update = updateInventoryAction.bind(null, id);
  const archive = archiveInventoryAction.bind(null, id);

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {item.titleAtSource ?? 'Inventory item'}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {item.resellerName} · {item.locationName}
        </p>
        <a
          href={item.productUrl}
          className="mt-1 inline-block text-xs underline text-muted-foreground"
          rel="noopener noreferrer"
          target="_blank"
        >
          {item.productUrl}
        </a>
        <div className="mt-6">
          <EditInventoryForm
            action={update}
            statuses={inventoryStatuses}
            variants={variants.map((v) => ({
              id: v.id,
              label: `${v.year} · ${v.brandName} ${v.modelName}${
                v.buildName ? ` · ${v.buildName}` : ''
              }`,
            }))}
            initial={{
              variantId: item.variantId,
              status: item.status,
              resellerSku: item.resellerSku,
              titleAtSource: item.titleAtSource,
            }}
          />
        </div>
      </div>

      <section>
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-semibold tracking-tight">Price history</h2>
          <span className="text-xs text-muted-foreground">Last {CHART_WINDOW_DAYS} days</span>
        </div>
        <div className="mt-3">
          <PriceChart
            points={pricesInWindow.map((p) => ({
              capturedAt: p.capturedAt,
              amount: Number(p.amount),
              originalAmount: p.originalAmount != null ? Number(p.originalAmount) : null,
            }))}
            currency={chartCurrency}
            windowStart={windowStart}
            windowEnd={windowEnd}
          />
        </div>
        <h3 className="mt-6 text-sm font-medium text-muted-foreground">Recent prices</h3>
        <div className="mt-2 rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Captured</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Original</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentPrices.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground py-6">
                    No prices observed yet.
                  </TableCell>
                </TableRow>
              ) : (
                recentPrices.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono text-xs">
                      {p.capturedAt.toISOString().replace('T', ' ').slice(0, 19)}
                    </TableCell>
                    <TableCell>
                      {p.amount} {p.currency}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {p.originalAmount ? `${p.originalAmount} ${p.currency}` : '—'}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      <section>
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-semibold tracking-tight">Stock timeline</h2>
          <span className="text-xs text-muted-foreground">Last {CHART_WINDOW_DAYS} days</span>
        </div>
        <div className="mt-3">
          <StockTimeline series={stockSeries} windowStart={windowStart} windowEnd={windowEnd} />
        </div>
        <h3 className="mt-6 text-sm font-medium text-muted-foreground">
          Recent stock observations
        </h3>
        <div className="mt-2 rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Captured</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Qty</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentStock.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-6">
                    No stock observations yet.
                  </TableCell>
                </TableRow>
              ) : (
                recentStock.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-mono text-xs">
                      {s.capturedAt.toISOString().replace('T', ' ').slice(0, 19)}
                    </TableCell>
                    <TableCell>
                      {s.locationName} <Badge variant="outline">{s.locationKind}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={s.status === 'in_stock' ? 'default' : 'secondary'}>
                        {s.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{s.quantity ?? '—'}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      {item.status !== 'archived' ? (
        <form action={archive} className="pt-6 border-t">
          <p className="text-sm text-muted-foreground">
            Archiving stops the crawler from scheduling this item. Observations stay.
          </p>
          <Button type="submit" variant="destructive" size="sm" className="mt-3">
            Archive
          </Button>
        </form>
      ) : null}
    </div>
  );
}

type StockRow = {
  status:
    | 'in_stock'
    | 'low_stock'
    | 'out_of_stock'
    | 'preorder'
    | 'backorder'
    | 'discontinued'
    | 'unknown';
  capturedAt: Date;
  locationId: string;
  locationName: string;
  locationKind: 'physical' | 'online';
};

// Bucket stock observations into per-location series, sorted online-first
// (the inventory item's own storefront) so the most relevant row sits on top.
function buildStockSeries(rows: StockRow[]): LocationSeries[] {
  const map = new Map<string, LocationSeries>();
  for (const row of rows) {
    let series = map.get(row.locationId);
    if (!series) {
      series = {
        locationId: row.locationId,
        locationName: row.locationName,
        locationKind: row.locationKind,
        observations: [],
      };
      map.set(row.locationId, series);
    }
    series.observations.push({ capturedAt: row.capturedAt, status: row.status });
  }
  return [...map.values()].sort((a, b) => {
    if (a.locationKind !== b.locationKind) return a.locationKind === 'online' ? -1 : 1;
    return a.locationName.localeCompare(b.locationName);
  });
}
