import * as path from 'path';
import * as fs from 'fs';
import { execSync } from 'child_process';
import { info, warn } from './ui';

export interface TemplateEntry {
  id: string;
  name: string;
  description: string;
  path: string;
  requiredEnvVars: string[];
  optionalEnvVars: string[];
  envFile?: string;
  devCommand: string;
  deploy: string[];
}

export interface ProviderEntry {
  id: string;
  name: string;
  envVar: string;
  hint: string;
}

export interface Manifest {
  version: number;
  templates: TemplateEntry[];
  providers: ProviderEntry[];
}

let cached: Manifest | null = null;
let cachedSourceRoot: string | null = null;

export function loadManifest(): Manifest {
  if (cached) return cached;
  const manifestPath = path.resolve(__dirname, '../../agent-manifest.json');
  const raw = fs.readFileSync(manifestPath, 'utf-8');
  cached = JSON.parse(raw) as Manifest;
  cachedSourceRoot = path.resolve(__dirname, '../../../..');
  return cached;
}

/**
 * Load manifest from an external GitHub repo or local path.
 * Returns the manifest and the root directory where templates live.
 *
 * Supported sources:
 *   - "user/repo" — clones from GitHub, reads agent-manifest.json
 *   - "/absolute/path" or "./relative" — reads from local directory
 */
export async function loadExternalManifest(source: string): Promise<{
  manifest: Manifest;
  sourceRoot: string;
}> {
  // Local path
  if (source.startsWith('/') || source.startsWith('.')) {
    const absPath = path.resolve(source);
    const manifestPath = path.join(absPath, 'agent-manifest.json');
    if (!fs.existsSync(manifestPath)) {
      throw new Error(`No agent-manifest.json found in ${absPath}`);
    }
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8')) as Manifest;
    cached = manifest;
    cachedSourceRoot = absPath;
    return { manifest, sourceRoot: absPath };
  }

  // GitHub repo (user/repo format)
  const tmpDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'fc-agent-'));
  info(`Cloning ${source}...`);
  try {
    execSync(`git clone --depth 1 https://github.com/${source}.git "${tmpDir}"`, {
      stdio: 'pipe',
    });
  } catch {
    throw new Error(`Failed to clone https://github.com/${source} — check the repo exists and is accessible`);
  }

  const manifestPath = path.join(tmpDir, 'agent-manifest.json');
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`No agent-manifest.json found in ${source}`);
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8')) as Manifest;
  cached = manifest;
  cachedSourceRoot = tmpDir;
  return { manifest, sourceRoot: tmpDir };
}

export function getSourceRoot(): string {
  if (cachedSourceRoot) return cachedSourceRoot;
  loadManifest();
  return cachedSourceRoot!;
}

export function getTemplates(): TemplateEntry[] {
  return (cached ?? loadManifest()).templates;
}

export function getTemplate(id: string): TemplateEntry | undefined {
  return getTemplates().find((t) => t.id === id);
}

export function getProviders(): ProviderEntry[] {
  return (cached ?? loadManifest()).providers;
}

