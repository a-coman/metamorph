import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { chromium } from 'playwright';
import type { InventoryItem } from '@metamorph/core';
import {
  buildA11yLocator,
  findMatchedA11yLineIndices,
  isPromotableA11yLine,
  parseA11yLine,
  parseA11ySnapshot,
  scoreA11yLineAgainstItem,
} from './a11y-snapshot-lines.js';

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

describe('parseA11yLine', () => {
  it('parses role names containing escaped double quotes', () => {
    const line = parseA11yLine('- button "Say \\"hello\\"" [ref=e1]', 0);
    assert.ok(line);
    assert.equal(line.role, 'button');
    assert.equal(line.name, 'Say "hello"');
    assert.equal(line.ref, 'e1');
  });

  it('builds getByRole locators from parsed lines', () => {
    const line = parseA11ySnapshot(`- link "HUAWEI"`)[0]!;
    assert.equal(
      buildA11yLocator(line),
      'getByRole("link", { name: "HUAWEI" })',
    );
    assert.equal(isPromotableA11yLine(line), true);
  });
});

describe('scoreA11yLineAgainstItem scroll offset', () => {
  it('matches viewport-relative line boxes when scroll offset is provided', () => {
    const item: InventoryItem = {
      index: 0,
      shortId: 'E1',
      locator: null,
      selector: '#btn',
      score: 10,
      labelShown: false,
      tagName: 'button',
      id: 'btn',
      role: 'button',
      name: 'Unrelated label',
      ariaLabel: null,
      textPreview: null,
      boundingBox: { x: 8, y: 1240, width: 69, height: 21 },
    };

    const line = parseA11ySnapshot(
      `- button "Below fold action" [box=8,40,69,21]`,
    )[0]!;

    const withoutOffset = scoreA11yLineAgainstItem(item, line);
    const withOffset = scoreA11yLineAgainstItem(item, line, { x: 0, y: 1200 });

    assert.ok(withoutOffset < 50);
    assert.ok(withOffset >= 50);
  });

  it('findMatchedA11yLineIndices honors scroll offset', () => {
    const snapshot = `- button "Below fold action" [box=8,40,69,21]`;
    const items: InventoryItem[] = [
      {
        index: 0,
        shortId: 'E1',
        locator: null,
        selector: '#btn',
        score: 10,
        labelShown: false,
        tagName: 'button',
        id: 'btn',
        role: 'button',
        name: 'Unrelated label',
        ariaLabel: null,
        textPreview: null,
        boundingBox: { x: 8, y: 1240, width: 69, height: 21 },
      },
    ];

    const withoutOffset = findMatchedA11yLineIndices(snapshot, items);
    const withOffset = findMatchedA11yLineIndices(snapshot, items, {
      scrollOffset: { x: 0, y: 1200 },
    });

    assert.equal(withoutOffset.size, 0);
    assert.equal(withOffset.size, 1);
  });
});

describe('parseA11yLine with live ariaSnapshot', () => {
  it('preserves accessible names containing double quotes from Playwright output', async () => {
    await withPage(async (page) => {
      await page.setContent(`
        <button aria-label='Say "hello"'>Click</button>
      `);

      const snapshot = await page.locator('body').ariaSnapshot({ mode: 'ai', boxes: true });
      const buttonLine = parseA11ySnapshot(snapshot).find((line) => line.role === 'button');
      assert.ok(buttonLine, `expected button line in snapshot:\n${snapshot}`);
      assert.equal(buttonLine.name, 'Say "hello"');
      assert.equal(isPromotableA11yLine(buttonLine), true);
    });
  });
});
