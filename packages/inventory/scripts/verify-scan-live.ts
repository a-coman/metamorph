import { chromium } from 'playwright';
import { scanAndEnrichCurrentPage } from '../src/infrastructure/playwright/scan-and-enrich-current-page.js';
import { scanInventoryWithAccessibility } from '../src/infrastructure/playwright/scan-inventory-with-accessibility.js';
import { scanObservationInventory } from '../src/infrastructure/playwright/scan-observation-inventory.js';

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.setContent(`
    <main>
      <h1>Results: 1.024 productos</h1>
      <input id="search" type="search" aria-label="Buscar" />
      <button id="go">Buscar ahora</button>
      <a href="/offers">Ofertas (top)</a>
      <select id="sort" aria-label="Ordenar por">
        <option value="relevance">Relevancia</option>
        <option value="price">Precio</option>
      </select>
    </main>
  `);

  const observation = await scanObservationInventory(page, { maxItems: 50 });
  console.log(`observation items: ${observation.length}`);

  const { items, labeledCount } = await scanInventoryWithAccessibility(page, {
    paintLabels: true,
  });
  console.log(`inventory items: ${items.length}, labeled: ${labeledCount}`);
  for (const item of items) {
    console.log(
      `  ${item.shortId} [${item.source}] ${item.role} "${item.name}" locator=${item.locator ?? 'null'} selector=${item.selector}`,
    );
  }

  const enriched = await scanAndEnrichCurrentPage(page, { waitAfterViewportMs: 100 });
  console.log(
    `scanAndEnrich: items=${enriched.items.length} observation=${enriched.observationItems.length} labeled=${enriched.labeledCount} screenshotBytes=${enriched.screenshot.length}`,
  );
  console.log('VERIFY OK');
} finally {
  await browser.close();
}
