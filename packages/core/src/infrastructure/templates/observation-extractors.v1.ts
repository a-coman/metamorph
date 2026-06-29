import type { ObservationAnchors } from '../../domain/schemas/generation-slots.schema.js';
import type { PageSnapshotInventory } from '../../domain/schemas/page-snapshot.schema.js';
import { findObservationItem } from '../../domain/observation-inventory.js';
import { ObservationCatalogFieldSchema } from '../../domain/schemas/observation-catalog.schema.js';
import { resolveInventoryItemTarget, renderTargetExpression } from '../../application/compiler/resolve-inventory-target.js';
import { PARSE_LOCALIZED_NUMBERS_FN_SOURCE } from '../../domain/parse-localized-numbers.js';

export const STABLE_RESULTS_URL_PARAMS = [
  'search_type',
  'k',
  'q',
  'location_search',
] as const;

export type ObservationExtractorContext = {
  anchors?: ObservationAnchors;
  anchorInventories?: Map<string, PageSnapshotInventory>;
};

function resolveAnchorElementTarget(
  anchor: NonNullable<ObservationAnchors['reported_total_results']>,
  anchorInventories: Map<string, PageSnapshotInventory>,
): string {
  const inventory = anchorInventories.get(anchor.inventory_snapshot_id);
  if (!inventory) {
    throw new Error(
      `Anchor inventory snapshot ${anchor.inventory_snapshot_id} not provided`,
    );
  }

  const item = findObservationItem(inventory, anchor.label_element_id);

  if (!item) {
    throw new Error(
      `Anchor label_element_id ${anchor.label_element_id} not found in observation inventory`,
    );
  }

  return renderTargetExpression(resolveInventoryItemTarget(item));
}

export function renderObservationFieldExtractor(
  field: string,
  context?: ObservationExtractorContext,
): string {
  const parsed = ObservationCatalogFieldSchema.safeParse(field);
  if (!parsed.success) {
    throw new Error(`Unknown observation catalog field: ${field}`);
  }

  switch (parsed.data) {
    case 'applied_query':
      return `    applied_query: await (async () => {
      const inputSelectors = [
        'input[name="field-keywords"]',
        'input[type="search"]',
        '#twotabsearchtextbox',
        '[data-testid="structured-search-input-field"]',
        '[data-testid="little-search-location"] input',
        'header form input',
      ];
      for (const selector of inputSelectors) {
        const loc = page.locator(selector).first();
        try {
          if ((await loc.count()) === 0) continue;
          const value = await loc.inputValue({ timeout: 2000 });
          if (value?.trim()) return value.trim();
        } catch {
          /* try next selector */
        }
      }
      try {
        const url = new URL(page.url());
        const pathMatch = url.pathname.match(/\\/s\\/([^/]+)(?:\\/|$)/i);
        if (pathMatch?.[1]) {
          return decodeURIComponent(pathMatch[1].replace(/\\+/g, ' '));
        }
        for (const key of ['k', 'query', 'q', 'search_query', 'location_search']) {
          const param = url.searchParams.get(key);
          if (param?.trim()) return param.trim();
        }
      } catch {
        /* ignore */
      }
      return '';
    })(),`;

    case 'results_url':
      return `    results_url: (() => {
      const u = new URL(page.url());
      const stable = new URLSearchParams();
      const keys = ${JSON.stringify([...STABLE_RESULTS_URL_PARAMS])};
      for (const key of keys.sort()) {
        const value = u.searchParams.get(key);
        if (value) stable.set(key, value);
      }
      const sorted = new URLSearchParams([...stable.entries()].sort(([a], [b]) => a.localeCompare(b)));
      const query = sorted.toString();
      return query ? \`\${u.pathname}?\${query}\` : u.pathname;
    })(),`;

    case 'reported_total_results': {
      const anchor = context?.anchors?.reported_total_results;
      const anchorInventories = context?.anchorInventories;

      if (!anchor || !anchorInventories) {
        return `    reported_total_results: null,`;
      }

      const labelTarget = resolveAnchorElementTarget(anchor, anchorInventories);
      const numberIndex = anchor.number_index;

      return `    reported_total_results: await (async () => {
      ${PARSE_LOCALIZED_NUMBERS_FN_SOURCE}
      const label = ${labelTarget};
      try {
        if ((await label.count()) === 0) return null;
      } catch {
        return null;
      }
      let text = '';
      try {
        text = (await label.textContent({ timeout: 2000 })) ?? '';
      } catch {
        return null;
      }
      const numbers = parseLocalizedNumbers(text);
      const index = ${numberIndex};
      if (index < 0 || index >= numbers.length) return null;
      return numbers[index] ?? null;
    })(),`;
    }
  }
}
