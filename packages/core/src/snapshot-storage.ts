// Storage abstraction for crawled HTML snapshots (spec §3.4, §11.4).
// v1 backend is the local filesystem on a Docker volume; the interface is
// designed so an S3 implementation can drop in later without touching callers.

export interface SnapshotStorage {
  write(relativePath: string, html: string): Promise<void>;
  read(relativePath: string): Promise<string>;
  delete(relativePath: string): Promise<void>;
  exists(relativePath: string): Promise<boolean>;
}

export interface InventorySnapshotKey {
  kind: 'inventory';
  resellerLocationId: string;
  inventoryItemId: string;
  crawlRunId: string;
}

export interface CatalogSnapshotKey {
  kind: 'catalog';
  catalogSourceId: string;
  crawlRunId: string;
}

export type SnapshotKey = InventorySnapshotKey | CatalogSnapshotKey;

export function snapshotPath(key: SnapshotKey): string {
  if (key.kind === 'inventory') {
    return `inventory/${key.resellerLocationId}/${key.inventoryItemId}/${key.crawlRunId}.html`;
  }
  return `catalog/${key.catalogSourceId}/${key.crawlRunId}.html`;
}
