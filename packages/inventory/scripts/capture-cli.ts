#!/usr/bin/env tsx
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from 'playwright';
import {
  buildPageInventory,
  toPageSnapshotPayload,
} from '../src/index.js';

const args = process.argv.slice(2).filter((arg) => arg !== '--');
const url = args[0] ?? 'https://amazon.es';
const outDir =
  args[1] ?? process.env.INVENTORY_OUT_DIR ?? './tmp/inventory';

async function main() {
  const browser = await chromium.launch({
    headless: process.env.PLAYWRIGHT_HEADLESS !== 'false',
    args: ['--disable-dev-shm-usage'],
  });

  try {
    const inventory = await buildPageInventory(browser, url);
    const payload = toPageSnapshotPayload(inventory);

    await mkdir(outDir, { recursive: true });

    const jsonPath = join(outDir, 'inventory.json');
    const pngPath = join(outDir, 'annotated.png');

    await writeFile(jsonPath, JSON.stringify(payload, null, 2), 'utf8');
    await writeFile(pngPath, inventory.screenshot);

    console.log(
      `Captured ${payload.items.length} elements (${payload.labeledCount} labeled) from ${payload.url}`,
    );
    console.log(`JSON → ${jsonPath}`);
    console.log(`PNG  → ${pngPath}`);
  } finally {
    await browser.close();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
