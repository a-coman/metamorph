export const PLAYBOOK_TEMPLATE_VERSION = 'playbook-template@1';

export type PlaybookRenderInput = {
  observationFields: string[];
  sourceStepLines: string[];
  followUpStepLines: string[];
};

export function renderPlaybook(input: PlaybookRenderInput): string {
  const observationBody = input.observationFields
    .map((field) => {
      if (field === 'url') {
        return `    url: page.url(),`;
      }
      if (field === 'title') {
        return `    title: await page.title(),`;
      }
      return `    ${field}: null, // TODO: refine extraction for "${field}"`;
    })
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

  const observation = await extractObservation(page);
  await test.info().attach('observation', {
    body: JSON.stringify(observation),
    contentType: 'application/json',
  });
});

test('follow_up', async ({ page }) => {
${followUpSteps}

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
    properties[field] = { type: field === 'resultCount' ? 'number' : 'string' };
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
