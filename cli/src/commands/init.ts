import { Command } from 'commander';
import { select, checkbox, input, password } from '@inquirer/prompts';
import * as path from 'path';
import * as fs from 'fs';
import { getTemplates, getProviders, getTemplate } from '../utils/manifest';
import type { TemplateEntry, ProviderEntry } from '../utils/manifest';
import { resolveFirecrawlApiKey } from '../utils/credentials';
import { scaffoldProject } from '../utils/scaffold';
import { printBanner, step, success, warn, info, dim, reset, green, orange, bold, cyan } from '../utils/ui';
import { spawn } from 'child_process';

interface InitOptions {
  template?: string;
  yes?: boolean;
  skipInstall?: boolean;
}

export function createInitCommand(): Command {
  return new Command('init')
    .description('Create a new Firecrawl Agent project')
    .argument('[project-name]', 'Project directory name')
    .option('-t, --template <id>', 'Template to use (next, express, hono)')
    .option('-y, --yes', 'Skip prompts and use defaults')
    .option('--skip-install', 'Skip npm install')
    .action(async (projectName: string | undefined, options: InitOptions) => {
      await handleInit(projectName, options);
    });
}

async function handleInit(projectName: string | undefined, options: InitOptions): Promise<void> {
  printBanner();

  // Step 1: Project name
  step(1, 'Project name');
  const name = projectName ?? (options.yes
    ? 'my-firecrawl-agent'
    : await input({
        message: 'What is your project called?',
        default: 'my-firecrawl-agent',
        validate: (val) => {
          if (!val.trim()) return 'Project name cannot be empty';
          if (/\s/.test(val)) return 'Project name cannot contain spaces';
          return true;
        },
      }));

  const projectDir = path.resolve(process.cwd(), name);
  if (fs.existsSync(projectDir)) {
    warn(`Directory ${name} already exists`);
    const overwrite = options.yes || await select({
      message: 'Directory exists. Continue anyway?',
      choices: [
        { name: 'Yes, continue', value: true },
        { name: 'No, cancel', value: false },
      ],
    });
    if (!overwrite) {
      process.exit(0);
    }
  }
  console.log('');

  // Step 2: Template selection
  step(2, 'Template');
  const templates = getTemplates();
  let template: TemplateEntry;

  if (options.template) {
    const found = getTemplate(options.template);
    if (!found) {
      warn(`Unknown template "${options.template}". Available: ${templates.map((t) => t.id).join(', ')}`);
      process.exit(1);
    }
    template = found;
    success(`Using ${template.name}`);
  } else if (options.yes) {
    template = templates.find((t) => t.id === 'express')!;
    success(`Using ${template.name} (default)`);
  } else {
    const templateId = await select({
      message: 'Which template would you like?',
      choices: templates.map((t) => ({
        name: `${t.name}  ${dim}${t.description}${reset}`,
        value: t.id,
      })),
    });
    template = getTemplate(templateId)!;
  }
  console.log('');

  // Step 3: Firecrawl API key
  step(3, 'Firecrawl API key');
  const envVars: Record<string, string> = {};

  const resolved = await resolveFirecrawlApiKey();
  if (resolved) {
    const sourceLabel = resolved.source === 'env'
      ? 'environment variable'
      : 'firecrawl-cli credentials';
    success(`Found Firecrawl API key from ${sourceLabel}`);
    envVars.FIRECRAWL_API_KEY = resolved.key;
  } else if (options.yes) {
    warn('No Firecrawl API key found — add FIRECRAWL_API_KEY to your .env later');
    envVars.FIRECRAWL_API_KEY = '';
  } else {
    const key = await password({
      message: `Enter your Firecrawl API key ${dim}(https://firecrawl.dev/app/api-keys)${reset}:`,
    });
    if (key) {
      envVars.FIRECRAWL_API_KEY = key;
      success('Firecrawl API key saved');
    } else {
      warn('No key entered — add FIRECRAWL_API_KEY to your .env later');
      envVars.FIRECRAWL_API_KEY = '';
    }
  }
  console.log('');

  // Step 4: Provider selection
  step(4, 'LLM providers');
  const providers = getProviders();
  const allOptionalVars = [...template.optionalEnvVars];

  // Filter to providers that are relevant for this template
  const relevantProviders = providers.filter((p) =>
    allOptionalVars.includes(p.envVar)
  );

  let selectedProviders: ProviderEntry[] = [];

  if (options.yes) {
    // In --yes mode, auto-detect providers from env
    selectedProviders = relevantProviders.filter((p) => process.env[p.envVar]);
    if (selectedProviders.length > 0) {
      success(`Detected ${selectedProviders.map((p) => p.name).join(', ')} from environment`);
    } else {
      info('No provider keys detected — you can add them to .env later');
    }
  } else if (relevantProviders.length > 0) {
    const selected = await checkbox({
      message: 'Select LLM providers to configure:',
      choices: relevantProviders.map((p) => ({
        name: `${p.name}${process.env[p.envVar] ? ` ${green}(detected)${reset}` : ''}`,
        value: p.id,
        checked: !!process.env[p.envVar],
      })),
    });
    selectedProviders = relevantProviders.filter((p) => selected.includes(p.id));
  }
  console.log('');

  // Step 5: Provider API keys
  if (selectedProviders.length > 0) {
    step(5, 'API keys');
    for (const provider of selectedProviders) {
      const existingKey = process.env[provider.envVar];
      if (existingKey) {
        envVars[provider.envVar] = existingKey;
        success(`${provider.name}: using environment variable`);
      } else {
        const key = await password({
          message: `${provider.name} API key ${dim}(${provider.hint})${reset}:`,
        });
        if (key) {
          envVars[provider.envVar] = key;
          success(`${provider.name}: saved`);
        } else {
          info(`${provider.name}: skipped — add ${provider.envVar} to .env later`);
        }
      }
    }
    console.log('');
  }

  // Step 6: Scaffold
  const scaffoldStep = selectedProviders.length > 0 ? 6 : 5;
  step(scaffoldStep, 'Scaffolding project');
  await scaffoldProject({
    projectDir,
    template,
    envVars,
    skipInstall: options.skipInstall,
  });
  console.log('');

  // Step 7: Post-setup
  console.log(`  ${green}${bold}Project ready!${reset}  ${dim}${projectDir}${reset}`);
  console.log('');

  if (options.yes) {
    printNextSteps(name, template);
    return;
  }

  const action = await select({
    message: 'What would you like to do next?',
    choices: [
      { name: 'Start development server', value: 'dev' },
      { name: 'Just exit — I\'ll take it from here', value: 'exit' },
    ],
  });

  if (action === 'dev') {
    console.log('');
    info(`Starting ${template.devCommand}...`);
    console.log('');
    const [cmd, ...args] = template.devCommand.split(' ');
    const child = spawn(cmd, args, {
      cwd: projectDir,
      stdio: 'inherit',
      shell: true,
    });
    child.on('error', () => {
      warn(`Failed to start dev server. Run manually: cd ${name} && ${template.devCommand}`);
    });
  } else {
    printNextSteps(name, template);
  }
}

function printNextSteps(name: string, template: TemplateEntry): void {
  console.log(`  ${dim}Next steps:${reset}`);
  console.log(`    cd ${name}`);
  console.log(`    ${template.devCommand}`);
  console.log('');
}
