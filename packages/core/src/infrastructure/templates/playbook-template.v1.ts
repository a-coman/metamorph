import { FINAL_PAGE_STABILIZATION_CODE } from '../../application/compiler/step-execution-policy.js';
import type { ObservableDef } from '../../domain/schemas/observable.schema.js';
import type { PageSnapshotInventory } from '../../domain/schemas/page-snapshot.schema.js';
import {
  renderObservationExtractors,
  type ObservationExtractorContext,
} from './observation-extractors.v1.js';

export const PLAYBOOK_TEMPLATE_VERSION = 'playbook-template@5';

export type PlaybookRenderInput = {
  observables: ObservableDef[];
  sourceStepLines: string[];
  followUpStepLines: string[];
  observationContext: ObservationExtractorContext;
};

export function renderPlaybook(input: PlaybookRenderInput): string {
  const observationBody = renderObservationExtractors(input.observationContext);

  const sourceSteps = input.sourceStepLines.join('\n');
  const followUpSteps = input.followUpStepLines.join('\n');

  return `import { test } from '@playwright/test';

async function extractObservation(page: import('@playwright/test').Page) {
  return {
${observationBody}
  };
}

test('source', async ({ page }) => {
${sourceSteps}

${FINAL_PAGE_STABILIZATION_CODE}
  const observation = await extractObservation(page);
  await test.info().attach('observation', {
    body: JSON.stringify(observation),
    contentType: 'application/json',
  });
});

test('follow_up', async ({ page }) => {
${followUpSteps}

${FINAL_PAGE_STABILIZATION_CODE}
  const observation = await extractObservation(page);
  await test.info().attach('observation', {
    body: JSON.stringify(observation),
    contentType: 'application/json',
  });
});
`;
}

const VALUE_TYPE_JSON: Record<ObservableDef['valueType'], string | { type: string; items: { type: string } }> = {
  string: 'string',
  number: 'number',
  boolean: 'boolean',
  'string[]': { type: 'array', items: { type: 'string' } },
};

export function renderObservationSchema(observables: ObservableDef[]): string {
  const properties: Record<string, unknown> = {};
  const required = observables.map((o) => o.key);

  for (const observable of observables) {
    properties[observable.key] = VALUE_TYPE_JSON[observable.valueType];
  }

  return JSON.stringify(
    {
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      properties,
      required,
      additionalProperties: false,
    },
    null,
    2,
  );
}

export function buildObservationExtractorContext(input: {
  observables: ObservableDef[];
  anchorInventories: Map<string, PageSnapshotInventory>;
}): ObservationExtractorContext {
  return {
    observables: input.observables,
    anchorInventories: input.anchorInventories,
  };
}
