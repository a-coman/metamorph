import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { chromium } from 'playwright';
import { buildLocatorFromChain } from './parse-locator-chain.js';
import { scanFrameInventories } from './scan-frame-inventories.js';
import { scanInventoryWithAccessibility } from './scan-inventory-with-accessibility.js';

async function withPage(run: (page: import('playwright').Page) => Promise<void>) {
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  try {
    browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
    await run(page);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("Executable doesn't exist")) {
      return;
    }
    throw error;
  } finally {
    await browser?.close();
  }
}

describe('scanFrameInventories', () => {
  it('discovers consent buttons inside a visible iframe', async () => {
    await withPage(async (page) => {
      await page.setContent(`
        <main>
          <iframe
            id="consent-frame"
            title="Cookie consent"
            style="position:fixed;left:40px;top:40px;width:320px;height:220px;border:1px solid #ccc"
            srcdoc="<html><body><button id='accept'>Accept all cookies</button></body></html>"
          ></iframe>
        </main>
      `);

      await page.waitForTimeout(200);

      const frameItems = await scanFrameInventories(page);
      const accept = frameItems.find((item) => item.ariaLabel === 'Accept all cookies');

      assert.ok(accept, `expected iframe button, got: ${JSON.stringify(frameItems)}`);
      assert.match(accept!.locator ?? '', /^frameLocator\(/);
      assert.equal(accept!.locatorMatchCount, 1);
      assert.ok((accept!.boundingBox?.y ?? 0) >= 35);

      const locator = buildLocatorFromChain(page, accept!.locator!);
      assert.equal(await locator.count(), 1);
    });
  });

  it('maps scrolled frame content to page-absolute coordinates without double-counting scroll', async () => {
    await withPage(async (page) => {
      await page.setContent(`
        <main>
          <iframe
            id="scroll-frame"
            title="Scrollable content"
            style="position:fixed;left:40px;top:40px;width:320px;height:220px;border:0"
            srcdoc="<html><body style='margin:0'><div style='height:500px'></div><button id='deep'>Deep button</button></body></html>"
          ></iframe>
        </main>
      `);

      await page.waitForTimeout(200);
      await page
        .frameLocator('#scroll-frame')
        .locator('body')
        .evaluate(() => window.scrollTo(0, 500));
      await page.waitForTimeout(100);

      const frameItems = await scanFrameInventories(page);
      const deep = frameItems.find((item) => item.ariaLabel === 'Deep button');

      assert.ok(deep, `expected scrolled frame button, got: ${JSON.stringify(frameItems)}`);

      // The button sits at the bottom of the scrolled frame viewport, roughly
      // iframe top (40) plus client offset (~198). The old double-offset bug
      // would report ~540 (frame document coordinate plus iframe offset).
      const y = deep!.boundingBox?.y ?? 0;
      assert.ok(y > 180 && y < 300, `expected page-absolute y near 238, got ${y}`);
    });
  });
});

describe('scanInventoryWithAccessibility frame integration', () => {
  it('includes iframe controls in merged inventory', async () => {
    await withPage(async (page) => {
      await page.setContent(`
        <main>
          <button id="main-btn">Main action</button>
          <iframe
            id="consent-frame"
            title="Cookie consent"
            style="position:fixed;left:40px;top:40px;width:320px;height:220px;border:1px solid #ccc"
            srcdoc="<html><body><button id='accept'>Accept all cookies</button></body></html>"
          ></iframe>
        </main>
      `);

      await page.waitForTimeout(200);

      const { items } = await scanInventoryWithAccessibility(page);
      const accept = items.find((item) => item.ariaLabel === 'Accept all cookies');
      const main = items.find((item) => item.textPreview === 'Main action');

      assert.ok(main);
      assert.ok(accept, `expected iframe accept in merged inventory: ${items.map((i) => i.ariaLabel).join(', ')}`);
      assert.match(accept!.locator ?? '', /^frameLocator\(/);
    });
  });

  it('keeps main-page items that visually overlap a frame item', async () => {
    await withPage(async (page) => {
      await page.setContent(`
        <main>
          <a
            id="overlay-link"
            href="/promo"
            style="position:fixed;left:40px;top:40px;width:320px;height:220px;display:block;z-index:10"
          >Promo overlay</a>
          <iframe
            id="consent-frame"
            title="Cookie consent"
            style="position:fixed;left:40px;top:40px;width:320px;height:220px;border:0"
            srcdoc="<html><body style='margin:0'><button id='accept' style='width:100%;height:100vh;display:block'>Accept all cookies</button></body></html>"
          ></iframe>
        </main>
      `);

      await page.waitForTimeout(200);

      const { items } = await scanInventoryWithAccessibility(page);
      const overlay = items.find((item) => item.id === 'overlay-link');
      const accept = items.find((item) => item.ariaLabel === 'Accept all cookies');

      assert.ok(accept, 'expected frame button in inventory');
      assert.ok(
        overlay,
        `main-page overlay must not be suppressed by the overlapping frame item: ${items
          .map((item) => item.id ?? item.ariaLabel)
          .join(', ')}`,
      );
      assert.match(accept!.locator ?? '', /^frameLocator\(/);
      assert.doesNotMatch(accept!.selector, /overlay-link/);
    });
  });
});
