import { schema } from '@getnextbike/db';
import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { notFound } from '@/lib/api';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [row] = await db
    .select()
    .from(schema.components)
    .where(eq(schema.components.id, id))
    .limit(1);
  if (!row) return notFound();
  return NextResponse.json({ data: row });
}
