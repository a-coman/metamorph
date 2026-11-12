import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { InventoryItem, MrIntent, PageSnapshotInventory } from '@metamorph/core';
import { EMPTY_BATCH_LOG, appendBatchRecord } from '../graph/batch-log.js';
import { JevPlanExploreAdapter } from './jev-plan-explore.adapter.js';
import type { OpenRouterDecisionsClient } from './openrouter-decisions.client.js';
import type { ExploreOpenRouterClient } from '../openrouter/explore-openrouter.client.js';

function item(overrides: Partial<InventoryItem> & Pick<InventoryItem, 'shortId' | 'tagName'>): InventoryItem {
  return {
    index: 0,
    locator: null,
    selector: '#x',
    score: 10,
    labelShown: false,
    id: null,
    role: 'button',
    name: 'Search',
    ariaLabel: null,
    textPreview: null,
    ...overrides,
  };
}

const mrIntent: MrIntent = {
  mr_definition: {
    precondition: { description: 'Page loads' },
    transformation: {
      transform_family: 'idempotence',
      description: 'Repeat search',
    },
    relation: {
      on: ['applied_query'],
      description: 'Queries match',
    },
  },
  exploration: {
    source_phase_goal: 'Search for laptops',
    follow_up_phase_goal: 'Repeat search',
  },
};

function inventory(): PageSnapshotInventory {
  return {
    url: 'https://www.example.com/',
    capturedAt: '2026-01-01T00:00:00.000Z',
    pageMetrics: { width: 1920, height: 1080 },
    viewport: { width: 1920, height: 1080 },
    items: [item({ shortId: 'E1', tagName: 'button', name: 'Search' })],
    labeledCount: 1,
  };
}

describe('JevPlanExploreAdapter', () => {
  it('maps a click decision without calling the fill model', async () => {
    const decideCalls: unknown[] = [];
    const decisions = {
      getModel: () => 'typesafe/jev-1.13',
      async decide(input: unknown) {
        decideCalls.push(input);
        return {
          model: 'typesafe/jev-1.13',
          answers: {
            permanently_blocked: { type: 'noul', noul: 0.05 },
            overlay_present: { type: 'noul', noul: 0.05 },
            overlay_target: { type: 'choice', choice: 'none', confidence: 0.9 },
            goal_already_met: { type: 'noul', noul: 0.05 },
            next_control: { type: 'choice', choice: 'E1', confidence: 0.88 },
            control_missing: { type: 'noul', noul: 0.1 },
            page_settling: { type: 'noul', noul: 0.1 },
          },
          usage: { input_tokens: 20, output_tokens: 0 },
        };
      },
    } as unknown as OpenRouterDecisionsClient;

    const fillCalls: unknown[] = [];
    const openRouter = {
      async fillPlanValue(input: unknown) {
        fillCalls.push(input);
        return { output: { value: 'nope' }, audit: { tokensIn: 0, tokensOut: 0 } };
      },
    } as unknown as ExploreOpenRouterClient;

    const adapter = new JevPlanExploreAdapter(openRouter, decisions);
    const result = await adapter.planNext({
      url: 'https://www.example.com/',
      phase: 'source',
      mrIntent,
      inventory: inventory(),
      validatedSteps: { source: [], follow_up: [] },
      batchLog: EMPTY_BATCH_LOG,
    });

    assert.equal(result.output.action, 'append_steps');
    assert.equal(result.output.steps?.[0]?.action, 'click');
    assert.equal(result.output.steps?.[0]?.element_id, 'E1');
    assert.equal(fillCalls.length, 0);
    assert.equal(decideCalls.length, 1);
    const decideInput = decideCalls[0] as { state: { controls: unknown[] }; questions: Record<string, unknown> };
    assert.equal(Array.isArray(decideInput.state.controls), true);
    assert.equal('next_control' in decideInput.questions, true);
    assert.equal('operation' in decideInput.questions, false);
    assert.equal(result.debugJson !== undefined, true);
    assert.equal(adapter.needsVision, false);
  });

  it('reuses the source query on follow_up search fill', async () => {
    const fillCalls: unknown[] = [];
    const decisions = {
      getModel: () => 'typesafe/jev-1.13',
      async decide() {
        return {
          model: 'typesafe/jev-1.13',
          answers: {
            permanently_blocked: { type: 'noul', noul: 0.05 },
            overlay_present: { type: 'noul', noul: 0.05 },
            overlay_target: { type: 'choice', choice: 'none', confidence: 0.9 },
            goal_already_met: { type: 'noul', noul: 0.05 },
            next_control: { type: 'choice', choice: 'E2', confidence: 0.9 },
            control_missing: { type: 'noul', noul: 0.1 },
            page_settling: { type: 'noul', noul: 0.1 },
          },
        };
      },
    } as unknown as OpenRouterDecisionsClient;
    const openRouter = {
      async fillPlanValue(input: unknown) {
        fillCalls.push(input);
        return { output: { value: 'star wars' }, audit: { tokensIn: 1, tokensOut: 1 } };
      },
    } as unknown as ExploreOpenRouterClient;

    const adapter = new JevPlanExploreAdapter(openRouter, decisions);
    const batchLog = appendBatchRecord(EMPTY_BATCH_LOG, 'source', {
      steps: [{ id: 1, action: 'fill', element_id: 'E2', value: 'ofertas' }],
      outcome: 'committed',
    });
    const result = await adapter.planNext({
      url: 'https://www.example.com/',
      phase: 'follow_up',
      mrIntent,
      inventory: {
        ...inventory(),
        items: [
          item({
            shortId: 'E2',
            tagName: 'input',
            role: 'searchbox',
            name: 'Buscar',
          }),
        ],
      },
      validatedSteps: { source: [], follow_up: [] },
      batchLog,
    });

    assert.equal(fillCalls.length, 0);
    assert.equal(result.output.steps?.[0]?.action, 'fill');
    assert.equal(result.output.steps?.[0]?.value, 'ofertas');
  });
});
