import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { chromium } from 'playwright';
import { parseA11ySnapshot } from './a11y-snapshot-lines.js';
import { buildA11yInventory } from './build-a11y-inventory.js';
import { boxIoU } from './merge-inventory-items.js';

async function withPage(run: (page: import('playwright').Page) => Promise<void>) {
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  try {
    browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 800, height: 400 } });
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

describe('a11y snapshot box coordinates', () => {
  it('emits viewport-relative boxes that align with client rects after scrolling', async () => {
    await withPage(async (page) => {
      await page.setContent(`
        <main>
          <div style="height: 1200px"></div>
          <button id="below-fold" style="margin-top: 40px">Below fold action</button>
        </main>
      `);

      await page.evaluate(() => window.scrollTo(0, 900));

      const snapshot = await page.locator('body').ariaSnapshot({ mode: 'ai', boxes: true });
      const buttonLine = parseA11ySnapshot(snapshot).find(
        (line) => line.role === 'button' && line.name === 'Below fold action',
      );
      assert.ok(buttonLine?.box, 'expected button line with box in snapshot');
      assert.ok(buttonLine.ref, 'expected button line with ref in snapshot');

      const clientBox = await page.evaluate(() => {
        const el = document.getElementById('below-fold');
        if (!el) return null;
        const rect = el.getBoundingClientRect();
        return { x: rect.left, y: rect.top, width: rect.width, height: rect.height };
      });

      assert.ok(clientBox);
      const overlap = boxIoU(buttonLine.box, clientBox);
      assert.ok(
        overlap > 0.8,
        `expected snapshot box in client coordinates (IoU ${overlap})`,
      );
    });
  });

  it('promotes scrolled-into-view elements with page-absolute item boxes', async () => {
    await withPage(async (page) => {
      await page.setContent(`
        <main>
          <div style="height: 1200px"></div>
          <button id="below-fold" style="margin-top: 40px">Below fold action</button>
        </main>
      `);

      await page.evaluate(() => window.scrollTo(0, 900));

      const snapshot = await page.locator('body').ariaSnapshot({ mode: 'ai', boxes: true });
      const { items } = await buildA11yInventory(page, snapshot);

      const button = items.find((item) => item.ariaLabel === 'Below fold action');
      assert.ok(button, 'expected scrolled-into-view button in inventory');

      const pageAbsoluteBox = await page.evaluate(() => {
        const el = document.getElementById('below-fold');
        if (!el) return null;
        const rect = el.getBoundingClientRect();
        return {
          x: rect.left + window.scrollX,
          y: rect.top + window.scrollY,
          width: rect.width,
          height: rect.height,
        };
      });

      assert.ok(pageAbsoluteBox);
      const overlap = boxIoU(button.boundingBox, pageAbsoluteBox);
      assert.ok(
        overlap > 0.8,
        `expected page-absolute item bounding box (IoU ${overlap})`,
      );
    });
  });
});
