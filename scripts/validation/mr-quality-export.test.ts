import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildMrQualityRow,
  formatObservationPayload,
  formatObservablesSummary,
  formatStepsSummary,
} from './mr-quality-export.js';

describe('mr-quality-export', () => {
  it('formats step summaries', () => {
    const summary = formatStepsSummary([
      { action: 'click', element_id: 'E5' },
      { action: 'fill', element_id: 'E2', value: 'react' },
    ]);
    assert.match(summary, /click E5/);
    assert.match(summary, /fill E2 "react"/);
  });

  it('formats observables summary', () => {
    const summary = formatObservablesSummary([
      {
        key: 'reported_total_results',
        compare: 'cardinality_lte',
        rationale: 'Result count should not increase',
        binding: { kind: 'number_from_label', element_id: 'O3' },
      },
    ]);
    assert.match(summary, /reported_total_results/);
    assert.match(summary, /O3/);
  });

  it('formats observation payload values', () => {
    const text = formatObservationPayload({
      query_text: 'react',
      reported_total_results: 7000000,
    });
    assert.match(text, /query_text=react/);
    assert.match(text, /reported_total_results=7000000/);
  });

  it('builds a quality row with plan and observation context', () => {
    const row = buildMrQualityRow({
      domain: 'amazon',
      generation: 1,
      transformFamily: 'subset',
      mrVersionId: 'mr-1',
      definition: {
        transformation: { description: 'Apply department filter' },
        relation: { description: 'Counts should narrow' },
      },
      explorationGoals: {
        source_phase_goal: 'Search react',
        follow_up_phase_goal: 'Filter to books',
      },
      generationSlots: {
        source: { steps: [{ action: 'fill', element_id: 'E1', value: 'react' }] },
        follow_up: { steps: [{ action: 'click', element_id: 'E9' }] },
        observation: {
          observables: [
            {
              key: 'reported_total_results',
              compare: 'cardinality_lte',
              rationale: 'Subset count',
              binding: { kind: 'number_from_label', element_id: 'O1' },
            },
          ],
        },
      },
      sourceObservationPayload: { reported_total_results: 100 },
      followUpObservationPayload: { reported_total_results: 40 },
    });

    assert.equal(row.transformationDescription, 'Apply department filter');
    assert.equal(row.sourcePhaseGoal, 'Search react');
    assert.equal(row.observationValuesSource, 'reported_total_results=100');
    assert.equal(row.observationValuesFollowUp, 'reported_total_results=40');
  });
});
