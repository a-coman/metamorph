import { ObservationCatalogFieldSchema } from '../../domain/schemas/observation-catalog.schema.js';

export function renderObservationFieldExtractor(field: string): string {
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
      for (const key of ['search_type', 'k', 'q', 'location_search']) {
        const value = u.searchParams.get(key);
        if (value) stable.set(key, value);
      }
      const query = stable.toString();
      return query ? \`\${u.pathname}?\${query}\` : u.pathname;
    })(),`;
  }
}
