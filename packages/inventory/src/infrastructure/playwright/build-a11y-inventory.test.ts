import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { chromium } from 'playwright';
import {
  buildLocatorFromChain,
  formatGetByRoleLocator,
  parseLocatorSegments,
} from './parse-locator-chain.js';
import { evaluateLocatorChain } from './evaluate-locator-chain.js';
import { buildA11yInventory } from './build-a11y-inventory.js';
import {
  assignInventoryShortIds,
  boxIoU,
  capInventoryItems,
  enrichA11yItemsFromDomItems,
  filterSupplementalDomItems,
  isTier1InventoryItem,
  appendSupplementalDomItems,
} from './merge-inventory-items.js';
import type { InventoryItem } from '@metamorph/core';

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

describe('parseLocatorSegments', () => {
  it('parses getByRole with exact name', () => {
    const segments = parseLocatorSegments(
      'getByRole("button", { name: "Aceptar", exact: true })',
    );
    assert.equal(segments.length, 1);
    assert.equal(segments[0]?.kind, 'getByRole');
  });

  it('parses scoped locator chains', () => {
    const chain =
      'getByRole("dialog", { name: "Cookies", exact: true }).getByRole("button", { name: "Accept", exact: true })';
    assert.equal(parseLocatorSegments(chain).length, 2);
  });

  it('parses nth suffix', () => {
    const chain = 'getByRole("button", { name: "Save", exact: true }).nth(1)';
    assert.equal(parseLocatorSegments(chain).length, 2);
  });

  it('parses getByLabel with exact options', () => {
    const segments = parseLocatorSegments('getByLabel("Email", { exact: true })');
    assert.equal(segments.length, 1);
    assert.equal(segments[0]?.kind, 'getByLabel');
    if (segments[0]?.kind === 'getByLabel') {
      assert.equal(segments[0].label, 'Email');
      assert.equal(segments[0].exact, true);
    }
  });

  it('parses role names containing parentheses and dots', () => {
    const chain =
      'getByRole("button", { name: "1) Accept all", exact: true }).getByRole("link", { name: "See more (details)", exact: true })';
    const segments = parseLocatorSegments(chain);
    assert.equal(segments.length, 2);
    if (segments[0]?.kind === 'getByRole') {
      assert.equal(segments[0].options?.name, '1) Accept all');
    }
  });
});

describe('evaluateLocatorChain', () => {
  it('resolves submit input as button role', async () => {
    await withPage(async (page) => {
      await page.setContent(`
        <form>
          <input id="accept" type="submit" aria-label="Aceptar" value="Aceptar">
        </form>
      `);

      const chain = formatGetByRoleLocator('button', 'Aceptar', { exact: true });
      const locator = evaluateLocatorChain(page, chain);
      assert.equal(await locator.count(), 1);
      assert.equal(await buildLocatorFromChain(page, chain).count(), 1);
    });
  });
});

describe('buildA11yInventory', () => {
  it('builds a Playwright-valid locator for submit cookie accept buttons', async () => {
    await withPage(async (page) => {
      await page.setContent(`
        <div role="dialog" aria-label="Cookies">
          <input id="sp-cc-accept" type="submit" aria-label="Aceptar" value="Aceptar">
        </div>
      `);

      const snapshot = await page.locator('body').ariaSnapshot({ mode: 'ai', boxes: true });
      const { items } = await buildA11yInventory(page, snapshot);

      const accept = items.find((item) => item.ariaLabel === 'Aceptar');
      assert.ok(accept, 'expected Aceptar item in a11y inventory');
      assert.match(accept!.locator ?? '', /getByRole\("button"/);
      assert.equal(accept!.locatorMatchCount, 1);
      assert.equal(accept!.selector, '#sp-cc-accept');
    });
  });

  it('skips stale aria-refs without hanging', async () => {
    await withPage(async (page) => {
      await page.setContent(`
        <main>
          <button id="stays">Keep me</button>
          <button id="vanishes">Remove me</button>
        </main>
      `);

      const snapshot = await page.locator('body').ariaSnapshot({ mode: 'ai', boxes: true });
      await page.evaluate(() => document.getElementById('vanishes')?.remove());

      const start = Date.now();
      const { items, staleRefCount } = await buildA11yInventory(page, snapshot);
      const elapsed = Date.now() - start;

      assert.ok(elapsed < 10_000, `expected fast skip, took ${elapsed}ms`);
      assert.ok(staleRefCount >= 1);
      assert.ok(items.some((item) => item.ariaLabel === 'Keep me'));
      assert.equal(
        items.some((item) => item.ariaLabel === 'Remove me'),
        false,
      );
    });
  });

  it('disambiguates duplicate role/name controls via snapshot box positions', async () => {
    await withPage(async (page) => {
      await page.setContent(`
        <main>
          <button id="save-left" style="position:absolute;left:10px;top:10px;width:80px;height:32px">Save</button>
          <button id="save-right" style="position:absolute;left:200px;top:10px;width:80px;height:32px">Save</button>
        </main>
      `);

      const snapshot = await page.locator('body').ariaSnapshot({ mode: 'ai', boxes: true });
      const { items } = await buildA11yInventory(page, snapshot);

      const saveButtons = items.filter((item) => item.ariaLabel === 'Save');
      assert.equal(saveButtons.length, 2, `expected two Save buttons, got: ${JSON.stringify(items)}`);

      const locators = saveButtons.map((item) => item.locator).sort();
      assert.equal(saveButtons.every((item) => item.locatorMatchCount === 1), true);
      assert.notEqual(locators[0], locators[1]);
      assert.ok(locators.some((chain) => chain?.includes('.nth(0)')));
      assert.ok(locators.some((chain) => chain?.includes('.nth(1)')));

      for (const item of saveButtons) {
        assert.equal(await buildLocatorFromChain(page, item.locator!).count(), 1);
      }
    });
  });
});

describe('parseLocatorSegments frame support', () => {
  it('parses frameLocator and locator segments', () => {
    const chain =
      'frameLocator("#consent-frame").getByRole("button", { name: "Accept", exact: true })';
    const segments = parseLocatorSegments(chain);
    assert.equal(segments.length, 2);
    assert.equal(segments[0]?.kind, 'frameLocator');
    assert.equal(segments[1]?.kind, 'getByRole');
  });

  it('parses frameLocator with css locator fallback', () => {
    const chain = 'frameLocator("#consent-frame").locator("button.accept")';
    assert.equal(parseLocatorSegments(chain).length, 2);
  });
});

describe('merge-inventory-items', () => {
  function item(overrides: Partial<InventoryItem> & Pick<InventoryItem, 'shortId'>): InventoryItem {
    return {
      index: 0,
      locator: null,
      selector: '#x',
      score: 10,
      labelShown: false,
      tagName: 'span',
      id: null,
      role: null,
      name: null,
      ariaLabel: null,
      textPreview: 'Aceptar',
      boundingBox: { x: 290, y: 988, width: 70, height: 30 },
      ...overrides,
    };
  }

  it('filters supplemental DOM items overlapping a11y items', () => {
    const a11y = [
      item({
        shortId: 'E1',
        locator: 'getByRole("button", { name: "Aceptar", exact: true })',
        tagName: 'input',
        role: 'button',
      }),
    ];
    const dom = [
      item({ shortId: 'E35', selector: '#cos-banner span', tagName: 'span' }),
      item({
        shortId: 'E99',
        selector: '#other',
        boundingBox: { x: 10, y: 10, width: 40, height: 20 },
      }),
    ];

    const filtered = filterSupplementalDomItems(dom, a11y);
    assert.equal(filtered.length, 1);
    assert.equal(filtered[0]?.shortId, 'E99');
  });

  it('enriches a11y items with stable selectors from overlapping DOM items', () => {
    const a11y = [
      item({
        shortId: 'E1',
        selector: 'input[aria-label="Aceptar"]',
        locator: 'getByRole("button", { name: "Aceptar", exact: true })',
        locatorMatchCount: 1,
        role: 'button',
        tagName: 'input',
        source: 'a11y',
      }),
    ];
    const dom = [
      item({
        shortId: 'E35',
        selector: '#sp-cc-accept',
        selectorMatchCount: 1,
        tagName: 'input',
        source: 'dom',
      }),
    ];

    const enriched = enrichA11yItemsFromDomItems(a11y, dom);
    assert.equal(enriched.length, 1);
    assert.equal(enriched[0]?.selector, '#sp-cc-accept');
    assert.equal(filterSupplementalDomItems(dom, enriched).length, 0);
  });

  it('appends non-overlapping supplemental DOM items', () => {
    const a11y = [
      item({
        shortId: 'E1',
        locator: 'getByRole("button", { name: "Aceptar", exact: true })',
        source: 'a11y',
      }),
    ];
    const dom = [
      item({
        shortId: 'E99',
        selector: '#other',
        boundingBox: { x: 10, y: 10, width: 40, height: 20 },
        source: 'dom',
      }),
    ];

    const merged = appendSupplementalDomItems(a11y, dom);
    assert.equal(merged.length, 2);
    assert.equal(merged[1]?.source, 'dom');
  });

  it('computes box IoU for near-identical boxes', () => {
    const overlap = boxIoU(
      { x: 290, y: 988, width: 70, height: 30 },
      { x: 289, y: 987, width: 72, height: 32 },
    );
    assert.ok(overlap > 0.8);
  });

  it('keeps large DOM containers that only partially overlap small a11y items', () => {
    const a11y = [
      item({
        shortId: 'E1',
        locator: 'getByRole("link", { name: "De 350 a 600 EUR", exact: true })',
        tagName: 'a',
        role: 'link',
        boundingBox: { x: 10, y: 10, width: 40, height: 20 },
      }),
    ];
    const dom = [
      item({
        shortId: 'E-card',
        selector: '#facet-card',
        tagName: 'div',
        boundingBox: { x: 0, y: 0, width: 200, height: 200 },
      }),
    ];

    const filtered = filterSupplementalDomItems(dom, a11y);
    assert.equal(filtered.length, 1);
    assert.equal(filtered[0]?.shortId, 'E-card');
  });

  it('reassigns shortIds after merge', () => {
    const merged = assignInventoryShortIds([
      item({ shortId: 'E9', index: 9 }),
      item({ shortId: 'E2', index: 2 }),
    ]);
    assert.deepEqual(
      merged.map((entry) => entry.shortId),
      ['E1', 'E2'],
    );
  });

  it('classifies tier1 controls for cap ranking', () => {
    assert.equal(
      isTier1InventoryItem(item({ shortId: 'E1', tagName: 'input', role: 'searchbox' })),
      true,
    );
    assert.equal(
      isTier1InventoryItem(item({ shortId: 'E2', tagName: 'a', role: 'link' })),
      false,
    );
  });

  it('caps merged inventory with tier1 controls before links', () => {
    const tier1 = item({
      shortId: 'E-btn',
      tagName: 'button',
      role: 'button',
      score: 10,
      source: 'a11y',
    });
    const links = Array.from({ length: 10 }, (_, index) =>
      item({
        shortId: `E-link-${index}`,
        tagName: 'a',
        role: 'link',
        score: 100 - index,
        source: 'dom',
      }),
    );

    const capped = capInventoryItems([...links, tier1], 3);
    assert.equal(capped.length, 3);
    assert.equal(capped[0]?.shortId, 'E-btn');
  });

  it('always orders tier1 controls before links even when under cap', () => {
    const tier1 = item({
      shortId: 'E-btn',
      tagName: 'button',
      role: 'button',
      score: 10,
      source: 'a11y',
    });
    const link = item({
      shortId: 'E-link',
      tagName: 'a',
      role: 'link',
      score: 500,
      source: 'dom',
    });

    const ordered = capInventoryItems([link, tier1], 10);
    assert.equal(ordered[0]?.shortId, 'E-btn');
    assert.equal(ordered[1]?.shortId, 'E-link');
  });

  it('prefers a11y source over higher-scoring dom items within the same tier', () => {
    const a11yLink = item({
      shortId: 'E-a11y',
      tagName: 'a',
      role: 'link',
      score: 10,
      source: 'a11y',
    });
    const domLink = item({
      shortId: 'E-dom',
      tagName: 'a',
      role: 'link',
      score: 500,
      source: 'dom',
    });

    const capped = capInventoryItems([domLink, a11yLink], 1);
    assert.equal(capped[0]?.shortId, 'E-a11y');
  });
});
