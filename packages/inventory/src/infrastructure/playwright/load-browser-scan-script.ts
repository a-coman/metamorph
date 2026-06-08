import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const browserBundlePath = join(
  dirname(fileURLToPath(import.meta.url)),
  'inventory.browser.bundle.js',
);

export function loadBrowserScanScript(): string {
  return readFileSync(browserBundlePath, 'utf8');
}
