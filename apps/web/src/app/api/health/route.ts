import { sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    await db.execute(sql`select 1`);
    return NextResponse.json({ status: 'ok', db: 'up' });
  } catch (err) {
    return NextResponse.json(
      { status: 'degraded', db: 'down', error: (err as Error).message },
      { status: 503 },
    );
  }
}
