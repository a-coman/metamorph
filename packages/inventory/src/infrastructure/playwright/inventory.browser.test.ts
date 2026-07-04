import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { chromium } from 'playwright';
import { scanInventoryWithAccessibility } from './scan-inventory-with-accessibility.js';
import { scanObservationInventory } from './scan-observation-inventory.js';

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

      const { items, labeledCount } = await scanInventoryWithAccessibility(page, {});

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
      });

      assert.equal(items.length, 5);
    });
  });

  it('drops DOM supplements without a unique selector and verifies every item', async () => {
    await withPage(async (page) => {
      // Duplicate ids make the fallback path selector (#dup > span) match both
      // spans. Pointer-cursor spans have no promotable a11y role, so they only
      // enter the inventory as DOM supplements, which must now be verified.
      await page.setContent(`
        <main>
          <button id="real">Real action</button>
          <div id="dup"><span style="cursor:pointer;display:inline-block;padding:8px">Card A</span></div>
          <div id="dup"><span style="cursor:pointer;display:inline-block;padding:8px">Card B</span></div>
        </main>
      `);

      const { items } = await scanInventoryWithAccessibility(page, {});

      const ambiguous = items.filter(
        (item) => item.textPreview === 'Card A' || item.textPreview === 'Card B',
      );
      assert.equal(
        ambiguous.length,
        0,
        `ambiguous supplements should be dropped, got: ${JSON.stringify(ambiguous)}`,
      );

      assert.ok(items.find((item) => item.id === 'real'));
      for (const item of items) {
        assert.ok(
          item.locatorMatchCount === 1 || item.selectorMatchCount === 1,
          `every inventory item must carry a verified target: ${JSON.stringify(item)}`,
        );
        assert.ok(
          (item.candidates?.length ?? 0) > 0,
          `every inventory item must carry candidates: ${JSON.stringify(item)}`,
        );
      }
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

      const { items } = await scanInventoryWithAccessibility(page, {});

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

      const { items } = await scanInventoryWithAccessibility(page, {});

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

      const { items } = await scanInventoryWithAccessibility(page, {});

      const oppo = items.find((item) => item.textPreview === 'OPPO');
      const tcl = items.find((item) => item.textPreview === 'TCL');

      assert.ok(oppo, 'expected OPPO aria-checkbox link in inventory');
      assert.equal(oppo?.role, 'checkbox');
      assert.ok(
        oppo?.score && oppo.score >= 100,
        'expected checkbox to rank at the top of its scoring scale',
      );
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

      const { items } = await scanInventoryWithAccessibility(page, {});

      const oppo = items.find((item) => item.textPreview === 'OPPO');
      const tcl = items.find((item) => item.textPreview === 'TCL');

      assert.ok(oppo, 'expected wrapped OPPO facet link in inventory');
      assert.equal(oppo?.tagName, 'a');
      assert.ok(tcl, 'expected wrapped TCL facet link in inventory');
      assert.equal(tcl?.tagName, 'a');
    });
  });
});

describe('scanObservationInventory', () => {
  it('includes plain text result-count labels excluded from action inventory', async () => {
    await withPage(async (page) => {
      await page.setContent(`
        <main>
          <div class="s-breadcrumb-header-text">1-48 de más de 10.000 resultados</div>
          <a href="/cart">Kit de Compras</a>
          <div style="width:120px;height:120px"></div>
          <script>console.log('noise')</script>
        </main>
      `);

      const [actionItems, observationItems] = await Promise.all([
        await scanInventoryWithAccessibility(page, {}),
        scanObservationInventory(page),
      ]);

      const actionCount = actionItems.items.find((item) =>
        item.textPreview?.includes('10.000 resultados'),
      );
      const observationCount = observationItems.find((item) =>
        item.textPreview?.includes('10.000 resultados'),
      );

      assert.equal(actionCount, undefined, 'action inventory skips plain text divs');
      assert.ok(observationCount, 'observation inventory includes result-count text');
      assert.equal(observationCount?.tagName, 'div');
    });
  });

  it('includes aria-hidden visible result-count labels', async () => {
    await withPage(async (page) => {
      await page.setContent(`
        <main>
          <h1>
            <span aria-hidden="true" data-testid="stays-page-heading">Más de 1.000 alojamientos en Alicante</span>
          </h1>
        </main>
      `);

      const observationItems = await scanObservationInventory(page);
      const heading = observationItems.find((item) =>
        item.textPreview?.includes('1.000 alojamientos'),
      );

      assert.ok(heading, 'observation inventory includes aria-hidden visible count label');
      assert.equal(heading?.tagName, 'span');
    });
  });

  it('prefers innermost node when parent and child share the same text', async () => {
    await withPage(async (page) => {
      await page.setContent(`
        <main>
          <div><span>1-48 de más de 10.000 resultados</span></div>
        </main>
      `);

      const observationItems = await scanObservationInventory(page);
      const matches = observationItems.filter((item) =>
        item.textPreview?.includes('10.000 resultados'),
      );

      assert.equal(matches.length, 1);
      assert.equal(matches[0]?.tagName, 'span');
    });
  });

  it('excludes empty boxes and script nodes', async () => {
    await withPage(async (page) => {
      await page.setContent(`
        <main>
          <div id="empty" style="width:120px;height:120px"></div>
          <script>var x = 1;</script>
          <p>Visible paragraph</p>
        </main>
      `);

      const observationItems = await scanObservationInventory(page);
      const tags = observationItems.map((item) => item.tagName);

      assert.ok(tags.includes('p'));
      assert.equal(tags.includes('script'), false);
      assert.equal(
        observationItems.some((item) => item.id === 'empty'),
        false,
      );
    });
  });

  it('respects finite maxItems cap when provided', async () => {
    await withPage(async (page) => {
      await page.setContent(`
        <main>
          ${Array.from({ length: 30 }, (_, index) => `<p>Line ${index}</p>`).join('')}
        </main>
      `);

      const observationItems = await scanObservationInventory(page, { maxItems: 5 });
      assert.equal(observationItems.length, 5);
    });
  });

  it('skips elements that throw during observation scan without failing the job', async () => {
    await withPage(async (page) => {
      await page.setContent(`
        <main>
          <p id="good">Visible observation text</p>
        </main>
      `);

      await page.evaluate(() => {
        const poison = document.createElement('div');
        poison.id = 'poison';
        poison.textContent = 'Poison observation text';
        poison.style.width = '120px';
        poison.style.height = '32px';
        Object.defineProperty(poison, 'tagName', {
          get: () => undefined as unknown as string,
        });
        document.body.appendChild(poison);
      });

      const observationItems = await scanObservationInventory(page);
      const good = observationItems.find((item) => item.id === 'good');
      const poison = observationItems.find((item) =>
        item.textPreview?.includes('Poison observation text'),
      );

      assert.ok(good, 'expected valid observation target in inventory');
      assert.equal(poison, undefined, 'poison element must be skipped');
    });
  });
});
