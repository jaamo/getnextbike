import { schema } from '@getnextbike/db';
import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { notFound } from '@/lib/api';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [row] = await db.select().from(schema.brands).where(eq(schema.brands.slug, slug)).limit(1);
  if (!row) return notFound();
  return NextResponse.json({ data: row });
}
