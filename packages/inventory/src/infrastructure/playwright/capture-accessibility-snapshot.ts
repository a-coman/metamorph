import type { Page } from 'playwright';

/**
 * Captures the page accessibility tree before DOM overlays are painted.
 * Returns empty string on failure so capture can continue without a11y enrichment.
 */
export async function captureAccessibilitySnapshot(page: Page): Promise<string> {
  try {
    return await page.locator('body').ariaSnapshot({ mode: 'ai', boxes: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[inventory] ariaSnapshot failed: ${message}`);
    return '';
  }
}
