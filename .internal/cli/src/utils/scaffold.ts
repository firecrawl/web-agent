import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import type { TemplateEntry } from './manifest';
import { getSourceRoot } from './manifest';
import { success, info, warn } from './ui';

const SKIP = new Set([
  'node_modules', '.next', '.git', '.DS_Store', 'README.md',
]);

function copyDirRecursive(src: string, dest: string): void {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });

  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (SKIP.has(entry.name)) continue;
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
    } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx') || entry.name.endsWith('.json')) {
      let content = fs.readFileSync(fullPath, 'utf-8');
      const updated = content.replace(
        /\.\.\/\.\.\/agent-core\/src/g,
        './agent-core/src'
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
    if (value) lines.push(`${envVar}=${value}`);
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
  const sourceRoot = getSourceRoot();

  fs.mkdirSync(projectDir, { recursive: true });

  // Copy agent-core
  const agentCoreSrc = path.join(sourceRoot, 'agent-core');
  if (fs.existsSync(agentCoreSrc)) {
    copyDirRecursive(agentCoreSrc, path.join(projectDir, 'agent-core'));
  }

  // Copy template files
  const templateSrc = path.join(sourceRoot, template.path);
  for (const entry of fs.readdirSync(templateSrc, { withFileTypes: true })) {
    if (SKIP.has(entry.name)) continue;
    const srcPath = path.join(templateSrc, entry.name);
    const destPath = path.join(projectDir, entry.name);

    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }

  // Rewrite ../../agent-core/src to ./agent-core/src
  rewriteImports(projectDir);
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
