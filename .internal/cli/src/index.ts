#!/usr/bin/env node

import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import { createInitCommand } from './commands/init';
import { createDevCommand } from './commands/dev';
import { createDeployCommand } from './commands/deploy';

const pkg = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '../package.json'), 'utf-8')
);

const dim = '\x1b[2m';
const reset = '\x1b[0m';
const bold = '\x1b[1m';

const program = new Command();

program
  .name('firecrawl-agent')
  .description('Scaffold and run Firecrawl Agent projects')
  .version(pkg.version)
  .addHelpText('after', `
${bold}Quick start:${reset}
  ${dim}$${reset} firecrawl-agent create                          ${dim}# interactive wizard${reset}
  ${dim}$${reset} firecrawl-agent create my-app -t express         ${dim}# one-liner, Express API${reset}
  ${dim}$${reset} firecrawl-agent create my-app -t next            ${dim}# one-liner, full Next.js UI${reset}
  ${dim}$${reset} firecrawl-agent create my-app -t library         ${dim}# one-liner, library only${reset}

${bold}With API keys:${reset}
  ${dim}$${reset} firecrawl-agent create my-app -t express --api-key fc-... --key anthropic=sk-...
  ${dim}$${reset} firecrawl-agent create my-app -t next --key openai=sk-... --key google=AIza...

${bold}From external repo:${reset}
  ${dim}$${reset} firecrawl-agent create my-app --from user/repo   ${dim}# GitHub repo with agent-manifest.json${reset}
  ${dim}$${reset} firecrawl-agent create my-app --from ./local-dir ${dim}# local directory${reset}

${bold}After setup:${reset}
  ${dim}$${reset} firecrawl-agent dev my-app                     ${dim}# start dev server${reset}
  ${dim}$${reset} firecrawl-agent deploy my-app                  ${dim}# deploy to Vercel/Railway/Docker${reset}
  ${dim}$${reset} firecrawl-agent deploy my-app -p vercel         ${dim}# deploy directly to Vercel${reset}

${bold}Templates:${reset}
  ${bold}next${reset}      Full Next.js app with chat UI, history, settings
  ${bold}express${reset}   Lightweight API server with /v1/run endpoint
  ${bold}library${reset}   Extensible agent-core for scripts, services, or your own app
`);

program.addCommand(createInitCommand());
program.addCommand(createDevCommand());
program.addCommand(createDeployCommand());

program.parse();
