import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { InventoryItem } from '../../domain/schemas/page-snapshot.schema.js';
import { PlaybookCompileError } from './playbook-compiler.js';
import { resolveInventoryItemTarget } from './resolve-inventory-target.js';
import { resolveStepTargets } from './probe-spec-compiler.js';

function baseItem(overrides: Partial<InventoryItem> = {}): InventoryItem {
  return {
    index: 0,
    shortId: 'E03',
    locator: 'getByRole("link", { name: "Amazon.es" })',
    selector: '#nav-logo-sprites',
    score: 100,
    labelShown: true,
    tagName: 'a',
    id: 'nav-logo-sprites',
    role: 'link',
    name: null,
    ariaLabel: 'Amazon.es',
    ...overrides,
  };
}

describe('resolveInventoryItemTarget', () => {
  it('uses locator when locatorMatchCount is 1', () => {
    const target = resolveInventoryItemTarget(
      baseItem({
        locator: 'getByRole("searchbox", { name: "Buscar" })',
        locatorMatchCount: 1,
        selectorMatchCount: 1,
      }),
    );

    assert.equal(target.kind, 'locator');
    assert.equal(target.value, 'getByRole("searchbox", { name: "Buscar" })');
  });

  it('falls back to selector when locator is ambiguous', () => {
    const target = resolveInventoryItemTarget(
      baseItem({
        locatorMatchCount: 3,
        selectorMatchCount: 1,
      }),
    );

    assert.equal(target.kind, 'selector');
    assert.equal(target.value, '#nav-logo-sprites');
  });

  it('throws when both locator and selector are ambiguous', () => {
    assert.throws(
      () =>
        resolveInventoryItemTarget(
          baseItem({
            locatorMatchCount: 3,
            selectorMatchCount: 2,
          }),
        ),
      (error: unknown) => {
        assert.ok(error instanceof PlaybookCompileError);
        assert.match((error as Error).message, /Ambiguous target for E03/);
        return true;
      },
    );
  });

  it('uses legacy locator-first behavior when counts are missing', () => {
    const target = resolveInventoryItemTarget(baseItem());

    assert.equal(target.kind, 'locator');
    assert.equal(target.value, 'getByRole("link", { name: "Amazon.es" })');
  });

  it('uses selector when locator is null and selector is unique', () => {
    const target = resolveInventoryItemTarget(
      baseItem({
        locator: null,
        locatorMatchCount: undefined,
        selectorMatchCount: 1,
      }),
    );

    assert.equal(target.kind, 'selector');
    assert.equal(target.value, '#nav-logo-sprites');
  });
});

describe('resolveStepTargets', () => {
  it('attaches resolved_selector when locator is ambiguous', () => {
    const [step] = resolveStepTargets(
      [{ id: 1, action: 'click', element_id: 'E03' }],
      {
        url: 'https://www.amazon.es/',
        capturedAt: new Date().toISOString(),
        pageMetrics: { width: 1280, height: 800 },
        viewport: { width: 1280, height: 800 },
        labeledCount: 1,
        items: [
          baseItem({
            locatorMatchCount: 3,
            selectorMatchCount: 1,
          }),
        ],
      },
    );

    assert.equal(step.resolved_selector, '#nav-logo-sprites');
    assert.equal(step.resolved_locator, undefined);
  });
});
