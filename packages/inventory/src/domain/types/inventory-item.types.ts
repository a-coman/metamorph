import type {
  InventoryItem,
  PageMetrics,
  ViewportSize,
} from '@metamorph/core';

export type { InventoryItem, PageMetrics, ViewportSize };

/** Result of a capture run (includes binary screenshots; not persisted as-is). */
export type PageInventory = {
  url: string;
  capturedAt: string;
  pageMetrics: PageMetrics;
  viewport: ViewportSize;
  items: InventoryItem[];
  /** Required for initial discover capture; optional for probe snapshots. */
  rawScreenshot?: Buffer;
  screenshot: Buffer;
  labeledCount: number;
  accessibilitySnapshot?: string;
  accessibilityTreeAnnotated?: string;
};

export type BuildPageInventoryOptions = {
  waitAfterGotoMs?: number;
  waitAfterViewportMs?: number;
  maxCaptureHeight?: number;
  maxItems?: number;
  gotoWaitUntil?: 'load' | 'domcontentloaded' | 'networkidle' | 'commit';
};
