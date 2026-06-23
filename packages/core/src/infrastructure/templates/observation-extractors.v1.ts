import type { ObservationAnchors } from '../../domain/schemas/generation-slots.schema.js';
import type { PageSnapshotInventory } from '../../domain/schemas/page-snapshot.schema.js';
import { ObservationCatalogFieldSchema } from '../../domain/schemas/observation-catalog.schema.js';
import { resolveInventoryItemTarget, renderTargetExpression } from '../../application/compiler/resolve-inventory-target.js';

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

function resolveAnchorContainerTarget(
  anchor: NonNullable<ObservationAnchors['visible_item_count']>,
  anchorInventories: Map<string, PageSnapshotInventory>,
): string {
  const inventory = anchorInventories.get(anchor.inventory_snapshot_id);
  if (!inventory) {
    throw new Error(
      `Anchor inventory snapshot ${anchor.inventory_snapshot_id} not provided`,
    );
  }

  const item = inventory.items.find(
    (candidate) => candidate.shortId === anchor.container_element_id,
  );

  if (!item) {
    throw new Error(
      `Anchor container_element_id ${anchor.container_element_id} not found in inventory`,
    );
  }

  return renderTargetExpression(resolveInventoryItemTarget(item));
}

function itemSelectorExpression(hint?: 'listitem' | 'article' | 'li'): string {
  switch (hint) {
    case 'article':
      return 'article';
    case 'li':
      return 'li';
    case 'listitem':
    default:
      return '[role="listitem"], article, li';
  }
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

    case 'visible_item_count': {
      const anchor = context?.anchors?.visible_item_count;
      const anchorInventories = context?.anchorInventories;

      if (!anchor || !anchorInventories) {
        return `    visible_item_count: null,`;
      }

      const containerTarget = resolveAnchorContainerTarget(anchor, anchorInventories);
      const itemSelector = itemSelectorExpression(anchor.item_selector_hint);

      return `    visible_item_count: await (async () => {
      const container = ${containerTarget};
      try {
        if ((await container.count()) === 0) return null;
      } catch {
        return null;
      }
      const viewport = page.viewportSize() ?? { width: 1280, height: 720 };
      const items = container.locator(${JSON.stringify(itemSelector)});
      const total = await items.count();
      let visible = 0;
      for (let index = 0; index < total; index += 1) {
        const item = items.nth(index);
        try {
          const box = await item.boundingBox();
          if (!box || box.height < 40) continue;
          if (box.y + box.height < 0 || box.y > viewport.height) continue;
          visible += 1;
        } catch {
          /* skip item */
        }
      }
      return visible;
    })(),`;
    }
  }
}
