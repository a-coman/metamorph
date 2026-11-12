import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { InventoryItem } from '@metamorph/core';
import { assemblePlanExplore, JevPlanAssemblyError } from './assemble-plan-explore.js';
import type { JevAnswer } from './openrouter-decisions.client.js';
import { synthesizePlanRationale } from './synthesize-plan-rationale.js';

function item(overrides: Partial<InventoryItem> & Pick<InventoryItem, 'shortId' | 'tagName'>): InventoryItem {
  return {
    index: 0,
    locator: null,
    selector: '#x',
    score: 10,
    labelShown: false,
    id: null,
    role: 'button',
    name: 'Go',
    ariaLabel: null,
    textPreview: null,
    ...overrides,
  };
}

function choice(value: string, confidence = 0.9): JevAnswer {
  return { type: 'choice', choice: value, confidence };
}

function noul(value: number): JevAnswer {
  return { type: 'noul', noul: value };
}

describe('assemblePlanExplore', () => {
  const cookie = item({
    shortId: 'E42',
    tagName: 'button',
    role: 'button',
    name: 'Aceptar cookies',
  });
  const search = item({
    shortId: 'E1',
    tagName: 'input',
    role: 'searchbox',
    name: 'Buscar',
  });
  const sort = item({
    shortId: 'E3',
    tagName: 'select',
    role: 'combobox',
    name: 'Ordenar',
    options: [{ value: 'price', label: 'Price' }],
  });
  const inventoryById = new Map([
    [cookie.shortId, cookie],
    [search.shortId, search],
    [sort.shortId, sort],
  ]);

  it('aborts when permanently_blocked is high', () => {
    const output = assemblePlanExplore({
      answers: {
        permanently_blocked: noul(0.9),
        blocked_by: choice('captcha'),
      },
      inventoryById,
      nextStepId: 1,
    });
    assert.equal(output.action, 'abort');
    assert.match(output.rationale, /captcha/i);
  });

  it('clicks an overlay before other controls', () => {
    const output = assemblePlanExplore({
      answers: {
        permanently_blocked: noul(0.1),
        overlay_present: noul(0.8),
        overlay_target: choice('E42'),
        goal_already_met: noul(0.2),
        next_control: choice('E1'),
        page_settling: noul(0.1),
      },
      inventoryById,
      nextStepId: 1,
    });
    assert.equal(output.action, 'append_steps');
    assert.equal(output.steps[0]?.action, 'click');
    assert.equal(output.steps[0]?.element_id, 'E42');
  });

  it('completes when goal_already_met is high', () => {
    const output = assemblePlanExplore({
      answers: {
        permanently_blocked: noul(0.1),
        overlay_present: noul(0.1),
        overlay_target: choice('none'),
        goal_already_met: noul(0.92),
      },
      inventoryById,
      nextStepId: 1,
    });
    assert.equal(output.action, 'scenario_complete');
  });

  it('fills the next control and can prefix a wait', () => {
    const output = assemblePlanExplore({
      answers: {
        permanently_blocked: noul(0.1),
        overlay_present: noul(0.1),
        overlay_target: choice('none'),
        goal_already_met: noul(0.1),
        next_control: choice('E1'),
        page_settling: noul(0.8),
      },
      inventoryById,
      nextStepId: 4,
      fillValue: 'portátil',
    });
    assert.equal(output.action, 'append_steps');
    assert.equal(output.steps.length, 2);
    assert.equal(output.steps[0]?.action, 'waitFor');
    assert.equal(output.steps[1]?.action, 'fill');
    assert.equal(output.steps[1]?.value, 'portátil');
  });

  it('selects an option on a combobox next control', () => {
    const output = assemblePlanExplore({
      answers: {
        permanently_blocked: noul(0.05),
        overlay_present: noul(0.05),
        goal_already_met: noul(0.05),
        next_control: choice('E3'),
        page_settling: noul(0.1),
      },
      inventoryById,
      nextStepId: 1,
      selectValue: 'price',
    });
    assert.equal(output.steps[0]?.action, 'selectOption');
    assert.equal(output.steps[0]?.value, 'price');
  });

  it('scrolls when the needed control is missing', () => {
    const output = assemblePlanExplore({
      answers: {
        permanently_blocked: noul(0.05),
        overlay_present: noul(0.05),
        goal_already_met: noul(0.05),
        next_control: choice('none'),
        control_missing: noul(0.8),
        scroll_dir: choice('down'),
        page_settling: noul(0.1),
      },
      inventoryById,
      nextStepId: 1,
    });
    assert.equal(output.steps[0]?.action, 'scroll');
    assert.equal(output.steps[0]?.scroll_y, 800);
  });

  it('still uses a low-confidence next_control after scroll is not indicated', () => {
    const output = assemblePlanExplore({
      answers: {
        permanently_blocked: noul(0.05),
        overlay_present: noul(0.05),
        goal_already_met: noul(0.05),
        next_control: choice('E42', 0.22),
        control_missing: noul(0.1),
        page_settling: noul(0.1),
      },
      inventoryById,
      nextStepId: 1,
    });
    assert.equal(output.steps[0]?.action, 'click');
    assert.equal(output.steps[0]?.element_id, 'E42');
  });

  it('throws when nothing is actionable', () => {
    assert.throws(
      () =>
        assemblePlanExplore({
          answers: {
            permanently_blocked: noul(0.05),
            overlay_present: noul(0.05),
            goal_already_met: noul(0.05),
            next_control: choice('none'),
            control_missing: noul(0.1),
          },
          inventoryById,
          nextStepId: 1,
        }),
      JevPlanAssemblyError,
    );
  });
});

describe('synthesizePlanRationale', () => {
  it('joins wait and click from inventory names', () => {
    const button = item({
      shortId: 'E42',
      tagName: 'button',
      role: 'button',
      name: 'Aceptar cookies',
    });
    const rationale = synthesizePlanRationale({
      action: 'append_steps',
      steps: [
        { id: 1, action: 'waitFor', timeout_ms: 400 },
        { id: 2, action: 'click', element_id: 'E42' },
      ],
      inventoryById: new Map([[button.shortId, button]]),
    });
    assert.equal(rationale, 'wait 400ms, then click button "Aceptar cookies"');
  });
});
