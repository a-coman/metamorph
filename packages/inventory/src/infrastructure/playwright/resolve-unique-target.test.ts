import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { chromium } from 'playwright';
import {
  resolveUniqueTargetLocator,
  UniqueTargetResolutionError,
} from './resolve-unique-target.js';

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

describe('resolveUniqueTargetLocator', () => {
  it('falls back to the next candidate when the primary matches nothing', async () => {
    await withPage(async (page) => {
      await page.setContent('<button id="real">Buy now</button>');

      const locator = await resolveUniqueTargetLocator(
        page,
        [
          { kind: 'locator', value: 'getByRole("button", { name: "Renamed", exact: true })' },
          { kind: 'locator', value: 'locator("#real")' },
        ],
        'test target',
        { timeoutMs: 300 },
      );

      assert.equal(await locator.textContent(), 'Buy now');
    });
  });

  it('skips ambiguous candidates in favor of a unique one', async () => {
    await withPage(async (page) => {
      await page.setContent(`
        <button class="cta">Buy</button>
        <button class="cta" id="second">Buy</button>
      `);

      const locator = await resolveUniqueTargetLocator(
        page,
        [
          { kind: 'selector', value: '.cta' },
          { kind: 'selector', value: '#second' },
        ],
        'test target',
        { timeoutMs: 300 },
      );

      assert.equal(await locator.getAttribute('id'), 'second');
    });
  });

  it('throws a descriptive error when no candidate is unique', async () => {
    await withPage(async (page) => {
      await page.setContent('<button class="cta">Buy</button><button class="cta">Buy</button>');

      await assert.rejects(
        resolveUniqueTargetLocator(
          page,
          [
            { kind: 'selector', value: '.cta' },
            { kind: 'locator', value: 'locator("#missing")' },
          ],
          'step 3 (click E7)',
          { timeoutMs: 300 },
        ),
        (error: unknown) => {
          assert.ok(error instanceof UniqueTargetResolutionError);
          assert.match((error as Error).message, /step 3 \(click E7\)/);
          assert.match((error as Error).message, /\.cta -> 2 matches/);
          assert.match((error as Error).message, /#missing.* -> 0 matches/);
          return true;
        },
      );
    });
  });

  it('resolves targets that appear after a short delay', async () => {
    await withPage(async (page) => {
      await page.setContent(`
        <div id="root"></div>
        <script>
          setTimeout(() => {
            const button = document.createElement('button');
            button.id = 'late';
            button.textContent = 'Late button';
            document.getElementById('root').appendChild(button);
          }, 400);
        </script>
      `);

      const locator = await resolveUniqueTargetLocator(
        page,
        [{ kind: 'locator', value: 'locator("#late")' }],
        'late target',
        { timeoutMs: 3000 },
      );

      assert.equal(await locator.textContent(), 'Late button');
    });
  });
});
