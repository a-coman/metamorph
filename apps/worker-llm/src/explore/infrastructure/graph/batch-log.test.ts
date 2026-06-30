import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  appendBatchRecord,
  collectCommittedExploredSteps,
  EMPTY_BATCH_LOG,
  finalizeLastPendingBatch,
  findLatestProbeFailureScreenshotId,
  formatBatchLogForPrompt,
  getLastPendingBatchRationale,
  nextBatchNumber,
} from './batch-log.js';

describe('batch-log', () => {
  it('assigns incrementing batch numbers per phase', () => {
    let log = appendBatchRecord(EMPTY_BATCH_LOG, 'source', {
      steps: [{ id: 1, action: 'click', element_id: 'E1' }],
      outcome: 'plan_rejected',
      error: 'bad id',
    });

    log = appendBatchRecord(log, 'source', {
      steps: [{ id: 1, action: 'click', element_id: 'E2' }],
      outcome: 'pending',
    });

    assert.equal(nextBatchNumber(log, 'source'), 3);
    assert.equal(log.follow_up.length, 0);
  });

  it('finalizes the last pending batch', () => {
    let log = appendBatchRecord(EMPTY_BATCH_LOG, 'source', {
      steps: [{ id: 1, action: 'click', element_id: 'E4' }],
      outcome: 'pending',
    });

    log = finalizeLastPendingBatch(log, 'source', 'checkpoint_failed', {
      error: 'No search submitted',
    });

    assert.equal(log.source[0]?.outcome, 'checkpoint_failed');
    assert.equal(log.source[0]?.error, 'No search submitted');
  });

  it('finds the latest probe failure screenshot id', () => {
    let log = appendBatchRecord(EMPTY_BATCH_LOG, 'source', {
      steps: [{ id: 1, action: 'click', element_id: 'E1' }],
      outcome: 'probe_failed',
      screenshotBeforeSnapshotId: 'snap-a',
    });

    log = appendBatchRecord(log, 'source', {
      steps: [{ id: 1, action: 'click', element_id: 'E2' }],
      outcome: 'probe_failed',
      screenshotBeforeSnapshotId: 'snap-b',
    });

    assert.equal(findLatestProbeFailureScreenshotId(log, 'source'), 'snap-b');
  });

  it('collects rationales from committed batches only, in order', () => {
    let log = appendBatchRecord(EMPTY_BATCH_LOG, 'source', {
      steps: [{ id: 1, action: 'click', element_id: 'E1' }],
      outcome: 'committed',
      rationale: 'Dismiss cookie overlay.',
    });

    log = appendBatchRecord(log, 'source', {
      steps: [{ id: 2, action: 'fill', element_id: 'E2', value: 'laptop' }],
      outcome: 'plan_rejected',
      rationale: 'Rejected attempt',
      error: 'bad fill',
    });

    log = appendBatchRecord(log, 'source', {
      steps: [{ id: 2, action: 'fill', element_id: 'E2', value: 'portátil' }],
      outcome: 'committed',
      rationale: 'Search for portátil to reach results.',
    });

    log = appendBatchRecord(log, 'source', {
      steps: [{ id: 3, action: 'click', element_id: 'E3' }],
      outcome: 'probe_failed',
      rationale: 'Failed filter click',
    });

    assert.deepEqual(collectCommittedExploredSteps(log, 'source'), [
      'Dismiss cookie overlay.',
      'Search for portátil to reach results.',
    ]);
  });

  it('returns rationale from the last pending batch only', () => {
    let log = appendBatchRecord(EMPTY_BATCH_LOG, 'source', {
      steps: [{ id: 1, action: 'click', element_id: 'E1' }],
      outcome: 'committed',
      rationale: 'Old committed rationale.',
    });

    log = appendBatchRecord(log, 'source', {
      steps: [{ id: 2, action: 'fill', element_id: 'E2', value: 'laptop' }],
      outcome: 'pending',
      rationale: 'Search for laptop and submit.',
    });

    assert.equal(
      getLastPendingBatchRationale(log, 'source'),
      'Search for laptop and submit.',
    );

    log = finalizeLastPendingBatch(log, 'source', 'committed');
    assert.equal(getLastPendingBatchRationale(log, 'source'), undefined);
  });

  it('formats committed batches with rationale and steps sections', () => {
    const log = appendBatchRecord(EMPTY_BATCH_LOG, 'source', {
      steps: [{ id: 1, action: 'click', element_id: 'E35' }],
      outcome: 'committed',
      rationale: 'Dismiss cookie overlay before searching.',
    });

    const formatted = formatBatchLogForPrompt(log, 'source');

    assert.match(formatted.historySection, /Batch 1 \(committed\)/);
    assert.match(formatted.historySection, /rationale:/);
    assert.match(formatted.historySection, /- Dismiss cookie overlay before searching\./);
    assert.match(formatted.historySection, /steps:/);
    assert.match(formatted.historySection, /- click element_id=E35/);
    assert.doesNotMatch(formatted.historySection, /errors:/);
  });

  it('formats unified exploration history with inline errors for the prompt', () => {
    let log = appendBatchRecord(EMPTY_BATCH_LOG, 'source', {
      steps: [{ id: 1, action: 'click', element_id: 'E4' }],
      outcome: 'committed',
    });

    log = appendBatchRecord(log, 'source', {
      steps: [{ id: 2, action: 'fill', element_id: 'E46', value: 'London' }],
      outcome: 'plan_rejected',
      error: 'fill not allowed on E46',
    });

    const formatted = formatBatchLogForPrompt(log, 'source');

    assert.match(formatted.historySection, /Batch 1 \(committed\)/);
    assert.match(formatted.historySection, /Batch 2 \(uncommitted — plan_rejected\)/);
    assert.match(formatted.historySection, /errors:/);
    assert.match(formatted.historySection, /fill not allowed on E46/);
    assert.doesNotMatch(formatted.historySection, /Validated batches/);
  });

  it('formats probe_failed with rationale, steps, and multiline error', () => {
    const log = appendBatchRecord(EMPTY_BATCH_LOG, 'source', {
      steps: [
        { id: 1, action: 'click', element_id: 'E3' },
        { id: 2, action: 'fill', element_id: 'E1', value: 'auriculares' },
        { id: 3, action: 'press', element_id: 'E1', key: 'Enter' },
      ],
      outcome: 'probe_failed',
      rationale: 'Dismiss cookie banner, then search for auriculares and submit.',
      failedStep: { id: 1, action: 'click', element_id: 'E3' },
      error: "waiting for getByRole('textbox', { name: 'Rechazar' })\nlocator.click: Timeout 30000ms exceeded.",
    });

    const formatted = formatBatchLogForPrompt(log, 'source');
    const { historySection } = formatted;

    assert.match(historySection, /Batch 1 \(uncommitted — probe_failed\)/);
    assert.match(historySection, /rationale:/);
    assert.match(historySection, /- Dismiss cookie banner, then search for auriculares/);
    assert.match(historySection, /steps:/);
    assert.match(historySection, /- click element_id=E3/);
    assert.match(historySection, /errors:/);
    assert.match(historySection, /- failed step: click element_id=E3/);
    assert.match(historySection, /waiting for getByRole\('textbox'/);
    assert.match(historySection, /locator\.click: Timeout 30000ms exceeded\./);
    assert.doesNotMatch(historySection, /- locator\.click: Timeout/);

    const rationaleIndex = historySection.indexOf('rationale:');
    const stepsIndex = historySection.indexOf('steps:');
    const errorsIndex = historySection.indexOf('errors:');
    assert.ok(rationaleIndex < stepsIndex && stepsIndex < errorsIndex);
    assert.equal(formatted.latestProbeFailureBatch, 1);
  });

  it('formats probe_failed with failed step and multiline error as one bullet', () => {
    const log = appendBatchRecord(EMPTY_BATCH_LOG, 'source', {
      steps: [
        { id: 1, action: 'click', element_id: 'E3' },
        { id: 2, action: 'fill', element_id: 'E1', value: 'auriculares' },
      ],
      outcome: 'probe_failed',
      failedStep: { id: 1, action: 'click', element_id: 'E3' },
      error: "waiting for getByRole('textbox', { name: 'Rechazar' })\nlocator.click: Timeout 30000ms exceeded.",
    });

    const formatted = formatBatchLogForPrompt(log, 'source');

    assert.match(formatted.historySection, /Batch 1 \(uncommitted — probe_failed\)/);
    assert.match(formatted.historySection, /- failed step: click element_id=E3/);
    assert.match(formatted.historySection, /waiting for getByRole\('textbox'/);
    assert.match(formatted.historySection, /locator\.click: Timeout 30000ms exceeded\./);
    assert.doesNotMatch(
      formatted.historySection,
      /- locator\.click: Timeout/,
    );
    assert.equal(formatted.latestProbeFailureBatch, 1);
  });

  it('formats checkpoint_failed with inline error only', () => {
    let log = appendBatchRecord(EMPTY_BATCH_LOG, 'source', {
      steps: [{ id: 1, action: 'click', element_id: 'E4' }],
      outcome: 'pending',
    });

    log = finalizeLastPendingBatch(log, 'source', 'checkpoint_failed', {
      error: 'No search submitted',
    });

    const formatted = formatBatchLogForPrompt(log, 'source');

    assert.match(formatted.historySection, /Batch 1 \(uncommitted — checkpoint_failed\)/);
    assert.match(formatted.historySection, /errors:/);
    assert.match(formatted.historySection, /- No search submitted/);
    assert.doesNotMatch(formatted.historySection, /failed step:/);
  });

  it('includes rejected steps in history when plan_rejected carries steps from validation failure', () => {
    const log = appendBatchRecord(EMPTY_BATCH_LOG, 'source', {
      steps: [
        { id: 1, action: 'click', element_id: 'E4' },
        { id: 2, action: 'click', element_id: 'E78' },
        { id: 3, action: 'fill', element_id: 'destination-input', value: 'Madrid' },
      ],
      outcome: 'plan_rejected',
      error:
        'fill element_id=destination-input value="Madrid" failed validation - element_id: got "destination-input" — use a shortId from Current inventory (e.g. E4), not a selector or DOM id',
    });

    const formatted = formatBatchLogForPrompt(log, 'source');

    assert.match(formatted.historySection, /click element_id=E4/);
    assert.match(formatted.historySection, /fill element_id=destination-input/);
    assert.match(
      formatted.historySection,
      /fill element_id=destination-input value="Madrid" failed validation/,
    );
  });
});
