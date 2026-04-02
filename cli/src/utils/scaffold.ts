import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import type { TemplateEntry } from './manifest';
import { success, info, warn } from './ui';

const SKIP_DIRS = new Set([
  'node_modules', '.next', '.git', '.DS_Store', 'data', 'tmp',
  'cli', 'sdks', 'examples', 'scripts', 'deploy', 'templates',
  '__tests__', '.firecrawl', '.playwright-mcp',
]);

const NEXTJS_COPY_DIRS = [
  'agent-core', 'app', 'components', 'lib', 'styles', 'public',
];

const NEXTJS_COPY_FILES = [
  'package.json', 'next.config.ts', 'tsconfig.json',
  'tailwind.config.ts', 'postcss.config.js', 'postcss.config.mjs',
];

function getRepoRoot(): string {
  return path.resolve(__dirname, '../../..');
}

function copyDirRecursive(src: string, dest: string): void {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });

  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function rewriteImports(dir: string): void {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      rewriteImports(fullPath);
    } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
      let content = fs.readFileSync(fullPath, 'utf-8');
      const updated = content.replace(
        /from\s+["']\.\.\/\.\.\/agent-core\/src["']/g,
        'from "./agent-core/src"'
      );
      if (updated !== content) {
        fs.writeFileSync(fullPath, updated, 'utf-8');
      }
    }
  }
}

function generateEnvFile(keys: Record<string, string>): string {
  const lines: string[] = [];
  for (const [envVar, value] of Object.entries(keys)) {
    lines.push(`${envVar}=${value}`);
  }
  return lines.join('\n') + '\n';
}

export interface ScaffoldOptions {
  projectDir: string;
  template: TemplateEntry;
  envVars: Record<string, string>;
  skipInstall?: boolean;
}

export async function scaffoldProject(opts: ScaffoldOptions): Promise<void> {
  const { projectDir, template, envVars, skipInstall } = opts;
  const repoRoot = getRepoRoot();

  fs.mkdirSync(projectDir, { recursive: true });

  if (template.copyRoot) {
    scaffoldNextJs(repoRoot, projectDir);
  } else {
    scaffoldStandalone(repoRoot, projectDir, template);
  }

  // Write .env file
  const envFileName = template.copyRoot ? '.env.local' : '.env';
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
  } else {
    info('Skipping npm install (--skip-install)');
  }
}

function scaffoldNextJs(repoRoot: string, projectDir: string): void {
  info('Copying Next.js app...');

  // Copy directories
  for (const dir of NEXTJS_COPY_DIRS) {
    const src = path.join(repoRoot, dir);
    const dest = path.join(projectDir, dir);
    if (fs.existsSync(src)) {
      copyDirRecursive(src, dest);
    }
  }

  // Copy individual files
  for (const file of NEXTJS_COPY_FILES) {
    const src = path.join(repoRoot, file);
    const dest = path.join(projectDir, file);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, dest);
    }
  }

  success('Next.js app scaffolded');
}

function scaffoldStandalone(
  repoRoot: string,
  projectDir: string,
  template: TemplateEntry
): void {
  info(`Copying ${template.name} template...`);

  // Copy agent-core
  const agentCoreSrc = path.join(repoRoot, 'agent-core');
  const agentCoreDest = path.join(projectDir, 'agent-core');
  copyDirRecursive(agentCoreSrc, agentCoreDest);

  // Copy template files
  const templateSrc = path.join(repoRoot, template.path);
  for (const entry of fs.readdirSync(templateSrc, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const srcPath = path.join(templateSrc, entry.name);
    const destPath = path.join(projectDir, entry.name);

    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }

  // Rewrite import paths
  rewriteImports(projectDir);
  success(`${template.name} template scaffolded`);
}
