import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { compilePlaybook } from './playbook-compiler.js';
import { computeReplayBundleHash } from '../../domain/replay-bundle-hash.js';
import type { GenerationSlots } from '../../domain/schemas/generation-slots.schema.js';
import type { PageSnapshotInventory } from '../../domain/schemas/page-snapshot.schema.js';
import { OBSERVATION_SPEC_SCHEMA_VERSION } from '../../domain/schemas/observable.schema.js';

const anchorSnapshotId = '00000000-0000-4000-8000-000000000001';

const inventory: PageSnapshotInventory = {
  url: 'https://example.com/s?k=test',
  capturedAt: new Date().toISOString(),
  pageMetrics: { width: 1280, height: 720 },
  viewport: { width: 1280, height: 720 },
  labeledCount: 2,
  items: [
    {
      index: 0,
      shortId: 'E1',
      locator: 'getByRole("searchbox")',
      selector: 'input',
      score: 1,
      labelShown: true,
      tagName: 'input',
      id: null,
      role: 'searchbox',
      name: 'Search',
      ariaLabel: null,
      locatorMatchCount: 1,
    },
  ],
  observationItems: [
    {
      index: 0,
      shortId: 'E1',
      locator: null,
      selector: '.s-breadcrumb-header-text',
      score: 0,
      labelShown: false,
      tagName: 'div',
      id: null,
      role: null,
      name: null,
      ariaLabel: null,
      textPreview: '1-48 de más de 30.000 resultados',
      selectorMatchCount: 1,
    },
    {
      index: 1,
      shortId: 'E2',
      locator: 'getByRole("searchbox")',
      selector: 'input',
      score: 0,
      labelShown: false,
      tagName: 'input',
      id: null,
      role: 'searchbox',
      name: 'Search',
      ariaLabel: null,
      locatorMatchCount: 1,
    },
  ],
};

const slots: GenerationSlots = {
  source: {
    steps: [{ id: 1, action: 'click', element_id: 'E1' }],
  },
  follow_up: {
    steps: [{ id: 1, action: 'click', element_id: 'E1' }],
  },
  observation: {
    schemaVersion: OBSERVATION_SPEC_SCHEMA_VERSION,
    observables: [
      {
        key: 'search_query',
        valueType: 'string',
        compare: 'equal',
        binding: {
          kind: 'input_value',
          inventory_snapshot_id: anchorSnapshotId,
          element_id: 'E2',
        },
        rationale: 'Search query should stay stable',
      },
      {
        key: 'result_count',
        valueType: 'number',
        compare: 'cardinality_lte',
        binding: {
          kind: 'number_from_label',
          inventory_snapshot_id: anchorSnapshotId,
          element_id: 'E1',
          number_index: 2,
        },
        rationale: 'Result count should not increase',
      },
    ],
  },
};

describe('compilePlaybook with observables', () => {
  it('embeds dynamic observable extractors', () => {
    const anchorInventories = new Map([[anchorSnapshotId, inventory]]);

    const compiled = compilePlaybook(
      slots,
      {
        precondition: { description: 'pre' },
        transformation: {
          transform_family: 'subset',
          description: 'filter',
        },
        relation: {
          on: ['search_query', 'result_count'],
          description: 'count',
        },
      },
      inventory,
      { anchorInventories, sessionUrl: 'https://example.com/' },
    );

    assert.match(compiled.playbookContent, /result_count:/);
    assert.match(compiled.playbookContent, /search_query:/);
    assert.match(compiled.playbookContent, /\.s-breadcrumb-header-text/);
    assert.match(compiled.playbookContent, /parseLocalizedNumbers/);
    assert.match(compiled.playbookContent, /__stablePollCount/);
    assert.match(compiled.playbookContent, /waitUntil: 'load'/);
    assert.equal(compiled.templateVersion, 'playbook-template@5');
    assert.deepEqual(
      compiled.observationSpec.observables.map(({ key }) => key),
      slots.observation.observables.map(({ key }) => key),
    );
    assert.equal(
      compiled.observationSpec.schemaVersion,
      slots.observation.schemaVersion,
    );
    assert.deepEqual(
      {
        contentHash: compiled.contentHash,
        replayBundleHash: compiled.replayBundleHash,
      },
      computeReplayBundleHash({
        playbookContent: compiled.playbookContent,
        observationSpec: compiled.observationSpec,
        templateVersion: compiled.templateVersion,
      }),
    );
  });

  it('allows press steps whose element_id belongs to a later snapshot inventory', () => {
    const crossSnapshotSlots: GenerationSlots = {
      source: {
        steps: [
          {
            id: 1,
            action: 'fill',
            element_id: 'E1',
            value: 'laptop',
            resolved_locator:
              'getByRole("searchbox", { name: "Search", exact: true })',
          },
          { id: 2, action: 'press', element_id: 'E1', key: 'Enter' },
        ],
      },
      follow_up: {
        steps: [
          {
            id: 1,
            action: 'fill',
            element_id: 'E94',
            value: 'laptop',
            resolved_locator:
              'getByRole("searchbox", { name: "Search", exact: true })',
          },
          { id: 2, action: 'press', element_id: 'E94', key: 'Enter' },
        ],
      },
      observation: {
        schemaVersion: OBSERVATION_SPEC_SCHEMA_VERSION,
        observables: [
          {
            key: 'pathname',
            valueType: 'string',
            compare: 'equal',
            binding: {
              kind: 'url_pathname',
              inventory_snapshot_id: anchorSnapshotId,
            },
            rationale: 'URL pathname stable',
          },
        ],
      },
    };

    const compiled = compilePlaybook(
      crossSnapshotSlots,
      {
        precondition: { description: 'pre' },
        transformation: {
          transform_family: 'idempotence',
          description: 'repeat search',
        },
        relation: {
          on: ['pathname'],
          description: 'same results',
        },
      },
      inventory,
      {
        anchorInventories: new Map([[anchorSnapshotId, inventory]]),
      },
    );

    assert.match(compiled.playbookContent, /keyboard\.press\("Enter"\)/);
  });

  it('uses fill_behavior on step instead of compile-time inventory for combobox fill', () => {
    const initialSnapshotInventory: PageSnapshotInventory = {
      url: 'https://www.renfe.com/es/es',
      capturedAt: new Date().toISOString(),
      pageMetrics: { width: 1280, height: 720 },
      viewport: { width: 1280, height: 720 },
      labeledCount: 1,
      items: [
        {
          index: 0,
          shortId: 'E12',
          locator:
            'getByRole("button", { name: "Configuración de cookies", exact: true })',
          selector: '#onetrust-pc-btn-handler',
          score: 75,
          labelShown: true,
          tagName: 'button',
          id: 'onetrust-pc-btn-handler',
          role: 'button',
          name: 'Configuración de cookies',
          ariaLabel: 'Configuración de cookies',
          locatorMatchCount: 1,
          selectorMatchCount: 1,
        },
      ],
    };

    const crossSnapshotSlots: GenerationSlots = {
      source: {
        steps: [
          {
            id: 1,
            action: 'fill',
            element_id: 'E12',
            value: 'Madrid',
            resolved_locator:
              'getByRole("combobox", { name: "Origen", exact: true })',
            fill_behavior: 'autocomplete',
          },
        ],
      },
      follow_up: { steps: [{ id: 1, action: 'press', key: 'Enter' }] },
      observation: {
        schemaVersion: OBSERVATION_SPEC_SCHEMA_VERSION,
        observables: [
          {
            key: 'pathname',
            valueType: 'string',
            compare: 'equal',
            binding: {
              kind: 'url_pathname',
              inventory_snapshot_id: anchorSnapshotId,
            },
            rationale: 'pathname',
          },
        ],
      },
    };

    const compiled = compilePlaybook(
      crossSnapshotSlots,
      {
        precondition: { description: 'pre' },
        transformation: {
          transform_family: 'idempotence',
          description: 'search',
        },
        relation: {
          on: ['pathname'],
          description: 'same results',
        },
      },
      initialSnapshotInventory,
      {
        anchorInventories: new Map([
          [anchorSnapshotId, initialSnapshotInventory],
        ]),
      },
    );

    assert.match(compiled.playbookContent, /getByRole\('option'/);
    assert.match(compiled.playbookContent, /waitForTimeout\(400\)/);
  });
});
