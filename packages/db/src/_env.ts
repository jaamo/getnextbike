// Shared env loader for db CLI scripts (migrate, seed-admin). tsx doesn't
// auto-load .env, and @next/env is CJS so a named ESM import fails on Node —
// use createRequire to interop. A single repo-root .env serves both the Next
// apps and these scripts.
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { loadEnvConfig } = require('@next/env') as typeof import('@next/env');

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
loadEnvConfig(repoRoot);
