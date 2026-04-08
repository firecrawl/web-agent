import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import type { TemplateEntry } from './manifest';
import { getSourceRoot } from './manifest';
import { success, info, warn } from './ui';

const SKIP = new Set([
  'node_modules', '.next', '.git', '.DS_Store', 'README.md',
]);

/** Files to skip when copying agent-core (dev artifacts, build config) */
const AGENT_CORE_SKIP = new Set([
  'dist', 'tsup.config.ts', 'tsconfig.json', 'package.json',
]);

function copyDirRecursive(src: string, dest: string, extraSkip?: (name: string) => boolean): void {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });

  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (SKIP.has(entry.name)) continue;
    if (extraSkip?.(entry.name)) continue;
    const srcPath = path.join(src, entry.name);
    // Skip symlinks — agent-core is copied separately
    try { if (fs.lstatSync(srcPath).isSymbolicLink()) continue; } catch { /* proceed */ }
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath, extraSkip);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

/** Clean up any leftover workspace references in scaffolded files. */
function cleanupScaffold(dir: string): void {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory() && !SKIP.has(entry.name)) {
      cleanupScaffold(fullPath);
    } else if (entry.name === 'package.json') {
      const pkg = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
      if (pkg.dependencies?.['@firecrawl/agent-core']) {
        delete pkg.dependencies['@firecrawl/agent-core'];
        fs.writeFileSync(fullPath, JSON.stringify(pkg, null, 2) + '\n', 'utf-8');
      }
    }
  }
}

function generateEnvFile(keys: Record<string, string>): string {
  const lines: string[] = [];
  for (const [envVar, value] of Object.entries(keys)) {
    if (value) lines.push(`${envVar}=${value}`);
  }
  return lines.join('\n') + '\n';
}

export interface ScaffoldOptions {
  projectDir: string;
  template: TemplateEntry;
  envVars: Record<string, string>;
  selectedProvider?: string;
  defaultModelId?: string;
  skipInstall?: boolean;
}

function applyTemplateProviderDefaults(
  projectDir: string,
  templateId: string,
  providerId?: string,
  modelId?: string,
): void {
  if (!providerId || !modelId || templateId !== 'next') return;

  const configPath = path.join(projectDir, 'app', '(agent)', '_config.ts');
  if (!fs.existsSync(configPath)) return;

  let content = fs.readFileSync(configPath, 'utf-8');
  content = content
    .replace(
      /^(\s*)orchestrator:\s*\{ provider: "[^"]+", model: "[^"]+" \} satisfies ModelRef,$/m,
      `$1orchestrator: { provider: "${providerId}", model: "${modelId}" } satisfies ModelRef,`
    )
    .replace(
      /^(\s*)subAgent:\s*\{ provider: "[^"]+", model: "[^"]+" \} satisfies ModelRef,$/m,
      `$1subAgent:     { provider: "${providerId}", model: "${modelId}" } satisfies ModelRef,`
    )
    .replace(
      /^(\s*)background:\s*\{ provider: "[^"]+", model: "[^"]+" \} satisfies ModelRef,$/m,
      `$1background:   { provider: "${providerId}", model: "${modelId}" } satisfies ModelRef,`
    );

  fs.writeFileSync(configPath, content, 'utf-8');
}

export async function scaffoldProject(opts: ScaffoldOptions): Promise<void> {
  const { projectDir, template, envVars, selectedProvider, defaultModelId, skipInstall } = opts;
  const sourceRoot = getSourceRoot();

  fs.mkdirSync(projectDir, { recursive: true });

  // Copy agent-core (skip dev artifacts, test files, build output)
  const agentCoreSrc = path.join(sourceRoot, 'agent-core');
  if (fs.existsSync(agentCoreSrc)) {
    copyDirRecursive(agentCoreSrc, path.join(projectDir, 'agent-core'), (name) => {
      if (AGENT_CORE_SKIP.has(name)) return true;
      if (name.endsWith('.test.ts')) return true;
      return false;
    });
  }

  // Copy project docs (CLAUDE.md, ARCHITECTURE.md)
  for (const doc of ['CLAUDE.md', 'ARCHITECTURE.md']) {
    const docSrc = path.join(sourceRoot, doc);
    if (fs.existsSync(docSrc)) {
      fs.copyFileSync(docSrc, path.join(projectDir, doc));
    }
  }

  // Copy template files
  const templateSrc = path.join(sourceRoot, template.path);
  for (const entry of fs.readdirSync(templateSrc, { withFileTypes: true })) {
    if (SKIP.has(entry.name)) continue;
    const srcPath = path.join(templateSrc, entry.name);
    // Skip symlinks (agent-core is already copied above)
    try { if (fs.lstatSync(srcPath).isSymbolicLink()) continue; } catch { /* proceed */ }
    const destPath = path.join(projectDir, entry.name);

    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }

  // Clean up any leftover workspace references
  cleanupScaffold(projectDir);

  // Merge agent-core deps into the project package.json
  const agentCorePkgPath = path.join(sourceRoot, 'agent-core', 'package.json');
  const projectPkgPath = path.join(projectDir, 'package.json');
  if (fs.existsSync(agentCorePkgPath) && fs.existsSync(projectPkgPath)) {
    const corePkg = JSON.parse(fs.readFileSync(agentCorePkgPath, 'utf-8'));
    const projectPkg = JSON.parse(fs.readFileSync(projectPkgPath, 'utf-8'));
    // Add agent-core runtime deps to the project
    for (const [dep, version] of Object.entries(corePkg.dependencies ?? {})) {
      if (!projectPkg.dependencies?.[dep]) {
        projectPkg.dependencies = projectPkg.dependencies ?? {};
        projectPkg.dependencies[dep] = version;
      }
    }
    // Add agent-core peer deps (optional providers)
    for (const [dep, version] of Object.entries(corePkg.peerDependencies ?? {})) {
      if (!projectPkg.dependencies?.[dep]) {
        projectPkg.dependencies = projectPkg.dependencies ?? {};
        projectPkg.dependencies[dep] = version;
      }
    }
    fs.writeFileSync(projectPkgPath, JSON.stringify(projectPkg, null, 2) + '\n', 'utf-8');
  }

  applyTemplateProviderDefaults(projectDir, template.id, selectedProvider, defaultModelId);
  success(`${template.name} template scaffolded`);

  // Write .env file
  const envFileName = template.envFile ?? '.env';
  const envPath = path.join(projectDir, envFileName);
  fs.writeFileSync(envPath, generateEnvFile(envVars), 'utf-8');
  success(`Created ${envFileName}`);

  // Install dependencies
  if (!skipInstall) {
    info('Installing dependencies...');
    try {
      execSync('npm install', { cwd: projectDir, stdio: 'pipe' });
      success('Dependencies installed');
    } catch {
      warn('npm install failed — run it manually in the project directory');
    }
  }
}
