import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

interface StoredCredentials {
  apiKey?: string;
  apiUrl?: string;
}

function getConfigDir(): string {
  const homeDir = os.homedir();
  switch (os.platform()) {
    case 'darwin':
      return path.join(homeDir, 'Library', 'Application Support', 'firecrawl-cli');
    case 'win32':
      return path.join(homeDir, 'AppData', 'Roaming', 'firecrawl-cli');
    default:
      return path.join(homeDir, '.config', 'firecrawl-cli');
  }
}

export function loadFirecrawlCredentials(): StoredCredentials | null {
  try {
    const credPath = path.join(getConfigDir(), 'credentials.json');
    if (!fs.existsSync(credPath)) return null;
    return JSON.parse(fs.readFileSync(credPath, 'utf-8')) as StoredCredentials;
  } catch {
    return null;
  }
}

export async function resolveFirecrawlApiKey(): Promise<{
  key: string;
  source: 'env' | 'credentials' | 'prompt';
} | null> {
  // 1. Environment variable
  if (process.env.FIRECRAWL_API_KEY) {
    return { key: process.env.FIRECRAWL_API_KEY, source: 'env' };
  }

  // 2. Stored credentials from firecrawl-cli
  const creds = loadFirecrawlCredentials();
  if (creds?.apiKey) {
    return { key: creds.apiKey, source: 'credentials' };
  }

  return null;
}
