import { Command } from 'commander';
import { select, password, input } from '@inquirer/prompts';
import * as path from 'path';
import * as fs from 'fs';
import {
  getTemplates, getProviders, getTemplate,
  loadExternalManifest,
} from '../utils/manifest';
import type { ProviderEntry, TemplateEntry } from '../utils/manifest';
import { resolveFirecrawlApiKey } from '../utils/credentials';
import { scaffoldProject } from '../utils/scaffold';
import { printBanner, success, warn, info, dim, reset, green, bold } from '../utils/ui';
import { spawn } from 'child_process';

function resolveSpawnCommand(command: string): string {
  if (process.platform === 'win32' && command === 'npm') {
    return 'npm.cmd';
  }

  return command;
}

interface InitOptions {
  template?: string;
  provider?: string;
  model?: string;
  from?: string;
  apiKey?: string;
  key?: string[];
  skipInstall?: boolean;
}

export function createInitCommand(): Command {
  return new Command('create')
    .aliases(['init'])
    .description('Create a new Firecrawl Agent project')
    .argument('[project-name]', 'Project directory name')
    .option('-t, --template <id>', 'Template (next, express, library)')
    .option('--provider <id>', 'Default model provider (anthropic, openai, google, custom-openai)')
    .option('--model <id>', 'Default model ID')
    .option('--from <source>', 'External repo (user/repo) or local path with agent-manifest.json')
    .option('--api-key <key>', 'Firecrawl API key')
    .option('--key <provider=key>', 'Provider API key (repeatable, e.g. --key anthropic=sk-...)', collect, [])
    .option('--skip-install', 'Skip npm install')
    .addHelpText('after', `
Examples:
  $ firecrawl-agent create                                    # interactive
  $ firecrawl-agent create my-app -t next                     # Next.js with full UI
  $ firecrawl-agent create my-app -t next --provider openai   # choose the default provider
  $ firecrawl-agent create my-app -t express                  # Express API server
  $ firecrawl-agent create my-app -t library                   # library only
  $ firecrawl-agent create my-app -t express --api-key fc-... # with Firecrawl key
  $ firecrawl-agent create my-app -t next --key anthropic=sk-... --key openai=sk-...
  $ firecrawl-agent create my-app --from user/repo            # from external repo
  $ firecrawl-agent create my-app --from ./local-templates    # from local path
`)
    .action(async (projectName: string | undefined, options: InitOptions) => {
      await handleInit(projectName, options);
    });
}

function collect(val: string, acc: string[]): string[] {
  acc.push(val);
  return acc;
}

function getSelectedProvider(
  providers: ProviderEntry[],
  providerId?: string,
): ProviderEntry | undefined {
  return providers.find((provider) => provider.id === providerId);
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

async function handleInit(rawName: string | undefined, options: InitOptions): Promise<void> {
  printBanner();

  // --- Project name: arg > interactive prompt > default ---
  let projectName: string;

  if (rawName) {
    projectName = rawName;
  } else if (process.stdin.isTTY) {
    projectName = (await input({
      message: 'Project name',
      default: 'my-firecrawl-agent',
    })).trim() || 'my-firecrawl-agent';
  } else {
    projectName = 'my-firecrawl-agent';
  }

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

  const availableProviders = getProviders();

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

  let selectedProvider = getSelectedProvider(availableProviders, options.provider);
  if (options.provider && !selectedProvider) {
    warn(`Unknown provider "${options.provider}". Available: ${availableProviders.map((p) => p.id).join(', ')}`);
    process.exit(1);
  }

  if (!selectedProvider) {
    if (process.stdin.isTTY) {
      const providerId = await select({
        message: 'Default model provider',
        choices: availableProviders
          .filter((p) => p.models && p.models.length > 0)
          .map((provider) => ({
            name: `${provider.name}  ${dim}${provider.models[0].name}${reset}`,
            value: provider.id,
          })),
      });
      selectedProvider = getSelectedProvider(availableProviders, providerId)!;
    } else {
      selectedProvider = getSelectedProvider(availableProviders, 'google') ?? availableProviders[0];
    }
  }

  // --- Model selection ---
  let selectedModelId: string;

  if (options.model) {
    selectedModelId = options.model;
  } else if (selectedProvider.id === 'custom-openai') {
    // Custom provider: let user type any model ID
    selectedModelId = (await input({
      message: 'Model ID',
      default: 'gpt-4o',
    })).trim();
  } else if (selectedProvider.models.length > 1 && process.stdin.isTTY) {
    selectedModelId = await select({
      message: 'Default model',
      choices: selectedProvider.models.map((m) => ({
        name: m.name,
        value: m.id,
      })),
    });
  } else {
    selectedModelId = selectedProvider.models[0]?.id ?? 'gpt-4o';
  }

  // --- Custom OpenAI endpoint ---
  let customEndpoint: string | undefined;
  if (selectedProvider.endpointEnvVar && process.stdin.isTTY) {
    customEndpoint = (await input({
      message: `Base URL ${dim}(OpenAI-compatible endpoint)${reset}`,
      default: 'https://api.openai.com/v1',
    })).trim() || undefined;
  }

  // --- Collect all env vars silently ---
  const envVars: Record<string, string> = {};
  const missing = new Set<string>();

  envVars.MODEL_PROVIDER = selectedProvider.id;
  envVars.MODEL_ID = selectedModelId;

  if (selectedProvider.endpointEnvVar && customEndpoint) {
    envVars[selectedProvider.endpointEnvVar] = customEndpoint;
  }

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
  for (const provider of availableProviders) {
    if (!envVars[provider.envVar] && process.env[provider.envVar]) {
      envVars[provider.envVar] = process.env[provider.envVar]!;
    }
  }

  // Prompt for missing required keys when running interactively
  if (!envVars.FIRECRAWL_API_KEY) {
    const key = await password({
      message: `Firecrawl API key ${dim}(https://firecrawl.dev/app/api-keys)${reset}`,
    });
    if (key) {
      envVars.FIRECRAWL_API_KEY = key;
    } else {
      missing.add('FIRECRAWL_API_KEY');
    }
  }

  if (!envVars[selectedProvider.envVar] && process.stdin.isTTY) {
    const key = await password({
      message: `${selectedProvider.name} API key ${dim}(${selectedProvider.hint})${reset}`,
    });
    if (key) {
      envVars[selectedProvider.envVar] = key;
    } else {
      missing.add(selectedProvider.envVar);
    }
  }

  // Track what's missing for the summary
  for (const envVar of template.optionalEnvVars) {
    if (!envVars[envVar]) missing.add(envVar);
  }

  // --- Scaffold ---
  const projectDir = path.resolve(process.cwd(), projectName);
  console.log('');
  info(`Creating a new Firecrawl Agent app in ${projectDir}`);
  console.log('');

  await scaffoldProject({
    projectDir,
    template,
    envVars,
    selectedProvider: selectedProvider.id,
    defaultModelId: envVars.MODEL_ID,
    skipInstall: options.skipInstall,
  });

  // --- Summary ---
  console.log('');
  console.log(`  ${green}${bold}Ready!${reset}  ${projectDir}`);
  console.log('');

  // Show detected keys
  const detected = Object.keys(envVars).filter((k) => /_API_KEY$/.test(k) && envVars[k]);
  if (detected.length > 0) {
    info(`Keys: ${detected.join(', ')}`);
  }
  info(`Default provider: ${selectedProvider.name} (${envVars.MODEL_ID})`);
  if (missing.size > 0) {
    info(`Missing: ${Array.from(missing).join(', ')} ${dim}(add to .env later)${reset}`);
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
    spawn(resolveSpawnCommand(cmd), args, { cwd: projectDir, stdio: 'inherit' });
  } else {
    console.log(`  cd ${projectName} && ${template.devCommand}`);
    console.log('');
  }
}
