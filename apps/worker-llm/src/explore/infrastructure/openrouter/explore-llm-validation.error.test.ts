import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  ExploreLlmValidationError,
  extractRejectedPlanSteps,
  formatLlmValidationErrorForPrompt,
} from './explore-llm-validation.error.js';

describe('explore-llm-validation.error', () => {
  it('extractRejectedPlanSteps prefers normalized output', () => {
    const normalized = {
      action: 'append_steps',
      steps: [
        { id: 1, action: 'click', element_id: 'E4' },
        { id: 2, action: 'click', element_id: 'E78' },
        { id: 3, action: 'fill', element_id: 'destination-input', value: 'Madrid' },
      ],
    };

    const steps = extractRejectedPlanSteps(normalized);

    assert.equal(steps.length, 3);
    assert.equal(steps[2]?.element_id, 'destination-input');
    assert.equal(steps[2]?.value, 'Madrid');
  });

  it('extractRejectedPlanSteps falls back to raw output when normalized has no steps', () => {
    const raw = {
      action: 'append_steps',
      steps: [{ id: 1, action: 'press', key: 'Enter' }],
    };

    const steps = extractRejectedPlanSteps({ action: 'append_steps' }, raw);

    assert.equal(steps.length, 1);
    assert.equal(steps[0]?.action, 'press');
    assert.equal(steps[0]?.key, 'Enter');
  });

  it('ExploreLlmValidationError carries normalized and raw output', () => {
    const normalized = { action: 'append_steps', steps: [] };
    const raw = { action: 'append_steps', steps: [{ id: 1, action: 'click', element_id: 'E1' }] };
    const error = new ExploreLlmValidationError('validation failed', normalized, raw);

    assert.equal(error.name, 'ExploreLlmValidationError');
    assert.equal(error.normalizedOutput, normalized);
    assert.equal(error.rawOutput, raw);
    assert.deepEqual(extractRejectedPlanSteps(error.normalizedOutput, error.rawOutput), [
      { id: 1, action: 'click', element_id: 'E1' },
    ]);
  });

  it('formatLlmValidationErrorForPrompt summarizes invalid element_id on a step', () => {
    const normalized = {
      action: 'append_steps',
      steps: [
        { id: 1, action: 'click', element_id: 'E4' },
        { id: 2, action: 'click', element_id: 'E78' },
        { id: 3, action: 'fill', element_id: 'destination-input', value: 'Madrid' },
      ],
    };
    const error = {
      issues: [
        {
          code: 'invalid_format',
          path: ['steps', 2, 'element_id'],
          message: 'Invalid string: must match pattern /^E[1-9]\\d*$/',
        },
      ],
    };

    const message = formatLlmValidationErrorForPrompt(error, normalized);

    assert.equal(
      message,
      'fill element_id=destination-input value="Madrid" failed validation - element_id: got "destination-input" — use a shortId from Current inventory (e.g. E4), not a selector or DOM id',
    );
  });

  it('formatLlmValidationErrorForPrompt lists multiple issues', () => {
    const normalized = {
      action: 'nope',
      steps: [{ id: 0, action: 'click', element_id: 'bad' }],
    };
    const error = {
      issues: [
        {
          code: 'invalid_value',
          path: ['action'],
          message: 'Invalid option',
          options: ['append_steps', 'scenario_complete', 'abort'],
          received: 'nope',
        },
        {
          code: 'invalid_format',
          path: ['steps', 0, 'element_id'],
          message: 'Invalid string',
        },
      ],
    };

    const message = formatLlmValidationErrorForPrompt(error, normalized);

    assert.match(
      message,
      /^action=nope steps=\[click element_id=bad\] failed validation - action: got "nope"/,
    );
    assert.match(message, /append_steps \| scenario_complete \| abort/);
    assert.match(message, /click element_id=bad failed validation/);
  });

  it('formatLlmValidationErrorForPrompt includes full plan line for top-level rationale errors', () => {
    const normalized = {
      action: 'append_steps',
      rationale: '',
      steps: [{ id: 1, action: 'click', element_id: 'E4' }],
    };
    const error = {
      issues: [
        {
          code: 'too_small',
          path: ['rationale'],
          message: 'Too small: expected string to have >=1 characters',
        },
      ],
    };

    const message = formatLlmValidationErrorForPrompt(error, normalized);

    assert.match(
      message,
      /^action=append_steps rationale="" steps=\[click element_id=E4\] failed validation - rationale:/,
    );
  });
});
