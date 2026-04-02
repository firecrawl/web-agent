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

const program = new Command();

program
  .name('firecrawl-agent')
  .description('Scaffold and run Firecrawl Agent projects')
  .version(pkg.version);

program.addCommand(createInitCommand());
program.addCommand(createDevCommand());
program.addCommand(createDeployCommand());

program.parse();
