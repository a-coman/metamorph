import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { derivePlanFailureType } from './plan-explore-errors';

describe('derivePlanFailureType', () => {
  it('classifies schema validation failures', () => {
    assert.equal(
      derivePlanFailureType('action=append_steps steps=(empty) failed validation - steps: required'),
      'validation_error',
    );
  });

  it('classifies empty append_steps plans', () => {
    assert.equal(
      derivePlanFailureType('Plan returned append_steps with no executable steps'),
      'empty_steps',
    );
  });

  it('classifies unknown inventory ids', () => {
    assert.equal(
      derivePlanFailureType('Unknown element_ids: E99'),
      'invalid_element_ids',
    );
  });

  it('classifies invalid fill targets', () => {
    assert.equal(
      derivePlanFailureType('fill not allowed on E46 (not input/textarea/combobox).'),
      'invalid_fill_target',
    );
  });
});
