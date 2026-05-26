import { schema } from '@getnextbike/db';
import { eq, ilike, or } from 'drizzle-orm';
import { type NextRequest, NextResponse } from 'next/server';
import { badRequest } from '@/lib/api';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim();
  if (!q || q.length < 2) return badRequest('q must be at least 2 characters');
  const pattern = `%${q.replace(/[%_]/g, (m) => `\\${m}`)}%`;

  const [brands, models] = await Promise.all([
    db
      .select({
        id: schema.brands.id,
        slug: schema.brands.slug,
        name: schema.brands.name,
      })
      .from(schema.brands)
      .where(or(ilike(schema.brands.name, pattern), ilike(schema.brands.slug, pattern)))
      .limit(20),
    db
      .select({
        id: schema.models.id,
        slug: schema.models.slug,
        name: schema.models.name,
        category: schema.models.category,
        brand: {
          slug: schema.brands.slug,
          name: schema.brands.name,
        },
      })
      .from(schema.models)
      .innerJoin(schema.brands, eq(schema.models.brandId, schema.brands.id))
      .where(or(ilike(schema.models.name, pattern), ilike(schema.models.slug, pattern)))
      .limit(40),
  ]);

  return NextResponse.json({ data: { brands, models } });
}
