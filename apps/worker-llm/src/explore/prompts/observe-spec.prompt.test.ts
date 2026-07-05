import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildObserveSpecSystemPrompt, buildObserveSpecUserText } from './observe-spec.prompt.js';
import type { MrIntent } from '@metamorph/core';
import {
  ObservableValueTypeSchema,
  OBSERVE_SPEC_MIN_OBSERVABLES,
  OBSERVE_SPEC_MAX_OBSERVABLES,
} from '@metamorph/core';

const mrIntent: MrIntent = {
  mr_definition: {
    precondition: { description: 'Page loads' },
    transformation: {
      transform_family: 'subset',
      description: 'Apply extra filter',
    },
    relation: {
      on: [],
      description: 'Count does not increase',
    },
  },
  exploration: {
    source_phase_goal: 'Reach results',
    follow_up_phase_goal: 'Add filter',
  },
  observation_intents: ['result count stable', 'query unchanged'],
};

const inventory = {
  url: 'https://www.example.com/s?k=laptop',
  capturedAt: '2026-01-01T00:00:00.000Z',
  pageMetrics: { width: 1920, height: 1080 },
  viewport: { width: 1920, height: 1080 },
  items: [],
  labeledCount: 0,
  observationItems: [
    {
      index: 0,
      shortId: 'E7',
      locator: null,
      selector: '.results-label',
      score: 0,
      labelShown: false,
      tagName: 'div',
      id: null,
      role: null,
      name: null,
      ariaLabel: null,
      textPreview: '1-48 of over 30,000 results',
      selectorMatchCount: 1,
    },
  ],
};

describe('buildObserveSpecSystemPrompt allowed values', () => {
  it('lists every value type and observable min/max counts', () => {
    const prompt = buildObserveSpecSystemPrompt('subset');

    for (const valueType of ObservableValueTypeSchema.options) {
      assert.match(prompt, new RegExp(valueType.replace('[]', '\\[\\]')));
    }
    assert.match(
      prompt,
      new RegExp(
        `Pick ${OBSERVE_SPEC_MIN_OBSERVABLES} to ${OBSERVE_SPEC_MAX_OBSERVABLES} observables`,
      ),
    );
  });
});

describe('buildObserveSpecUserText', () => {
  it('includes observation inventory and intents', () => {
    const text = buildObserveSpecUserText({
      url: inventory.url,
      transformFamily: 'subset',
      mrIntent,
      inventory,
      inventorySnapshotId: '00000000-0000-4000-8000-000000000099',
      sourceSteps: [{ id: 1, action: 'press', key: 'Enter' }],
    });

    assert.match(text, /inventory_snapshot_id: 00000000-0000-4000-8000-000000000099/);
    assert.match(text, /Observation inventory/);
    assert.match(text, /E7/);
    assert.match(text, /result count stable/);
    assert.match(text, /- press/);
  });

  it('includes rejection reason on retry', () => {
    const text = buildObserveSpecUserText({
      url: inventory.url,
      transformFamily: 'subset',
      mrIntent,
      inventory,
      inventorySnapshotId: '00000000-0000-4000-8000-000000000099',
      sourceSteps: [],
      rejectionReason: 'Invalid element_id E99 for search_query',
    });

    assert.match(text, /Previous observe_spec attempt was rejected/);
    assert.match(text, /Invalid element_id E99/);
    assert.match(text, /Fix bindings and compare operators/);
  });
});
