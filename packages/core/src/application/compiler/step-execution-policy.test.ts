import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { InventoryItem } from '../../domain/schemas/page-snapshot.schema.js';
import {
  isComboboxInventoryItem,
  isFillableInventoryItem,
  renderGotoCode,
  renderPostStepStabilizationCode,
  resolveStepFillBehavior,
  shouldEndProbeBatchAfterStep,
  shouldRefreshInventoryAfterAction,
  trimProbeBatchAtMutatingStep,
} from './step-execution-policy.js';

function item(overrides: Partial<InventoryItem> & Pick<InventoryItem, 'tagName'>): InventoryItem {
  return {
    index: 0,
    shortId: 'E1',
    locator: null,
    selector: '#x',
    score: 100,
    labelShown: false,
    id: null,
    role: null,
    name: null,
    ariaLabel: null,
    textPreview: null,
    ...overrides,
  };
}

describe('isFillableInventoryItem', () => {
  it('treats input and textarea as fillable', () => {
    assert.equal(isFillableInventoryItem(item({ tagName: 'input', role: 'textbox' })), true);
    assert.equal(isFillableInventoryItem(item({ tagName: 'textarea', role: 'textbox' })), true);
  });

  it('excludes native select even when role is combobox', () => {
    assert.equal(
      isFillableInventoryItem(item({ tagName: 'select', role: 'combobox' })),
      false,
    );
  });

  it('treats custom combobox roles as fillable', () => {
    assert.equal(
      isFillableInventoryItem(item({ tagName: 'div', role: 'combobox' })),
      true,
    );
  });
});

describe('isComboboxInventoryItem', () => {
  it('excludes native select', () => {
    assert.equal(isComboboxInventoryItem(item({ tagName: 'select', role: 'combobox' })), false);
  });

  it('includes custom combobox and searchbox', () => {
    assert.equal(isComboboxInventoryItem(item({ tagName: 'div', role: 'combobox' })), true);
    assert.equal(isComboboxInventoryItem(item({ tagName: 'input', role: 'searchbox' })), true);
  });
});

describe('resolveStepFillBehavior', () => {
  it('returns autocomplete when fill_behavior is autocomplete', () => {
    assert.equal(
      resolveStepFillBehavior({
        id: 1,
        action: 'fill',
        fill_behavior: 'autocomplete',
      }),
      'autocomplete',
    );
  });

  it('returns plain when fill_behavior is plain or unset', () => {
    assert.equal(
      resolveStepFillBehavior({
        id: 1,
        action: 'fill',
        fill_behavior: 'plain',
      }),
      'plain',
    );
    assert.equal(
      resolveStepFillBehavior({
        id: 1,
        action: 'fill',
      }),
      'plain',
    );
  });
});

describe('renderGotoCode', () => {
  it('uses load waitUntil for navigation', () => {
    assert.match(renderGotoCode('https://example.com'), /waitUntil: 'load'/);
  });
});

describe('renderPostStepStabilizationCode', () => {
  it('differs between goto and click actions', () => {
    const gotoCode = renderPostStepStabilizationCode('  ', 'goto');
    const clickCode = renderPostStepStabilizationCode('  ', 'click');
    assert.notEqual(gotoCode, clickCode);
    assert.match(gotoCode, /networkidle/);
    assert.match(clickCode, /domcontentloaded/);
    assert.match(gotoCode, /__maxMs = 8000/);
    assert.match(clickCode, /__maxMs = 5000/);
  });
});

describe('probe batch mutation policy', () => {
  it('marks page and viewport mutating actions as inventory refresh points', () => {
    for (const action of ['goto', 'click', 'fill', 'press', 'scroll', 'selectOption'] as const) {
      assert.equal(shouldRefreshInventoryAfterAction(action), true);
      assert.equal(shouldEndProbeBatchAfterStep({ id: 1, action }), true);
    }

    assert.equal(shouldRefreshInventoryAfterAction('waitFor'), false);
    assert.equal(shouldEndProbeBatchAfterStep({ id: 1, action: 'waitFor' }), false);
  });

  it('trims a batch after the first mutating step', () => {
    const steps = [
      { id: 1, action: 'waitFor' as const, timeout_ms: 250 },
      { id: 2, action: 'fill' as const, element_id: 'E1', value: 'Paris' },
      { id: 3, action: 'click' as const, element_id: 'E2' },
    ];

    assert.deepEqual(trimProbeBatchAtMutatingStep(steps), steps.slice(0, 2));
  });

  it('keeps batches with no mutating step unchanged', () => {
    const steps = [
      { id: 1, action: 'waitFor' as const, timeout_ms: 250 },
      { id: 2, action: 'waitFor' as const, timeout_ms: 250 },
    ];

    assert.deepEqual(trimProbeBatchAtMutatingStep(steps), steps);
  });
});
