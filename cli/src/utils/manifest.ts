import * as path from 'path';
import * as fs from 'fs';

export interface TemplateEntry {
  id: string;
  name: string;
  description: string;
  path: string;
  copyRoot: boolean;
  requiredEnvVars: string[];
  optionalEnvVars: string[];
  devCommand: string;
  deploy: string[];
}

export interface ProviderEntry {
  id: string;
  name: string;
  envVar: string;
  hint: string;
}

export interface DeployPlatformEntry {
  id: string;
  name: string;
  configPath: string;
  command: string;
}

export interface Manifest {
  version: number;
  templates: TemplateEntry[];
  providers: ProviderEntry[];
  deployPlatforms: DeployPlatformEntry[];
}

let cached: Manifest | null = null;

export function loadManifest(): Manifest {
  if (cached) return cached;
  const manifestPath = path.resolve(__dirname, '../../agent-manifest.json');
  const raw = fs.readFileSync(manifestPath, 'utf-8');
  cached = JSON.parse(raw) as Manifest;
  return cached;
}

export function getTemplates(): TemplateEntry[] {
  return loadManifest().templates;
}

export function getTemplate(id: string): TemplateEntry | undefined {
  return getTemplates().find((t) => t.id === id);
}

export function getProviders(): ProviderEntry[] {
  return loadManifest().providers;
}

export function getDeployPlatforms(): DeployPlatformEntry[] {
  return loadManifest().deployPlatforms;
}
