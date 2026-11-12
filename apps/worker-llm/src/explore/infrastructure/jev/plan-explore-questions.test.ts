import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { InventoryItem, MrIntent, PageSnapshotInventory } from '@metamorph/core';
import { EMPTY_BATCH_LOG, appendBatchRecord } from '../graph/batch-log.js';
import { JEV_CHOICE_MAX, NONE_CHOICE } from './jev-plan-explore.constants.js';
import {
  buildPlanExploreJevRequest,
  capItemsByScore,
  extractSourceQuery,
  isOverlayCandidate,
  isSelectOptionInventoryItem,
  pageKindFromUrl,
  pickActionCandidates,
} from './plan-explore-questions.js';

function item(overrides: Partial<InventoryItem> & Pick<InventoryItem, 'shortId' | 'tagName'>): InventoryItem {
  return {
    index: 0,
    locator: null,
    selector: '#x',
    score: 10,
    labelShown: false,
    id: null,
    role: null,
    name: null,
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
    follow_up_phase_goal: 'Repeat search with filter',
  },
};

function inventoryWith(items: InventoryItem[], url = 'https://www.example.com/'): PageSnapshotInventory {
  return {
    url,
    capturedAt: '2026-01-01T00:00:00.000Z',
    pageMetrics: { width: 1920, height: 1080 },
    viewport: { width: 1920, height: 1080 },
    items,
    labeledCount: items.length,
  };
}

describe('capItemsByScore', () => {
  it('keeps the highest scores when over the cap', () => {
    const items = Array.from({ length: 5 }, (_, index) =>
      item({ shortId: `E${index + 1}`, tagName: 'button', score: index }),
    );
    const capped = capItemsByScore(items, 2);
    assert.deepEqual(
      capped.map((entry) => entry.shortId),
      ['E5', 'E4'],
    );
  });

  it('defaults to JEV_CHOICE_MAX', () => {
    const items = Array.from({ length: JEV_CHOICE_MAX + 5 }, (_, index) =>
      item({ shortId: `E${index + 1}`, tagName: 'button', score: index }),
    );
    assert.equal(capItemsByScore(items).length, JEV_CHOICE_MAX);
  });
});

describe('pageKindFromUrl', () => {
  it('classifies amazon search results', () => {
    assert.equal(pageKindFromUrl('https://www.amazon.es/s?k=laptop'), 'search_results');
    assert.equal(pageKindFromUrl('https://www.amazon.es/'), 'home');
  });
});

describe('pickActionCandidates', () => {
  it('drops unlabeled nav links and keeps search, overlay, and buttons', () => {
    const items = [
      item({ shortId: 'E1', tagName: 'a', role: 'link', name: 'Ofertas', score: 90 }),
      item({
        shortId: 'E2',
        tagName: 'input',
        role: 'searchbox',
        name: 'Buscar',
        score: 20,
      }),
      item({
        shortId: 'E3',
        tagName: 'button',
        role: 'button',
        name: 'Aceptar cookies',
        score: 15,
      }),
      item({ shortId: 'E4', tagName: 'button', role: 'button', name: 'Ir', score: 10 }),
    ];
    const picked = pickActionCandidates(items).map((entry) => entry.shortId);
    assert.equal(picked.includes('E1'), false);
    assert.equal(picked.includes('E2'), true);
    assert.equal(picked.includes('E3'), true);
    assert.equal(picked.includes('E4'), true);
  });
});

describe('isOverlayCandidate', () => {
  it('matches cookie buttons', () => {
    assert.equal(
      isOverlayCandidate(
        item({ shortId: 'E1', tagName: 'button', role: 'button', name: 'Aceptar cookies' }),
      ),
      true,
    );
    assert.equal(
      isOverlayCandidate(item({ shortId: 'E2', tagName: 'a', role: 'link', name: 'Ofertas' })),
      false,
    );
  });
});

describe('buildPlanExploreJevRequest', () => {
  it('builds independent nouls and a next_control choice over filtered controls', () => {
    const { state, questions } = buildPlanExploreJevRequest({
      url: 'https://www.amazon.es/s?k=laptop',
      phase: 'source',
      mrIntent,
      inventory: inventoryWith(
        [
          item({ shortId: 'E1', tagName: 'a', role: 'link', name: 'Nav', score: 80 }),
          item({
            shortId: 'E2',
            tagName: 'input',
            role: 'searchbox',
            name: 'Query',
          }),
          item({
            shortId: 'E3',
            tagName: 'select',
            role: 'combobox',
            name: 'Sort',
            options: [
              { value: 'price', label: 'Price' },
              { value: 'rel', label: 'Relevance' },
            ],
          }),
        ],
        'https://www.amazon.es/s?k=laptop',
      ),
      batchLog: EMPTY_BATCH_LOG,
    });

    assert.equal(state.phase_goal, 'Search for laptops');
    assert.equal(state.page_kind, 'search_results');
    assert.equal(state.url, 'https://www.amazon.es/s?k=laptop');
    assert.equal(
      state.controls.some((row) => row.id === 'E1'),
      false,
    );
    assert.ok(questions.goal_already_met);
    assert.ok(questions.next_control);
    assert.equal(questions.plan_action, undefined);
    assert.equal(questions.operation, undefined);
    assert.match(questions.next_control.instructions, /`phase_goal`/);
    assert.equal(questions.next_control.instructions.includes('Ignore unless'), false);
    if (questions.next_control.type === 'choice') {
      assert.equal(NONE_CHOICE in questions.next_control.criteria, true);
      assert.equal('E2' in questions.next_control.criteria, true);
      assert.equal('E3' in questions.next_control.criteria, true);
    }
  });
});

describe('extractSourceQuery', () => {
  it('reads the last committed source fill', () => {
    const batchLog = appendBatchRecord(EMPTY_BATCH_LOG, 'source', {
      steps: [{ id: 1, action: 'fill', element_id: 'E4', value: 'ofertas' }],
      outcome: 'committed',
    });
    assert.equal(extractSourceQuery({ batchLog }), 'ofertas');
  });

  it('falls back to source_reference step text', () => {
    assert.equal(
      extractSourceQuery({
        batchLog: EMPTY_BATCH_LOG,
        sourceReference: {
          exploredSteps: ['click button "Aceptar"', 'fill searchbox "Buscar" with "laptop"'],
        },
      }),
      'laptop',
    );
  });
});

describe('isSelectOptionInventoryItem', () => {
  it('requires options on select or combobox', () => {
    assert.equal(
      isSelectOptionInventoryItem(
        item({ shortId: 'E1', tagName: 'select', options: [{ value: 'a', label: 'A' }] }),
      ),
      true,
    );
    assert.equal(
      isSelectOptionInventoryItem(item({ shortId: 'E2', tagName: 'select' })),
      false,
    );
  });
});
