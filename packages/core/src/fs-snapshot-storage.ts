import { constants } from 'node:fs';
import { access, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { SnapshotStorage } from './snapshot-storage';

// Local filesystem backend for SnapshotStorage. v1 deployment mounts a Docker
// volume at `rootDir` (spec §11.4). All relative paths are resolved under that
// root; any attempt to escape it (`..`) throws.
export class FsSnapshotStorage implements SnapshotStorage {
  constructor(private readonly rootDir: string) {}

  async write(relativePath: string, html: string): Promise<void> {
    const abs = this.resolve(relativePath);
    await mkdir(path.dirname(abs), { recursive: true });
    await writeFile(abs, html, 'utf8');
  }

  async read(relativePath: string): Promise<string> {
    return readFile(this.resolve(relativePath), 'utf8');
  }

  async delete(relativePath: string): Promise<void> {
    await rm(this.resolve(relativePath), { force: true });
  }

  async exists(relativePath: string): Promise<boolean> {
    try {
      await access(this.resolve(relativePath), constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }

  rootPath(): string {
    return this.rootDir;
  }

  private resolve(relativePath: string): string {
    const abs = path.resolve(this.rootDir, relativePath);
    const rel = path.relative(this.rootDir, abs);
    if (rel.startsWith('..') || path.isAbsolute(rel)) {
      throw new Error(`snapshot path escapes rootDir: ${relativePath}`);
    }
    return abs;
  }
}
