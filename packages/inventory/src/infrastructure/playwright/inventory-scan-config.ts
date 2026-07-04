/** Tuned heuristics for filter aria-label shortening (Spanish/English travel UIs). */
export const FILTER_ARIA_LABEL_PATTERNS: RegExp[] = [
  /^aplicar filtro de (.+?) para reducir/i,
  /^apply (?:the )?(.+?) filter/i,
  /^filter by (.+)$/i,
  /^select (.+)$/i,
];

export const INVENTORY_SCAN_CONFIG = {
  minVisibleSizePx: 10,
  headerNavBelowFoldPx: 120,
  labelWidthPx: 34,
  labelHeightPx: 16,
  overlapHideThreshold: 0.35,
  mergeIouThreshold: 0.8,
  filterAriaLabelPatterns: FILTER_ARIA_LABEL_PATTERNS,
} as const;
