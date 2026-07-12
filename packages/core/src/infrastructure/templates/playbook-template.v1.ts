import { renderFinalCaptureStabilizationCode } from '../../application/compiler/page-stabilization.js';
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

${renderFinalCaptureStabilizationCode('  ')}
  const observation = await extractObservation(page);
  await test.info().attach('observation', {
    body: JSON.stringify(observation),
    contentType: 'application/json',
  });
});

test('follow_up', async ({ page }) => {
${followUpSteps}

${renderFinalCaptureStabilizationCode('  ')}
  const observation = await extractObservation(page);
  await test.info().attach('observation', {
    body: JSON.stringify(observation),
    contentType: 'application/json',
  });
});
`;
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
