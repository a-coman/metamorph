import type { InventoryItem } from '@metamorph/core';
import type { ElementHandle, Page } from 'playwright';
import {
  canonicalA11yRole,
  isPromotableA11yLine,
  parseA11ySnapshot,
  PROMOTABLE_A11Y_ROLES,
  type ParsedA11yLine,
} from './a11y-snapshot-lines.js';
import type { InventoryLocatorScope } from './inventory-locator-context.js';
import { isPageScope } from './inventory-locator-context.js';
import { INVENTORY_SCAN_CONFIG } from './inventory-scan-config.js';
import {
  buildLocatorFromChain,
  formatGetByRoleLocator,
  formatLocatorSegment,
} from './parse-locator-chain.js';
import {
  resolveElementMetadataBatch,
  type ResolvedElementMetadata,
} from './resolve-element-metadata.js';
import { boxIoU } from './merge-inventory-items.js';
import { resolveShortDisplayName } from './resolve-display-name.js';
import { runInParallelBatches } from './run-in-parallel-batches.js';

const SCOPING_ANCESTOR_ROLES = new Set([
  'navigation',
  'form',
  'search',
  'complementary',
  'region',
  'banner',
  'listbox',
]);

const VALIDATION_CONCURRENCY = 8;
const STALE_REF_HANDLE_TIMEOUT_MS = 1000;
const STALE_REF_RESNAPSHOT_MIN = 3;
const STALE_REF_RESNAPSHOT_RATIO = 0.2;

const A11Y_ITEM_SCORE_BY_ROLE: Record<string, number> = {
  checkbox: 100,
  radio: 95,
  link: 80,
  button: 75,
  menuitem: 70,
  tab: 65,
  searchbox: 60,
  combobox: 55,
  textbox: 50,
  switch: 45,
  option: 10,
};

export type BuildA11yInventoryOptions = {
  /** Page root for counting frame-prefixed locator chains. Required when scope is a Frame. */
  locatorRoot?: Page;
  /** Prepended to every resolved locator chain (e.g. frameLocator("#consent")). */
  locatorChainPrefix?: string;
  /** Added to metadata bounding boxes after extraction. */
  boundingBoxOffset?: { x: number; y: number };
  /** When true, items without a unique locator are dropped (frame scans). */
  locatorOnly?: boolean;
};

export type BuildA11yInventoryResult = {
  items: InventoryItem[];
  staleRefCount: number;
  promotableLineCount: number;
};

type LineWithAncestors = ParsedA11yLine & {
  ancestors: Array<{ role: string; name: string | null }>;
};

type ViewportSize = {
  width: number;
  height: number;
};

type ResolvedRef = {
  line: LineWithAncestors;
  handle: ElementHandle<Element>;
};

async function getClientViewportSize(scope: InventoryLocatorScope): Promise<ViewportSize> {
  if (isPageScope(scope)) {
    const viewport = scope.viewportSize();
    if (viewport) {
      return viewport;
    }
  }

  return scope.evaluate(() => ({
    width: window.innerWidth,
    height: window.innerHeight,
  }));
}

/** ariaSnapshot boxes are viewport-relative (client coordinates), not page-absolute. */
function boxIntersectsViewport(
  box: NonNullable<ParsedA11yLine['box']>,
  viewport: ViewportSize,
): boolean {
  return !(
    box.x + box.width <= 0 ||
    box.x >= viewport.width ||
    box.y + box.height <= 0 ||
    box.y >= viewport.height
  );
}

function attachAncestors(snapshot: string): LineWithAncestors[] {
  const lines = parseA11ySnapshot(snapshot);
  const stack: Array<{ indent: number; role: string; name: string | null }> = [];

  return lines.map((line) => {
    while (stack.length > 0 && stack[stack.length - 1]!.indent >= line.indent) {
      stack.pop();
    }

    const ancestors = stack.map((entry) => ({ role: entry.role, name: entry.name }));

    if (line.role) {
      stack.push({ indent: line.indent, role: line.role, name: line.name });
    }

    return { ...line, ancestors };
  });
}

function nearestScopingAncestor(
  ancestors: Array<{ role: string; name: string | null }>,
): { role: string; name: string } | null {
  for (let index = ancestors.length - 1; index >= 0; index -= 1) {
    const ancestor = ancestors[index]!;
    const role = canonicalA11yRole(ancestor.role);
    const name = ancestor.name?.trim();
    if (role && name && SCOPING_ANCESTOR_ROLES.has(role)) {
      return { role, name };
    }
  }
  return null;
}

function buildScopedLocatorChain(line: LineWithAncestors): string | null {
  const role = canonicalA11yRole(line.role);
  const name = line.name?.trim();
  if (!role || !name || !PROMOTABLE_A11Y_ROLES.has(role)) {
    return null;
  }

  const scope = nearestScopingAncestor(line.ancestors);
  if (!scope) {
    return null;
  }

  const scopeChain = formatGetByRoleLocator(scope.role, scope.name, { exact: true });
  return formatGetByRoleLocator(role, name, { exact: true, scopeChain });
}

function buildBaseLocatorChain(line: LineWithAncestors): string | null {
  const role = canonicalA11yRole(line.role);
  const name = line.name?.trim();
  if (!role || !name || !PROMOTABLE_A11Y_ROLES.has(role)) {
    return null;
  }
  return formatGetByRoleLocator(role, name, { exact: true });
}

function scoreForLine(line: LineWithAncestors): number {
  const role = canonicalA11yRole(line.role);
  return role ? (A11Y_ITEM_SCORE_BY_ROLE[role] ?? 40) : 0;
}

function countDuplicateBaseChains(lines: LineWithAncestors[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const line of lines) {
    const base = buildBaseLocatorChain(line);
    if (base) {
      counts.set(base, (counts.get(base) ?? 0) + 1);
    }
  }
  return counts;
}

function applyBoundingBoxOffset(
  box: NonNullable<InventoryItem['boundingBox']>,
  offset?: { x: number; y: number },
): NonNullable<InventoryItem['boundingBox']> {
  if (!offset) {
    return box;
  }
  return {
    ...box,
    x: box.x + offset.x,
    y: box.y + offset.y,
  };
}

function prefixLocatorChain(prefix: string | undefined, chain: string): string {
  if (!prefix) {
    return chain;
  }
  return `${prefix}.${chain}`;
}

function resolveLocatorRoot(
  scope: InventoryLocatorScope,
  options: BuildA11yInventoryOptions,
): Page | null {
  if (options.locatorRoot) {
    return options.locatorRoot;
  }
  return isPageScope(scope) ? scope : null;
}

async function countLocatorMatches(
  scope: InventoryLocatorScope,
  locatorChain: string,
): Promise<number> {
  try {
    return await buildLocatorFromChain(scope, locatorChain).count();
  } catch {
    return 0;
  }
}

async function resolveRefHandle(
  scope: InventoryLocatorScope,
  ref: string,
): Promise<{ handle: ElementHandle<Element> | null; stale: boolean }> {
  const refLocator = scope.locator(`aria-ref=${ref}`);
  const count = await refLocator.count();
  if (count === 0) {
    return { handle: null, stale: true };
  }

  try {
    const handle = await refLocator.elementHandle({ timeout: STALE_REF_HANDLE_TIMEOUT_MS });
    if (!handle) {
      return { handle: null, stale: true };
    }
    return { handle, stale: false };
  } catch {
    return { handle: null, stale: true };
  }
}

async function resolveNthIndexByBox(
  scope: InventoryLocatorScope,
  baseLocatorChain: string,
  lineBox: NonNullable<ParsedA11yLine['box']>,
): Promise<number | null> {
  try {
    const locator = buildLocatorFromChain(scope, baseLocatorChain);
    const count = await locator.count();
    if (count <= 1) {
      return null;
    }

    let bestIndex: number | null = null;
    let bestIoU = 0;

    for (let index = 0; index < count; index += 1) {
      const candidateBox = await locator.nth(index).boundingBox();
      if (!candidateBox) {
        continue;
      }

      const iou = boxIoU(lineBox, candidateBox);
      if (iou > bestIoU) {
        bestIoU = iou;
        bestIndex = index;
      }
    }

    return bestIoU >= INVENTORY_SCAN_CONFIG.mergeIouThreshold ? bestIndex : null;
  } catch {
    return null;
  }
}

async function resolveReadableLocator(
  scope: InventoryLocatorScope,
  line: LineWithAncestors,
  duplicateBaseCounts: Map<string, number>,
  locatorChainPrefix?: string,
  locatorRoot?: Page | null,
): Promise<{ chain: string; matchCount: number } | null> {
  const base = buildBaseLocatorChain(line);
  const scoped = buildScopedLocatorChain(line);
  const candidates: string[] = [];
  if (base) candidates.push(base);
  if (scoped && scoped !== base) candidates.push(scoped);

  for (const candidate of candidates) {
    if (candidate === base && (duplicateBaseCounts.get(candidate) ?? 0) > 1) {
      continue;
    }
    const count = await countLocatorMatches(scope, candidate);
    if (count === 1) {
      const chain = prefixLocatorChain(locatorChainPrefix, candidate);
      if (locatorChainPrefix && locatorRoot) {
        const prefixedCount = await countLocatorMatches(locatorRoot, chain);
        if (prefixedCount !== 1) {
          continue;
        }
      }
      return { chain, matchCount: 1 };
    }
  }

  if (base && line.box) {
    const nthIndex = await resolveNthIndexByBox(scope, base, line.box);
    if (nthIndex !== null) {
      const withNth = `${base}.nth(${nthIndex})`;
      const count = await countLocatorMatches(scope, withNth);
      if (count === 1) {
        const chain = prefixLocatorChain(locatorChainPrefix, withNth);
        if (locatorChainPrefix && locatorRoot) {
          const prefixedCount = await countLocatorMatches(locatorRoot, chain);
          if (prefixedCount !== 1) {
            return null;
          }
        }
        return { chain, matchCount: 1 };
      }
    }
  }

  return null;
}

function buildInventoryItem(
  line: LineWithAncestors,
  index: number,
  metadata: ResolvedElementMetadata,
  readable: { chain: string; matchCount: number } | null,
  options: BuildA11yInventoryOptions,
): InventoryItem | null {
  if (
    metadata.boundingBox.width < INVENTORY_SCAN_CONFIG.minVisibleSizePx ||
    metadata.boundingBox.height < INVENTORY_SCAN_CONFIG.minVisibleSizePx
  ) {
    return null;
  }

  const role = canonicalA11yRole(line.role)!;
  const fullName = line.name!.trim();
  const shortName = resolveShortDisplayName(fullName, metadata.textPreview);
  const boundingBox = applyBoundingBoxOffset(metadata.boundingBox, options.boundingBoxOffset);

  if (!readable) {
    if (options.locatorOnly) {
      return null;
    }
    if (metadata.selectorMatchCount !== 1) {
      return null;
    }

    return {
      index,
      shortId: `E${index + 1}`,
      locator: null,
      selector: metadata.selector,
      score: scoreForLine(line),
      labelShown: false,
      tagName: metadata.tagName,
      id: metadata.id,
      role,
      name: shortName,
      ariaLabel: fullName,
      textPreview: shortName,
      selectorMatchCount: metadata.selectorMatchCount,
      candidates: [formatLocatorSegment(metadata.selector)],
      boundingBox,
      source: 'a11y',
      ...(metadata.options ? { options: metadata.options } : {}),
    };
  }

  const candidates = [readable.chain];
  if (!options.locatorOnly && metadata.selectorMatchCount === 1) {
    candidates.push(formatLocatorSegment(metadata.selector));
  }

  return {
    index,
    shortId: `E${index + 1}`,
    locator: readable.chain,
    selector: metadata.selector,
    score: scoreForLine(line),
    labelShown: false,
    tagName: metadata.tagName,
    id: metadata.id,
    role,
    name: shortName,
    ariaLabel: fullName,
    textPreview: shortName,
    locatorMatchCount: readable.matchCount,
    ...(options.locatorOnly ? {} : { selectorMatchCount: metadata.selectorMatchCount }),
    candidates,
    boundingBox,
    source: 'a11y',
    ...(metadata.options ? { options: metadata.options } : {}),
  };
}

export function shouldResnapshotA11yInventory(result: BuildA11yInventoryResult): boolean {
  if (result.promotableLineCount === 0) {
    return false;
  }
  return (
    result.staleRefCount > STALE_REF_RESNAPSHOT_MIN ||
    result.staleRefCount / result.promotableLineCount > STALE_REF_RESNAPSHOT_RATIO
  );
}

export async function buildA11yInventory(
  scope: InventoryLocatorScope,
  snapshot: string,
  options: BuildA11yInventoryOptions = {},
): Promise<BuildA11yInventoryResult> {
  if (!snapshot.trim()) {
    return { items: [], staleRefCount: 0, promotableLineCount: 0 };
  }

  const locatorRoot = resolveLocatorRoot(scope, options);
  const viewport = await getClientViewportSize(scope);
  const lines = attachAncestors(snapshot).filter(
    (line) =>
      line.ref !== null &&
      isPromotableA11yLine(line) &&
      line.box !== null &&
      boxIntersectsViewport(line.box, viewport),
  );

  const duplicateBaseCounts = countDuplicateBaseChains(lines);

  const refResults = await runInParallelBatches(
    lines,
    VALIDATION_CONCURRENCY,
    async (line) => {
      const { handle, stale } = await resolveRefHandle(scope, line.ref!);
      return { line, handle, stale };
    },
  );

  const staleRefCount = refResults.filter((result) => result.stale).length;
  const resolvedRefs: ResolvedRef[] = refResults.flatMap((result) =>
    result.handle ? [{ line: result.line, handle: result.handle }] : [],
  );

  const metadataList = await resolveElementMetadataBatch(
    scope,
    resolvedRefs.map((entry) => entry.handle),
  );

  const builtItems = await runInParallelBatches(
    resolvedRefs,
    VALIDATION_CONCURRENCY,
    async ({ line, handle }, index) => {
      const metadata = metadataList[index];
      if (!metadata) {
        await handle.dispose();
        return null;
      }

      try {
        let readable = await resolveReadableLocator(
          scope,
          line,
          duplicateBaseCounts,
          options.locatorChainPrefix,
          locatorRoot,
        );

        if (
          !readable &&
          options.locatorOnly &&
          options.locatorChainPrefix &&
          locatorRoot &&
          metadata.selectorMatchCount === 1
        ) {
          const locatorFallback = `${options.locatorChainPrefix}.${formatLocatorSegment(metadata.selector)}`;
          const fallbackCount = await countLocatorMatches(locatorRoot, locatorFallback);
          if (fallbackCount === 1) {
            readable = { chain: locatorFallback, matchCount: 1 };
          }
        }

        return buildInventoryItem(line, index, metadata, readable, options);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.warn(`[inventory] skipped a11y item "${line.name}": ${message}`);
        return null;
      } finally {
        await handle.dispose();
      }
    },
  );

  const items = builtItems.filter((item): item is InventoryItem => item !== null);

  return {
    items,
    staleRefCount,
    promotableLineCount: lines.length,
  };
}
