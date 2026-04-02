import { Command } from 'commander';
import { select } from '@inquirer/prompts';
import * as path from 'path';
import * as fs from 'fs';
import { getDeployPlatforms } from '../utils/manifest';
import type { DeployPlatformEntry } from '../utils/manifest';
import { error, info, success, dim, reset, bold } from '../utils/ui';

export function createDeployCommand(): Command {
  return new Command('deploy')
    .description('Deploy your Firecrawl Agent project')
    .argument('[dir]', 'Project directory', '.')
    .option('-p, --platform <platform>', 'Deploy platform (vercel, railway, docker)')
    .action(async (dir: string, options: { platform?: string }) => {
      const projectDir = path.resolve(process.cwd(), dir);

      if (!fs.existsSync(path.join(projectDir, 'package.json'))) {
        error(`No package.json found in ${projectDir}`);
        process.exit(1);
      }

      const platforms = getDeployPlatforms();
      let platform: DeployPlatformEntry;

      if (options.platform) {
        const found = platforms.find((p) => p.id === options.platform);
        if (!found) {
          error(`Unknown platform "${options.platform}". Available: ${platforms.map((p) => p.id).join(', ')}`);
          process.exit(1);
        }
        platform = found;
      } else {
        const id = await select({
          message: 'Where would you like to deploy?',
          choices: platforms.map((p) => ({
            name: p.name,
            value: p.id,
          })),
        });
        platform = platforms.find((p) => p.id === id)!;
      }

      // Copy deploy config if it exists in the repo
      const repoRoot = path.resolve(__dirname, '../../..');
      const configSrc = path.join(repoRoot, platform.configPath);
      if (fs.existsSync(configSrc)) {
        for (const file of fs.readdirSync(configSrc)) {
          if (file === 'README.md') continue;
          const src = path.join(configSrc, file);
          const dest = path.join(projectDir, file);
          if (fs.statSync(src).isFile()) {
            fs.copyFileSync(src, dest);
            success(`Copied ${file}`);
          }
        }
      }

      console.log('');
      console.log(`  ${bold}Deploy with:${reset}`);
      console.log(`  ${dim}$${reset} cd ${dir === '.' ? '.' : dir}`);
      console.log(`  ${dim}$${reset} ${platform.command}`);
      console.log('');
      info('Make sure your environment variables are set on the platform.');
    });
}
