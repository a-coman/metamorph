import type { Page } from 'playwright';
import type { InventoryItem } from '@metamorph/core';
import {
  buildA11yInventory,
  type BuildA11yInventoryOptions,
} from './build-a11y-inventory.js';
import { formatFrameLocator } from './parse-locator-chain.js';
import { resolveElementMetadataFromHandle } from './resolve-element-metadata.js';

const MAX_FRAMES = 5;
const MIN_FRAME_SIZE_PX = 150;

function frameIntersectsViewport(
  box: { x: number; y: number; width: number; height: number },
  viewport: { width: number; height: number },
  scroll: { x: number; y: number },
): boolean {
  const left = box.x - scroll.x;
  const top = box.y - scroll.y;
  const right = left + box.width;
  const bottom = top + box.height;
  return !(
    right <= 0 ||
    left >= viewport.width ||
    bottom <= 0 ||
    top >= viewport.height
  );
}

export async function scanFrameInventories(page: Page): Promise<InventoryItem[]> {
  const iframeLocator = page.locator('iframe');
  const iframeCount = await iframeLocator.count();
  if (iframeCount === 0) {
    return [];
  }

  const viewport = page.viewportSize() ?? { width: 1920, height: 1080 };
  const scroll = await page.evaluate(() => ({ x: window.scrollX, y: window.scrollY }));
  const items: InventoryItem[] = [];
  let scanned = 0;

  for (let index = 0; index < iframeCount && scanned < MAX_FRAMES; index += 1) {
    const iframeHandle = await iframeLocator.nth(index).elementHandle();
    if (!iframeHandle) {
      continue;
    }

    try {
      const iframeMetadata = await resolveElementMetadataFromHandle(page, iframeHandle);
      if (!iframeMetadata || iframeMetadata.selectorMatchCount !== 1) {
        continue;
      }

      const box = iframeMetadata.boundingBox;
      if (box.width < MIN_FRAME_SIZE_PX || box.height < MIN_FRAME_SIZE_PX) {
        continue;
      }

      if (!frameIntersectsViewport(box, viewport, scroll)) {
        continue;
      }

      const frame = await iframeHandle.contentFrame();
      if (!frame) {
        continue;
      }

      const snapshot = await frame.locator('body').ariaSnapshot({ mode: 'ai', boxes: true }).catch(() => '');
      if (!snapshot.trim()) {
        continue;
      }

      // Frame element metadata boxes already include the frame's own scroll
      // (frame-document coordinates). Subtract it here so the offset maps
      // client coordinates to page-absolute without double-counting scroll.
      const frameScroll = await frame
        .evaluate(() => ({ x: window.scrollX, y: window.scrollY }))
        .catch(() => ({ x: 0, y: 0 }));

      const framePrefix = formatFrameLocator(iframeMetadata.selector);
      const buildOptions: BuildA11yInventoryOptions = {
        locatorRoot: page,
        locatorChainPrefix: framePrefix,
        boundingBoxOffset: { x: box.x - frameScroll.x, y: box.y - frameScroll.y },
        locatorOnly: true,
      };

      const { items: frameItems } = await buildA11yInventory(frame, snapshot, buildOptions);
      items.push(...frameItems.filter((item) => item.locator && item.locatorMatchCount === 1));
      scanned += 1;
    } finally {
      await iframeHandle.dispose();
    }
  }

  return items;
}
