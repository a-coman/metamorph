import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildMrPlanSystemPrompt } from './mr-plan.prompt.js';
import { ObservableCompareSchema, getFamilyProfile } from '@metamorph/core';

describe('buildMrPlanSystemPrompt family profile', () => {
  it('includes only the locked family semantics and allowed compares', () => {
    const prompt = buildMrPlanSystemPrompt('subset');

    assert.match(prompt, /This explore job.*subset/);
    assert.match(prompt, /additional filter/);
    assert.doesNotMatch(prompt, /Transform families:/);

    for (const compare of getFamilyProfile('subset').allowedCompares) {
      assert.match(prompt, new RegExp(`${compare}:`));
    }
    assert.doesNotMatch(prompt, /set_equal:/);

    for (const hint of getFamilyProfile('subset').observationIntentHints) {
      assert.match(prompt, new RegExp(escapeRegExp(hint)));
    }
  });

  it('lists only equal for inverse', () => {
    const prompt = buildMrPlanSystemPrompt('inverse');

    assert.match(prompt, /equal:/);
    assert.doesNotMatch(prompt, /cardinality_lte:/);
    assert.doesNotMatch(prompt, /set_equal:/);
    assert.doesNotMatch(prompt, /idempotence:/);
  });

  it('does not document compare operators disallowed for the family', () => {
    for (const family of ['idempotence', 'inverse'] as const) {
      const prompt = buildMrPlanSystemPrompt(family);
      const disallowed = ObservableCompareSchema.options.filter(
        (op) => !getFamilyProfile(family).allowedCompares.includes(op),
      );

      for (const compare of disallowed) {
        assert.doesNotMatch(prompt, new RegExp(`${compare}:`));
      }
    }
  });
});

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
