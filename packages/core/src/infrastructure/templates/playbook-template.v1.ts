import { FINAL_PAGE_STABILIZATION_CODE } from '../../application/compiler/step-execution-policy.js';
import {
  OBSERVATION_FIELD_TYPES,
  ObservationCatalogFieldSchema,
} from '../../domain/schemas/observation-catalog.schema.js';
import { renderObservationFieldExtractor } from './observation-extractors.v1.js';

export const PLAYBOOK_TEMPLATE_VERSION = 'playbook-template@2';

export type PlaybookRenderInput = {
  observationFields: string[];
  sourceStepLines: string[];
  followUpStepLines: string[];
};

export function renderPlaybook(input: PlaybookRenderInput): string {
  const observationBody = input.observationFields
    .map((field) => renderObservationFieldExtractor(field))
    .join('\n');

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

export function renderObservationSchema(fields: string[]): string {
  const properties: Record<string, { type: string }> = {};

  for (const field of fields) {
    const parsed = ObservationCatalogFieldSchema.parse(field);
    properties[field] = { type: OBSERVATION_FIELD_TYPES[parsed] };
  }

  return JSON.stringify(
    {
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      properties,
      required: fields,
      additionalProperties: false,
    },
    null,
    2,
  );
}
