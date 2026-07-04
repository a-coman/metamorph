import type { ElementHandle, Page } from 'playwright';
import type { InventoryItem } from '@metamorph/core';
import { evaluateHandleFunction } from './evaluate-browser-function.js';
import { buildLocatorFromChain } from './parse-locator-chain.js';
import type { InventoryLocatorScope } from './inventory-locator-context.js';
import { runInParallelBatches } from './run-in-parallel-batches.js';

export type ResolvedElementMetadata = {
  tagName: string;
  id: string | null;
  selector: string;
  selectorMatchCount: number;
  boundingBox: NonNullable<InventoryItem['boundingBox']>;
  options?: InventoryItem['options'];
  textPreview: string | null;
  name: string | null;
  ariaLabel: string | null;
};

/**
 * Runs in the browser. Must stay free of Node imports and closed-over variables.
 */
export function extractMetadataFromElement(
  el: Element,
): Omit<ResolvedElementMetadata, 'selectorMatchCount'> {
  const tagNameOf = (element: Element) =>
    (typeof element.tagName === 'string' ? element.tagName : element.localName ?? '').toLowerCase();

  const cssEscape = (value: string) => {
    const text = String(value);
    if (window.CSS && typeof window.CSS.escape === 'function') {
      return window.CSS.escape(text);
    }
    return text.replace(/[^a-zA-Z0-9_-]/g, (character) => `\\${character}`);
  };

  const escapeCssString = (value: string) =>
    String(value)
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\A ')
      .replace(/\r/g, '\\D ')
      .replace(/\f/g, '\\C ');

  const selectorMatchesUniquely = (selector: string, element: Element) => {
    if (!selector) return false;
    try {
      const matches = document.querySelectorAll(selector);
      return matches.length === 1 && matches[0] === element;
    } catch {
      return false;
    }
  };

  const buildSelectorCandidates = (element: Element) => {
    const tagName = tagNameOf(element);
    const candidates: string[] = [];
    const testId = element.getAttribute('data-testid');
    if (testId) {
      candidates.push(`[data-testid="${escapeCssString(testId)}"]`);
    }
    if (element.id) {
      candidates.push(`#${cssEscape(element.id)}`);
    }
    const ariaLabel = element.getAttribute('aria-label');
    if (ariaLabel) {
      candidates.push(`${tagName}[aria-label="${escapeCssString(ariaLabel)}"]`);
    }
    return candidates;
  };

  const buildFallbackPathSelector = (element: Element) => {
    const segments: string[] = [];
    let node: Element | null = element;
    while (node && node !== document.documentElement) {
      const tagName = tagNameOf(node);
      if (node.id) {
        segments.unshift(`#${cssEscape(node.id)}`);
        break;
      }
      const parent: Element | null = node.parentElement;
      let segment = tagName;
      if (parent) {
        const siblings = Array.from(parent.children).filter(
          (child: Element) => tagNameOf(child) === tagNameOf(node!),
        );
        if (siblings.length > 1) {
          segment += `:nth-of-type(${siblings.indexOf(node) + 1})`;
        }
      }
      segments.unshift(segment);
      node = parent;
    }
    return segments.join(' > ');
  };

  const tagName = tagNameOf(el);
  let selector = '';
  for (const candidate of buildSelectorCandidates(el)) {
    if (selectorMatchesUniquely(candidate, el)) {
      selector = candidate;
      break;
    }
  }
  if (!selector) {
    selector = buildFallbackPathSelector(el);
  }

  const rect = el.getBoundingClientRect();
  const textPreview = (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 80) || null;
  const selectOptions =
    tagName === 'select'
      ? Array.from(el.querySelectorAll('option'))
          .map((option) => ({
            value: option.value,
            label: (option.textContent ?? '').trim(),
          }))
          .filter((option) => option.value.length > 0)
      : [];

  return {
    tagName,
    id: el.id || null,
    selector,
    textPreview,
    name: el.getAttribute('name'),
    ariaLabel: el.getAttribute('aria-label'),
    boundingBox: {
      x: rect.left + window.scrollX,
      y: rect.top + window.scrollY,
      width: rect.width,
      height: rect.height,
    },
    ...(selectOptions.length > 0 ? { options: selectOptions } : {}),
  };
}

async function countSelectorMatchesInScope(
  scope: InventoryLocatorScope,
  selector: string,
): Promise<number> {
  try {
    return await scope.locator(selector).count();
  } catch {
    return 0;
  }
}

export async function resolveElementMetadataBatch(
  scope: InventoryLocatorScope,
  handles: Array<ElementHandle<Element> | null>,
): Promise<Array<ResolvedElementMetadata | null>> {
  if (handles.length === 0) {
    return [];
  }

  return runInParallelBatches(handles, 8, async (handle) => {
    if (!handle) {
      return null;
    }
    return resolveElementMetadataFromHandle(scope, handle);
  });
}

export async function resolveElementMetadataFromHandle(
  scope: InventoryLocatorScope,
  handle: ElementHandle<Element>,
): Promise<ResolvedElementMetadata | null> {
  try {
    const raw = await evaluateHandleFunction(handle, extractMetadataFromElement);
    const selectorMatchCount = await countSelectorMatchesInScope(scope, raw.selector);
    return {
      ...raw,
      selectorMatchCount,
    };
  } catch {
    return null;
  }
}

export async function resolveElementMetadataFromAriaRef(
  scope: InventoryLocatorScope,
  ref: string,
  options?: { handleTimeoutMs?: number },
): Promise<ResolvedElementMetadata | null> {
  try {
    const locator = scope.locator(`aria-ref=${ref}`);
    const count = await locator.count();
    if (count === 0) {
      return null;
    }
    const handle = await locator.elementHandle({
      timeout: options?.handleTimeoutMs ?? 30_000,
    });
    if (!handle) {
      return null;
    }
    try {
      return await resolveElementMetadataFromHandle(scope, handle);
    } finally {
      await handle.dispose();
    }
  } catch {
    return null;
  }
}

export async function resolveElementMetadataFromValidatedLocator(
  page: Page,
  locatorChain: string,
): Promise<ResolvedElementMetadata | null> {
  try {
    const locator = buildLocatorFromChain(page, locatorChain);
    const handle = await locator.elementHandle();
    if (!handle) {
      return null;
    }
    try {
      return await resolveElementMetadataFromHandle(page, handle);
    } finally {
      await handle.dispose();
    }
  } catch {
    return null;
  }
}

export async function resolveElementMetadataFromLocator(
  page: Page,
  locatorChain: string,
): Promise<ResolvedElementMetadata | null> {
  try {
    const locator = buildLocatorFromChain(page, locatorChain);
    const count = await locator.count();
    if (count !== 1) {
      return null;
    }
    const handle = await locator.elementHandle();
    if (!handle) {
      return null;
    }
    try {
      return await resolveElementMetadataFromHandle(page, handle);
    } finally {
      await handle.dispose();
    }
  } catch {
    return null;
  }
}
