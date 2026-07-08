import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatEvaluationValue,
  listFailingObservables,
} from './verdict-triage-export.js';

describe('verdict-triage-export', () => {
  it('lists only failing observables with source and follow-up values', () => {
    const rows = listFailingObservables({
      evaluation_details: {
        query_text: {
          ok: true,
          compare: 'equal',
          source: 'react',
          followUp: 'react',
        },
        footer_link_vender_en_amazon: {
          ok: false,
          compare: 'equal',
          source: true,
          followUp: false,
          error: 'values differ',
        },
      },
    });

    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.observable, 'footer_link_vender_en_amazon');
    assert.equal(rows[0]?.sourceValue, 'true');
    assert.equal(rows[0]?.followUpValue, 'false');
    assert.equal(rows[0]?.error, 'values differ');
  });

  it('truncates long values', () => {
    const text = formatEvaluationValue('x'.repeat(250));
    assert.equal(text.length, 201);
    assert.match(text, /…$/);
  });
});
