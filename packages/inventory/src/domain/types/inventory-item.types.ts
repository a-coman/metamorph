import type {
  InventoryItem,
  PageMetrics,
  ViewportSize,
} from '@metamorph/core';

export type { InventoryItem, PageMetrics, ViewportSize };

/** Result of a capture run (includes binary screenshot; not persisted as-is). */
export type PageInventory = {
  url: string;
  capturedAt: string;
  pageMetrics: PageMetrics;
  viewport: ViewportSize;
  items: InventoryItem[];
  screenshot: Buffer;
  labeledCount: number;
};

export type BuildPageInventoryOptions = {
  waitAfterGotoMs?: number;
  waitAfterViewportMs?: number;
  maxCaptureHeight?: number;
  maxItems?: number;
  gotoWaitUntil?: 'load' | 'domcontentloaded' | 'networkidle' | 'commit';
};
