import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  appendBatchRecord,
  EMPTY_BATCH_LOG,
  finalizeLastPendingBatch,
  findLatestProbeFailureScreenshotId,
  formatBatchLogForPrompt,
  nextBatchNumber,
} from './batch-log.js';

describe('batch-log', () => {
  it('assigns incrementing batch numbers per phase', () => {
    let log = appendBatchRecord(EMPTY_BATCH_LOG, 'source', {
      steps: [{ id: 1, action: 'click', element_id: 'E01' }],
      outcome: 'plan_rejected',
      error: 'bad id',
    });

    log = appendBatchRecord(log, 'source', {
      steps: [{ id: 1, action: 'click', element_id: 'E02' }],
      outcome: 'pending',
    });

    assert.equal(nextBatchNumber(log, 'source'), 3);
    assert.equal(log.follow_up.length, 0);
  });

  it('finalizes the last pending batch', () => {
    let log = appendBatchRecord(EMPTY_BATCH_LOG, 'source', {
      steps: [{ id: 1, action: 'click', element_id: 'E04' }],
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
      steps: [{ id: 1, action: 'click', element_id: 'E01' }],
      outcome: 'probe_failed',
      screenshotBeforeSnapshotId: 'snap-a',
    });

    log = appendBatchRecord(log, 'source', {
      steps: [{ id: 1, action: 'click', element_id: 'E02' }],
      outcome: 'probe_failed',
      screenshotBeforeSnapshotId: 'snap-b',
    });

    assert.equal(findLatestProbeFailureScreenshotId(log, 'source'), 'snap-b');
  });

  it('formats history, validated batches, and errors for the prompt', () => {
    let log = appendBatchRecord(EMPTY_BATCH_LOG, 'source', {
      steps: [{ id: 1, action: 'click', element_id: 'E04' }],
      outcome: 'committed',
    });

    log = appendBatchRecord(log, 'source', {
      steps: [{ id: 2, action: 'fill', element_id: 'E46', value: 'London' }],
      outcome: 'plan_rejected',
      error: 'fill not allowed on E46',
    });

    const formatted = formatBatchLogForPrompt(log, 'source');

    assert.match(formatted.historySection, /Batch 1 \(committed\)/);
    assert.match(formatted.validatedSection, /Validated batches/);
    assert.match(formatted.errorsSection, /Plan rejected/);
    assert.match(formatted.errorsSection, /fill not allowed on E46/);
  });
});
