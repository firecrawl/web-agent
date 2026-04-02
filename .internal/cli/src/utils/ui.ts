export const orange = '\x1b[38;5;208m';
export const reset = '\x1b[0m';
export const dim = '\x1b[2m';
export const bold = '\x1b[1m';
export const green = '\x1b[32m';
export const red = '\x1b[31m';
export const cyan = '\x1b[36m';
export const yellow = '\x1b[33m';

export function printBanner(): void {
  console.log('');
  console.log(`  ${orange}${bold}firecrawl-agent${reset}`);
  console.log(`  ${dim}AI-powered web research agent${reset}`);
  console.log('');
}

export function step(n: number, label: string): void {
  console.log(`  ${dim}${n}.${reset} ${label}`);
}

export function success(msg: string): void {
  console.log(`  ${green}✓${reset} ${msg}`);
}

export function warn(msg: string): void {
  console.log(`  ${yellow}!${reset} ${msg}`);
}

export function error(msg: string): void {
  console.log(`  ${red}✗${reset} ${msg}`);
}

export function info(msg: string): void {
  console.log(`  ${dim}${msg}${reset}`);
}
