import { ObservationCatalogFieldSchema } from '../../domain/schemas/observation-catalog.schema.js';

export function renderObservationFieldExtractor(field: string): string {
  const parsed = ObservationCatalogFieldSchema.safeParse(field);
  if (!parsed.success) {
    throw new Error(`Unknown observation catalog field: ${field}`);
  }

  switch (parsed.data) {
    case 'applied_query':
      return `    applied_query: await page.locator('input[name="field-keywords"], input[type="search"], #twotabsearchtextbox').first().inputValue(),`;
    case 'results_url':
      return `    results_url: page.url(),`;
  }
}
