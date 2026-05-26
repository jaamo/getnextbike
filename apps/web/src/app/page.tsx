export default function HomePage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">GetNextBike</h1>
      <p className="mt-3 text-muted-foreground">
        Bicycle catalog and reseller inventory backend. Phase 1 scaffolding in place.
      </p>
      <ul className="mt-8 space-y-2 text-sm">
        <li>
          <code className="rounded bg-muted px-2 py-1">GET /api/health</code> — service health
        </li>
        <li>
          <code className="rounded bg-muted px-2 py-1">/admin</code> — admin UI (placeholder)
        </li>
      </ul>
    </main>
  );
}
