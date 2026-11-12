import { cp, mkdir, rm, access } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const packageRoot = dirname(require.resolve('playwright-core/package.json'));
const source = join(packageRoot, 'lib/vite/traceViewer');
const destination = fileURLToPath(new URL('../public/trace-viewer/', import.meta.url));

for (const name of ['index.html', 'sw.bundle.js', 'snapshot.html']) {
  await access(join(source, name));
}
await mkdir(dirname(destination), { recursive: true });
await rm(destination, { recursive: true, force: true });
await cp(source, destination, { recursive: true });
console.log(`Prepared Playwright ${require('playwright-core/package.json').version} Trace Viewer`);
