import type { Page } from 'playwright';
import type { PageMetrics, ViewportSize } from '../../domain/types/inventory-item.types.js';
import {
  DEFAULT_CAPTURE_VIEWPORT,
  DEFAULT_MAX_CAPTURE_HEIGHT,
} from './capture-defaults.js';

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
  const viewportSize = page.viewportSize() ?? DEFAULT_CAPTURE_VIEWPORT;
  const captureWidth = Math.min(
    viewportSize.width || DEFAULT_CAPTURE_VIEWPORT.width,
    DEFAULT_CAPTURE_VIEWPORT.width,
  );
  const captureHeight = Math.min(
    pageMetrics.height,
    maxCaptureHeight,
    DEFAULT_CAPTURE_VIEWPORT.height,
  );

  await page.setViewportSize({
    width: captureWidth,
    height: captureHeight,
  });

  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(waitAfterViewportMs);

  return {
    pageMetrics,
    viewport: {
      width: captureWidth,
      height: captureHeight,
    },
  };
}

export async function captureRawScreenshot(page: Page): Promise<Buffer> {
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
