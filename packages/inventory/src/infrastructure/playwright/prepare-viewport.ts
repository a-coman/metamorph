import type { Page } from 'playwright';
import type { PageMetrics, ViewportSize } from '../../domain/types/inventory-item.types.js';

const DEFAULT_MAX_CAPTURE_HEIGHT = 4_000;

export type PreparedViewport = {
  pageMetrics: PageMetrics;
  viewport: ViewportSize;
};

export async function readPageMetrics(page: Page): Promise<PageMetrics> {
  return page.evaluate(() => ({
    width: Math.max(
      document.documentElement.scrollWidth,
      document.body.scrollWidth,
      window.innerWidth,
    ),
    height: Math.max(
      document.documentElement.scrollHeight,
      document.body.scrollHeight,
      window.innerHeight,
    ),
  }));
}

export async function prepareCaptureViewport(
  page: Page,
  maxCaptureHeight = DEFAULT_MAX_CAPTURE_HEIGHT,
  waitAfterViewportMs = 500,
): Promise<PreparedViewport> {
  const pageMetrics = await readPageMetrics(page);
  const viewportSize = page.viewportSize() ?? { width: 1280, height: 720 };
  const captureHeight = Math.min(pageMetrics.height, maxCaptureHeight);

  await page.setViewportSize({
    width: viewportSize.width || 1280,
    height: captureHeight,
  });

  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(waitAfterViewportMs);

  return {
    pageMetrics,
    viewport: {
      width: viewportSize.width || 1280,
      height: captureHeight,
    },
  };
}

export async function captureAnnotatedScreenshot(page: Page): Promise<Buffer> {
  const viewport = page.viewportSize();
  return page.screenshot({
    fullPage: false,
    animations: 'disabled',
    type: 'png',
    clip: viewport
      ? { x: 0, y: 0, width: viewport.width, height: viewport.height }
      : undefined,
  });
}
