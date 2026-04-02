import { Command } from 'commander';
import { select, password } from '@inquirer/prompts';
import * as path from 'path';
import * as fs from 'fs';
import {
  getTemplates, getProviders, getTemplate,
  loadExternalManifest,
} from '../utils/manifest';
import type { TemplateEntry } from '../utils/manifest';
import { resolveFirecrawlApiKey } from '../utils/credentials';
import { scaffoldProject } from '../utils/scaffold';
import { printBanner, success, warn, info, dim, reset, green, bold } from '../utils/ui';
import { spawn } from 'child_process';

interface InitOptions {
  template?: string;
  from?: string;
  apiKey?: string;
  key?: string[];
  skipInstall?: boolean;
}

export function createInitCommand(): Command {
  return new Command('init')
    .description('Create a new Firecrawl Agent project')
    .argument('[project-name]', 'Project directory name', 'my-firecrawl-agent')
    .option('-t, --template <id>', 'Template (next, express, hono)')
    .option('--from <source>', 'External repo (user/repo) or local path with agent-manifest.json')
    .option('--api-key <key>', 'Firecrawl API key')
    .option('--key <provider=key>', 'Provider API key (repeatable, e.g. --key anthropic=sk-...)', collect, [])
    .option('--skip-install', 'Skip npm install')
    .addHelpText('after', `
Examples:
  $ firecrawl-agent init                                    # interactive
  $ firecrawl-agent init my-app -t next                     # Next.js with full UI
  $ firecrawl-agent init my-app -t express                  # Express API server
  $ firecrawl-agent init my-app -t hono                     # Hono serverless
  $ firecrawl-agent init my-app -t express --api-key fc-... # with Firecrawl key
  $ firecrawl-agent init my-app -t next --key anthropic=sk-... --key openai=sk-...
  $ firecrawl-agent init my-app --from user/repo            # from external repo
  $ firecrawl-agent init my-app --from ./local-templates    # from local path
`)
    .action(async (projectName: string, options: InitOptions) => {
      await handleInit(projectName, options);
    });
}

function collect(val: string, acc: string[]): string[] {
  acc.push(val);
  return acc;
}

function parseKeyFlags(keys: string[]): Record<string, string> {
  const map: Record<string, string> = {};
  const providerEnvMap: Record<string, string> = {
    anthropic: 'ANTHROPIC_API_KEY',
    openai: 'OPENAI_API_KEY',
    google: 'GOOGLE_GENERATIVE_AI_API_KEY',
    gateway: 'AI_GATEWAY_API_KEY',
  };

  for (const entry of keys) {
    const eq = entry.indexOf('=');
    if (eq === -1) continue;
    const provider = entry.slice(0, eq).toLowerCase();
    const value = entry.slice(eq + 1);
    const envVar = providerEnvMap[provider] ?? provider.toUpperCase();
    map[envVar] = value;
  }
  return map;
}

async function handleInit(projectName: string, options: InitOptions): Promise<void> {
  printBanner();

  // Load external manifest if --from is provided
  if (options.from) {
    try {
      await loadExternalManifest(options.from);
      success(`Loaded manifest from ${options.from}`);
    } catch (err) {
      warn(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
    console.log('');
  }

  // --- Template selection (only interactive prompt if not passed via flag) ---
  const templates = getTemplates();
  let template: TemplateEntry;

  if (options.template) {
    const found = getTemplate(options.template);
    if (!found) {
      warn(`Unknown template "${options.template}". Available: ${templates.map((t) => t.id).join(', ')}`);
      process.exit(1);
    }
    template = found;
  } else {
    const templateId = await select({
      message: 'Template',
      choices: templates.map((t) => ({
        name: `${t.name}  ${dim}${t.description}${reset}`,
        value: t.id,
      })),
    });
    template = getTemplate(templateId)!;
  }

  // --- Collect all env vars silently ---
  const envVars: Record<string, string> = {};
  const missing: string[] = [];

  // Firecrawl API key: flag > env > credentials > prompt
  if (options.apiKey) {
    envVars.FIRECRAWL_API_KEY = options.apiKey;
  } else {
    const resolved = await resolveFirecrawlApiKey();
    if (resolved) {
      envVars.FIRECRAWL_API_KEY = resolved.key;
    }
  }

  // Provider keys from --key flags
  const flagKeys = parseKeyFlags(options.key ?? []);
  Object.assign(envVars, flagKeys);

  // Auto-detect remaining provider keys from environment
  const providers = getProviders();
  for (const provider of providers) {
    if (!envVars[provider.envVar] && process.env[provider.envVar]) {
      envVars[provider.envVar] = process.env[provider.envVar]!;
    }
  }

  // Check if Firecrawl key is still missing — only thing we prompt for
  if (!envVars.FIRECRAWL_API_KEY) {
    const key = await password({
      message: `Firecrawl API key ${dim}(https://firecrawl.dev/app/api-keys)${reset}`,
    });
    if (key) {
      envVars.FIRECRAWL_API_KEY = key;
    } else {
      missing.push('FIRECRAWL_API_KEY');
    }
  }

  // Track what's missing for the summary
  for (const envVar of template.optionalEnvVars) {
    if (!envVars[envVar]) missing.push(envVar);
  }

  // --- Scaffold ---
  const projectDir = path.resolve(process.cwd(), projectName);
  console.log('');

  await scaffoldProject({
    projectDir,
    template,
    envVars,
    skipInstall: options.skipInstall,
  });

  // --- Summary ---
  console.log('');
  console.log(`  ${green}${bold}Ready!${reset}  ${projectDir}`);
  console.log('');

  // Show detected keys
  const detected = Object.keys(envVars).filter((k) => envVars[k]);
  if (detected.length > 0) {
    info(`Keys: ${detected.join(', ')}`);
  }
  if (missing.length > 0) {
    info(`Missing: ${missing.join(', ')} ${dim}(add to .env later)${reset}`);
  }
  console.log('');

  // --- What next? ---
  // Skip prompt entirely if running non-interactively (all flags provided)
  const fullyFlagged = !!(options.template && (options.apiKey || envVars.FIRECRAWL_API_KEY));

  if (fullyFlagged || !process.stdin.isTTY) {
    console.log(`  cd ${projectName} && ${template.devCommand}`);
    console.log('');
    return;
  }

  const action = await select({
    message: 'Next',
    choices: [
      { name: `Start dev server  ${dim}${template.devCommand}${reset}`, value: 'dev' },
      { name: 'Exit', value: 'exit' },
    ],
  });

  if (action === 'dev') {
    console.log('');
    const [cmd, ...args] = template.devCommand.split(' ');
    spawn(cmd, args, { cwd: projectDir, stdio: 'inherit', shell: true });
  } else {
    console.log(`  cd ${projectName} && ${template.devCommand}`);
    console.log('');
  }
}
