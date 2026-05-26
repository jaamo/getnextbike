import { NextResponse } from 'next/server';

export const API_DEFAULT_LIMIT = 50;
export const API_MAX_LIMIT = 200;

export function parseLimit(searchParams: URLSearchParams): number {
  const raw = searchParams.get('limit');
  if (!raw) return API_DEFAULT_LIMIT;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) return API_DEFAULT_LIMIT;
  return Math.min(n, API_MAX_LIMIT);
}

export function parseCursor<T>(searchParams: URLSearchParams): T | null {
  const raw = searchParams.get('cursor');
  if (!raw) return null;
  try {
    return JSON.parse(Buffer.from(raw, 'base64url').toString('utf-8')) as T;
  } catch {
    return null;
  }
}

export function encodeCursor<T>(value: T): string {
  return Buffer.from(JSON.stringify(value), 'utf-8').toString('base64url');
}

export function listResponse<T>(items: T[], nextCursor: string | null) {
  return NextResponse.json({ data: items, nextCursor });
}

export function notFound(message = 'Not found') {
  return NextResponse.json({ error: message }, { status: 404 });
}

export function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}
