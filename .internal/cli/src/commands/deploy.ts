import { Command } from 'commander';
import { select } from '@inquirer/prompts';
import * as path from 'path';
import * as fs from 'fs';
import { error, info, success, dim, reset, bold } from '../utils/ui';

interface Platform {
  id: string;
  name: string;
  command: string;
  generate: (projectDir: string, framework: string) => void;
}

function detectFramework(projectDir: string): string {
  const pkg = JSON.parse(fs.readFileSync(path.join(projectDir, 'package.json'), 'utf-8'));
  if (pkg.dependencies?.next) return 'next';
  if (pkg.dependencies?.hono) return 'hono';
  if (pkg.dependencies?.express) return 'express';
  return 'node';
}

const PLATFORMS: Platform[] = [
  {
    id: 'vercel',
    name: 'Vercel',
    command: 'npx vercel',
    generate(projectDir, framework) {
      if (framework === 'next') {
        writeFile(projectDir, 'vercel.json', JSON.stringify({
          $schema: 'https://openapi.vercel.sh/vercel.json',
          framework: 'nextjs',
          functions: { 'app/api/**/*.ts': { maxDuration: 300 } },
        }, null, 2));
      }
    },
  },
  {
    id: 'railway',
    name: 'Railway',
    command: 'railway up',
    generate(projectDir) {
      writeFile(projectDir, 'railway.toml', `[build]
builder = "nixpacks"
buildCommand = "npm run build"

[deploy]
startCommand = "npm start"
healthcheckPath = "/"
restartPolicyType = "on_failure"
restartPolicyMaxRetries = 3
`);
    },
  },
  {
    id: 'docker',
    name: 'Docker',
    command: 'docker build -t firecrawl-agent . && docker run -p 3000:3000 firecrawl-agent',
    generate(projectDir, framework) {
      if (framework === 'next') {
        writeFile(projectDir, 'Dockerfile', `FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
CMD ["node", "server.js"]
`);
      } else {
        writeFile(projectDir, 'Dockerfile', `FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY . .
EXPOSE 3000
ENV PORT=3000
CMD ["npm", "start"]
`);
      }
      writeFile(projectDir, '.dockerignore', `node_modules
.next
.git
*.md
.env*
`);
    },
  },
];

function writeFile(dir: string, name: string, content: string): void {
  fs.writeFileSync(path.join(dir, name), content, 'utf-8');
  success(`Created ${name}`);
}

export function createDeployCommand(): Command {
  return new Command('deploy')
    .description('Deploy your Firecrawl Agent project')
    .argument('[dir]', 'Project directory', '.')
    .option('-p, --platform <platform>', 'Deploy platform (vercel, railway, docker)')
    .addHelpText('after', `
Examples:
  $ firecrawl-agent deploy                  # interactive platform picker
  $ firecrawl-agent deploy my-app           # deploy my-app/
  $ firecrawl-agent deploy -p vercel        # deploy to Vercel
  $ firecrawl-agent deploy -p railway       # deploy to Railway
  $ firecrawl-agent deploy -p docker        # build and run Docker container
`)
    .action(async (dir: string, options: { platform?: string }) => {
      const projectDir = path.resolve(process.cwd(), dir);

      if (!fs.existsSync(path.join(projectDir, 'package.json'))) {
        error(`No package.json found in ${projectDir}`);
        process.exit(1);
      }

      const framework = detectFramework(projectDir);
      let platform: Platform;

      if (options.platform) {
        const found = PLATFORMS.find((p) => p.id === options.platform);
        if (!found) {
          error(`Unknown platform "${options.platform}". Available: ${PLATFORMS.map((p) => p.id).join(', ')}`);
          process.exit(1);
        }
        platform = found;
      } else {
        const id = await select({
          message: 'Where would you like to deploy?',
          choices: PLATFORMS.map((p) => ({ name: p.name, value: p.id })),
        });
        platform = PLATFORMS.find((p) => p.id === id)!;
      }

      platform.generate(projectDir, framework);

      console.log('');
      console.log(`  ${bold}Deploy with:${reset}`);
      console.log(`  ${dim}$${reset} cd ${dir === '.' ? '.' : dir}`);
      console.log(`  ${dim}$${reset} ${platform.command}`);
      console.log('');
      info('Make sure your environment variables are set on the platform.');
    });
}
