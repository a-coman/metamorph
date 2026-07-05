import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  formatCompareOperator,
  formatObservationValue,
  observationValuesMatch,
  parseRunEvaluation,
  parseRunInputBundleError,
} from './run-evaluation.ts';

const passRunBundle = {
  evaluation_details: {
    search_query: {
      ok: true,
      source: '"auriculares inalambricos bluetooth"',
      compare: 'equal',
      followUp: '"auriculares inalambricos bluetooth"',
    },
    url_pathname: {
      ok: true,
      source: '/s',
      compare: 'equal',
      followUp: '/s',
    },
    product_titles: {
      ok: true,
      source: [],
      compare: 'set_equal',
      followUp: [],
    },
    active_brand_sony: {
      ok: true,
      source: true,
      compare: 'equal',
      followUp: true,
    },
    result_count_label: {
      ok: true,
      source: '42 resultados para',
      compare: 'equal',
      followUp: '42 resultados para',
    },
    active_rating_4_plus: {
      ok: true,
      source: true,
      compare: 'equal',
      followUp: true,
    },
  },
};

const failRunBundle = {
  evaluation_details: {
    search_query: {
      ok: true,
      source: 'laptop',
      compare: 'equal',
      followUp: 'laptop',
    },
    total_result_count: {
      ok: true,
      source: 5000,
      compare: 'cardinality_lte',
      followUp: 456,
    },
    visible_product_titles: {
      ok: false,
      source: [],
      compare: 'cardinality_lte',
      followUp: [],
    },
  },
};

describe('formatCompareOperator', () => {
  it('maps compare operators to short labels', () => {
    assert.equal(formatCompareOperator('equal'), '=');
    assert.equal(formatCompareOperator('set_equal'), 'set =');
    assert.equal(formatCompareOperator('cardinality_lte'), '≤');
    assert.equal(formatCompareOperator('custom'), 'custom');
  });
});

describe('observationValuesMatch', () => {
  it('compares formatted display values', () => {
    assert.equal(observationValuesMatch('foo', 'foo'), true);
    assert.equal(observationValuesMatch(42, 42), true);
    assert.equal(observationValuesMatch('foo', 'bar'), false);
  });
});

describe('formatObservationValue', () => {
  it('formats primitives and missing values', () => {
    assert.equal(formatObservationValue(null), '—');
    assert.equal(formatObservationValue(undefined), '—');
    assert.equal(formatObservationValue(42), '42');
    assert.equal(formatObservationValue(true), 'true');
    assert.equal(formatObservationValue('laptop'), 'laptop');
  });

  it('truncates long strings and serialized arrays', () => {
    const long = 'a'.repeat(100);
    assert.equal(formatObservationValue(long).endsWith('…'), true);
    assert.equal(formatObservationValue(long).length, 81);
    assert.equal(formatObservationValue(['x', 'y']), '["x","y"]');
  });
});

describe('parseRunEvaluation', () => {
  it('returns null when evaluation_details is missing', () => {
    assert.equal(parseRunEvaluation(null), null);
    assert.equal(parseRunEvaluation({}), null);
    assert.equal(parseRunEvaluation({ error: 'boom' }), null);
  });

  it('parses a passing run with sorted keys', () => {
    const evaluation = parseRunEvaluation(passRunBundle);
    assert.ok(evaluation);
    assert.equal(evaluation.totalCount, 6);
    assert.equal(evaluation.passedCount, 6);
    assert.equal(evaluation.failedCount, 0);
    assert.deepEqual(evaluation.failedKeys, []);
    assert.deepEqual(evaluation.sortedKeys, [
      'active_brand_sony',
      'active_rating_4_plus',
      'product_titles',
      'result_count_label',
      'search_query',
      'url_pathname',
    ]);
  });

  it('parses a failing run and collects failed keys', () => {
    const evaluation = parseRunEvaluation(failRunBundle);
    assert.ok(evaluation);
    assert.equal(evaluation.totalCount, 3);
    assert.equal(evaluation.passedCount, 2);
    assert.equal(evaluation.failedCount, 1);
    assert.deepEqual(evaluation.failedKeys, ['visible_product_titles']);
    assert.equal(evaluation.details.visible_product_titles?.ok, false);
    assert.deepEqual(evaluation.displayKeys, [
      'visible_product_titles',
      'search_query',
      'total_result_count',
    ]);
  });

  it('parses field-level error messages', () => {
    const evaluation = parseRunEvaluation({
      evaluation_details: {
        result_count: {
          ok: false,
          source: 10,
          followUp: null,
          compare: 'cardinality_lte',
          error: 'Missing observation value',
        },
      },
    });
    assert.ok(evaluation);
    assert.equal(evaluation.details.result_count?.error, 'Missing observation value');
  });
});

describe('parseRunInputBundleError', () => {
  it('extracts execution errors from input bundle', () => {
    assert.equal(parseRunInputBundleError({ error: 'Playbook timeout' }), 'Playbook timeout');
    assert.equal(parseRunInputBundleError(passRunBundle), null);
  });
});
