import { Command } from 'commander';
import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { error, info } from '../utils/ui';

export function createDevCommand(): Command {
  return new Command('dev')
    .description('Start the development server')
    .argument('[dir]', 'Project directory', '.')
    .addHelpText('after', `
Examples:
  $ firecrawl-agent dev                     # run in current directory
  $ firecrawl-agent dev my-app              # run in my-app/
`)
    .action(async (dir: string) => {
      const projectDir = path.resolve(process.cwd(), dir);
      const pkgPath = path.join(projectDir, 'package.json');

      if (!fs.existsSync(pkgPath)) {
        error(`No package.json found in ${projectDir}`);
        process.exit(1);
      }

      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      if (!pkg.scripts?.dev) {
        error('No "dev" script found in package.json');
        process.exit(1);
      }

      info(`Starting dev server in ${dir === '.' ? 'current directory' : dir}...`);
      console.log('');

      const child = spawn('npm', ['run', 'dev'], {
        cwd: projectDir,
        stdio: 'inherit',
        shell: true,
      });

      child.on('exit', (code) => {
        process.exit(code ?? 0);
      });
    });
}
