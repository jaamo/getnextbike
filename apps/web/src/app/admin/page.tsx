import { schema } from '@getnextbike/db';
import { count } from 'drizzle-orm';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function AdminDashboardPage() {
  const [brands, models, modelYears, variants, components, regions] = await Promise.all([
    db
      .select({ n: count() })
      .from(schema.brands)
      .then((r) => r[0]?.n ?? 0),
    db
      .select({ n: count() })
      .from(schema.models)
      .then((r) => r[0]?.n ?? 0),
    db
      .select({ n: count() })
      .from(schema.modelYears)
      .then((r) => r[0]?.n ?? 0),
    db
      .select({ n: count() })
      .from(schema.modelVariants)
      .then((r) => r[0]?.n ?? 0),
    db
      .select({ n: count() })
      .from(schema.components)
      .then((r) => r[0]?.n ?? 0),
    db
      .select({ n: count() })
      .from(schema.regions)
      .then((r) => r[0]?.n ?? 0),
  ]);

  const tiles = [
    { label: 'Brands', value: brands },
    { label: 'Models', value: models },
    { label: 'Model years', value: modelYears },
    { label: 'Variants', value: variants },
    { label: 'Components', value: components },
    { label: 'Regions', value: regions },
  ];

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Phase 1 — catalog foundation. Crawler health, AI usage, and selector queue land in Phase 2+.
      </p>

      <div className="mt-8 grid grid-cols-2 md:grid-cols-3 gap-4">
        {tiles.map((tile) => (
          <Card key={tile.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">{tile.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-semibold tracking-tight">{tile.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
