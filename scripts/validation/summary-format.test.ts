import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  countColumnValues,
  formatPercent,
  hasFilledColumn,
  mdTable,
  yesNoRates,
} from './summary-format.js';

describe('summary-format', () => {
  it('renders markdown tables', () => {
    const table = mdTable(['A', 'B'], [['1', '2']]);
    assert.match(table, /\| A \| B \|/);
    assert.match(table, /\| 1 \| 2 \|/);
  });

  it('formats percentages', () => {
    assert.equal(formatPercent(0.256), '25.6%');
    assert.equal(formatPercent(null), 'n/a');
  });

  it('detects filled CSV columns', () => {
    const rows = [{ triage: '' }, { triage: 'bug' }];
    assert.equal(hasFilledColumn(rows, 'triage'), true);
    assert.equal(hasFilledColumn([{ triage: '' }], 'triage'), false);
  });

  it('counts column values and yes rates', () => {
    const rows = [
      { label: 'false_positive' },
      { label: 'bug' },
      { label: 'bug' },
    ];
    assert.deepEqual(countColumnValues(rows, 'label'), {
      false_positive: 1,
      bug: 2,
    });

    const rubric = [
      { meaningful_transformation: 'yes', observables_adequate: 'no' },
      { meaningful_transformation: 'yes', observables_adequate: 'yes' },
    ];
    const rates = yesNoRates(rubric, ['meaningful_transformation', 'observables_adequate']);
    assert.equal(rates[0]?.yes, 2);
    assert.equal(rates[1]?.yes, 1);
  });
});
