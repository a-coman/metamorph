import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { InventoryItem } from '../../domain/schemas/page-snapshot.schema.js';
import { PlaybookCompileError } from './playbook-compiler.js';
import {
  resolveInventoryItemTarget,
  resolveInventoryItemTargetCandidates,
} from './resolve-inventory-target.js';
import { resolveStepTargets } from './probe-spec-compiler.js';

function baseItem(overrides: Partial<InventoryItem> = {}): InventoryItem {
  return {
    index: 0,
    shortId: 'E3',
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

  it('falls back to the unverified locator when nothing is verified', () => {
    const target = resolveInventoryItemTarget(
      baseItem({
        locatorMatchCount: 3,
        selectorMatchCount: 2,
      }),
    );

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

  it('uses selector fallback when counts are missing', () => {
    const target = resolveInventoryItemTarget(
      baseItem({
        locator: null,
        locatorMatchCount: undefined,
        selectorMatchCount: undefined,
      }),
    );

    assert.equal(target.kind, 'selector');
    assert.equal(target.value, '#nav-logo-sprites');
  });

  it('uses the unverified locator when the selector is missing', () => {
    const target = resolveInventoryItemTarget(
      baseItem({
        locator: 'getByRole("link", { name: "Amazon.es" })',
        selector: '',
        locatorMatchCount: undefined,
        selectorMatchCount: undefined,
      }),
    );

    assert.equal(target.kind, 'locator');
    assert.equal(target.value, 'getByRole("link", { name: "Amazon.es" })');
  });

  it('throws only when locator, selector, and candidates are all missing', () => {
    assert.throws(
      () =>
        resolveInventoryItemTarget(
          baseItem({
            locator: null,
            selector: '',
            locatorMatchCount: undefined,
            selectorMatchCount: undefined,
          }),
        ),
      (error: unknown) => {
        assert.ok(error instanceof PlaybookCompileError);
        assert.match((error as Error).message, /No target for E3/);
        return true;
      },
    );
  });

  it('prefers scan-time candidates over legacy locator and selector fields', () => {
    const target = resolveInventoryItemTarget(
      baseItem({
        candidates: ['getByRole("button", { name: "Buy", exact: true })'],
        locatorMatchCount: 1,
        selectorMatchCount: 1,
      }),
    );

    assert.equal(target.kind, 'locator');
    assert.equal(target.value, 'getByRole("button", { name: "Buy", exact: true })');
  });
});

describe('resolveInventoryItemTargetCandidates', () => {
  it('orders candidates, then verified locator, then verified selector', () => {
    const candidates = resolveInventoryItemTargetCandidates(
      baseItem({
        candidates: ['getByRole("button", { name: "Buy", exact: true })'],
        locatorMatchCount: 1,
        selectorMatchCount: 1,
      }),
    );

    assert.deepEqual(candidates, [
      { kind: 'locator', value: 'getByRole("button", { name: "Buy", exact: true })' },
      { kind: 'locator', value: 'getByRole("link", { name: "Amazon.es" })' },
      { kind: 'selector', value: '#nav-logo-sprites' },
    ]);
  });

  it('dedupes a selector already present as a locator("css") candidate', () => {
    const candidates = resolveInventoryItemTargetCandidates(
      baseItem({
        candidates: ['locator("#nav-logo-sprites")'],
        locator: null,
        locatorMatchCount: undefined,
        selectorMatchCount: 1,
      }),
    );

    assert.deepEqual(candidates, [
      { kind: 'locator', value: 'locator("#nav-logo-sprites")' },
    ]);
  });

  it('excludes unverified fields when a verified candidate exists', () => {
    const candidates = resolveInventoryItemTargetCandidates(
      baseItem({
        candidates: ['getByRole("button", { name: "Buy", exact: true })'],
        locatorMatchCount: 3,
        selectorMatchCount: 2,
      }),
    );

    assert.deepEqual(candidates, [
      { kind: 'locator', value: 'getByRole("button", { name: "Buy", exact: true })' },
    ]);
  });
});

describe('resolveStepTargets', () => {
  it('attaches resolved_selector when locator is ambiguous', () => {
    const [step] = resolveStepTargets(
      [{ id: 1, action: 'click', element_id: 'E3' }],
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

  it('does not attach resolved targets to scroll steps', () => {
    const [step] = resolveStepTargets(
      [{ id: 1, action: 'scroll', scroll_y: 500, element_id: 'E3' }],
      {
        url: 'https://www.amazon.es/',
        capturedAt: new Date().toISOString(),
        pageMetrics: { width: 1280, height: 800 },
        viewport: { width: 1280, height: 800 },
        labeledCount: 1,
        items: [baseItem()],
      },
    );

    assert.equal(step.resolved_locator, undefined);
    assert.equal(step.resolved_selector, undefined);
  });
});
