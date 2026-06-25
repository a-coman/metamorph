import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { chromium } from 'playwright';
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

describe('scanInventoryWithAccessibility', () => {
  it('includes viewport select with options and excludes below-fold links', async () => {
    await withPage(async (page) => {
      const links = Array.from({ length: 120 }, (_, index) => {
        const top = 700 + index * 30;
        return `<a href="/p${index}" style="display:block;margin-top:${top}px">Product ${index}</a>`;
      }).join('');

      await page.setContent(`
        <main>
          <input id="search" type="search" aria-label="Search" />
          <select id="sort" aria-label="Ordenar por">
            <option value="relevance">Relevancia</option>
            <option value="price-asc">Precio: menor a mayor</option>
          </select>
          ${links}
        </main>
      `);

      const { items, labeledCount } = await scanInventoryWithAccessibility(page, {
        paintLabels: false,
      });

      const sortItem = items.find((item) => item.tagName === 'select');
      assert.ok(sortItem, 'expected select in viewport inventory');
      assert.deepEqual(sortItem.options, [
        { value: 'relevance', label: 'Relevancia' },
        { value: 'price-asc', label: 'Precio: menor a mayor' },
      ]);

      const searchItem = items.find((item) => item.role === 'searchbox' || item.id === 'search');
      assert.ok(searchItem, 'expected search input in inventory');

      const belowFoldLink = items.find((item) => item.textPreview?.startsWith('Product 50'));
      assert.equal(belowFoldLink, undefined, 'below-fold links should be excluded');

      assert.equal(labeledCount, 0);
      assert.ok(items.length < 120, 'should not include all off-screen product links');
    });
  });

  it('respects finite maxItems cap when provided', async () => {
    await withPage(async (page) => {
      await page.setContent(`
        <main>
          ${Array.from({ length: 20 }, (_, index) => `<button id="b${index}">Btn ${index}</button>`).join('')}
        </main>
      `);

      const { items } = await scanInventoryWithAccessibility(page, {
        maxItems: 5,
        paintLabels: false,
      });

      assert.equal(items.length, 5);
    });
  });

  it('includes visible labels for hidden checkbox facets', async () => {
    await withPage(async (page) => {
      await page.setContent(`
        <aside>
          <h3>Marcas</h3>
          <input type="checkbox" id="brand-xiaomi" style="opacity:0;position:absolute;width:1px;height:1px">
          <label for="brand-xiaomi">XIAOMI</label>
          <label><input type="checkbox" style="opacity:0;width:1px;height:1px;position:absolute"> Sony</label>
        </aside>
      `);

      const { items } = await scanInventoryWithAccessibility(page, {
        paintLabels: false,
      });

      const xiaomi = items.find(
        (item) => item.role === 'checkbox' && item.textPreview === 'XIAOMI',
      );
      const sony = items.find(
        (item) => item.role === 'checkbox' && item.textPreview === 'Sony',
      );

      assert.ok(xiaomi, 'expected XIAOMI checkbox label in inventory');
      assert.equal(xiaomi?.tagName, 'label');
      assert.ok(sony, 'expected Sony checkbox label in inventory');
      assert.equal(sony?.tagName, 'label');

      const hiddenInputs = items.filter(
        (item) => item.tagName === 'input' && item.role === 'checkbox',
      );
      assert.equal(hiddenInputs.length, 0, 'hidden checkbox inputs should be skipped');
    });
  });

  it('includes facet brands inside scrollable overflow containers', async () => {
    await withPage(async (page) => {
      const brands = ['Lenovo', 'Samsung', 'XIAOMI', 'Apple', 'OPPO', 'TCL', 'HONOR'];
      const rows = brands
        .map(
          (brand) => `
          <li>
            <label>
              <input type="checkbox" style="opacity:0;position:absolute;width:1px;height:1px">
              <span>${brand}</span>
            </label>
          </li>`,
        )
        .join('');

      await page.setContent(`
        <aside style="width:220px;padding:8px">
          <h3>Marcas</h3>
          <div style="max-height:220px;overflow:auto;border:1px solid #ccc">
            <ul style="margin:0;padding:0;list-style:none">${rows}</ul>
          </div>
        </aside>
      `);

      const { items } = await scanInventoryWithAccessibility(page, {
        paintLabels: false,
      });

      for (const brand of ['OPPO', 'TCL', 'HONOR']) {
        const facet = items.find(
          (item) => item.role === 'checkbox' && item.textPreview === brand,
        );
        assert.ok(facet, `expected ${brand} facet checkbox in inventory`);
        assert.equal(facet?.tagName, 'label');
      }
    });
  });

  it('includes aria checkbox links used by filter sidebars', async () => {
    await withPage(async (page) => {
      await page.setContent(`
        <aside>
          <a role="checkbox" aria-checked="false" aria-label="Apply OPPO filter" href="/filter/oppo">OPPO</a>
          <a role="checkbox" aria-checked="false" aria-label="Apply TCL filter" href="/filter/tcl">TCL</a>
        </aside>
      `);

      const { items } = await scanInventoryWithAccessibility(page, {
        paintLabels: false,
      });

      const oppo = items.find((item) => item.textPreview === 'OPPO');
      const tcl = items.find((item) => item.textPreview === 'TCL');

      assert.ok(oppo, 'expected OPPO aria-checkbox link in inventory');
      assert.equal(oppo?.role, 'checkbox');
      assert.ok(oppo?.score && oppo.score > 100, 'expected filter-panel choice score boost');
      assert.ok(tcl, 'expected TCL aria-checkbox link in inventory');
      assert.equal(tcl?.role, 'checkbox');
    });
  });

  it('includes wrapped facet links that contain hidden checkbox inputs', async () => {
    await withPage(async (page) => {
      await page.setContent(`
        <aside>
          <ul>
            <li>
              <a href="/filter/oppo">
                <input type="checkbox" style="opacity:0;position:absolute;width:1px;height:1px">
                <span>OPPO</span>
              </a>
            </li>
            <li>
              <a href="/filter/tcl">
                <input type="checkbox" style="opacity:0;position:absolute;width:1px;height:1px">
                <span>TCL</span>
              </a>
            </li>
          </ul>
        </aside>
      `);

      const { items } = await scanInventoryWithAccessibility(page, {
        paintLabels: false,
      });

      const oppo = items.find((item) => item.textPreview === 'OPPO');
      const tcl = items.find((item) => item.textPreview === 'TCL');

      assert.ok(oppo, 'expected wrapped OPPO facet link in inventory');
      assert.equal(oppo?.tagName, 'a');
      assert.ok(tcl, 'expected wrapped TCL facet link in inventory');
      assert.equal(tcl?.tagName, 'a');
    });
  });
});
