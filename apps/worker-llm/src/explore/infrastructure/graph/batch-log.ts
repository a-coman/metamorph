import type { SlotStep } from '@metamorph/core';
import type { ExplorePhase } from './explore-state.js';

export type ExploreBatchOutcome =
  | 'pending'
  | 'committed'
  | 'checkpoint_failed'
  | 'probe_failed'
  | 'plan_rejected';

export type ExploreBatchRecord = {
  batch: number;
  steps: SlotStep[];
  outcome: ExploreBatchOutcome;
  rationale?: string;
  error?: string;
  failedStep?: SlotStep;
  screenshotBeforeSnapshotId?: string;
};

export type ExploreBatchLog = {
  source: ExploreBatchRecord[];
  follow_up: ExploreBatchRecord[];
};

export const MAX_BATCH_LOG_ENTRIES = 10;

export const EMPTY_BATCH_LOG: ExploreBatchLog = {
  source: [],
  follow_up: [],
};

export function nextBatchNumber(log: ExploreBatchLog, phase: ExplorePhase): number {
  const phaseLog = log[phase];
  if (phaseLog.length === 0) {
    return 1;
  }

  return phaseLog[phaseLog.length - 1]!.batch + 1;
}

export function appendBatchRecord(
  log: ExploreBatchLog,
  phase: ExplorePhase,
  record: Omit<ExploreBatchRecord, 'batch'> & { batch?: number },
): ExploreBatchLog {
  const entry: ExploreBatchRecord = {
    ...record,
    batch: record.batch ?? nextBatchNumber(log, phase),
  };

  return {
    ...log,
    [phase]: [...log[phase], entry].slice(-MAX_BATCH_LOG_ENTRIES),
  };
}

export function finalizeLastPendingBatch(
  log: ExploreBatchLog,
  phase: ExplorePhase,
  outcome: Exclude<ExploreBatchOutcome, 'pending' | 'plan_rejected'>,
  details?: Pick<ExploreBatchRecord, 'error' | 'failedStep' | 'screenshotBeforeSnapshotId'>,
): ExploreBatchLog {
  const phaseLog = [...log[phase]];
  if (phaseLog.length === 0) {
    return log;
  }

  const lastIndex = phaseLog.length - 1;
  const last = phaseLog[lastIndex]!;
  if (last.outcome !== 'pending') {
    return log;
  }

  phaseLog[lastIndex] = {
    ...last,
    outcome,
    ...details,
  };

  return { ...log, [phase]: phaseLog };
}

export function collectCommittedExploredSteps(
  log: ExploreBatchLog,
  phase: ExplorePhase,
): string[] {
  return log[phase]
    .filter((record) => record.outcome === 'committed' && record.rationale?.trim())
    .map((record) => record.rationale!.trim());
}

export function findLatestProbeFailureScreenshotId(
  log: ExploreBatchLog,
  phase: ExplorePhase,
): string | undefined {
  for (let index = log[phase].length - 1; index >= 0; index -= 1) {
    const record = log[phase][index]!;
    if (record.outcome === 'probe_failed' && record.screenshotBeforeSnapshotId) {
      return record.screenshotBeforeSnapshotId;
    }
  }

  return undefined;
}

export function formatStepLine(step: SlotStep): string {
  const parts: string[] = [step.action];

  if (step.element_id) {
    parts.push(`element_id=${step.element_id}`);
  }
  if (step.value !== undefined) {
    parts.push(`value=${JSON.stringify(step.value)}`);
  }
  if (step.url) {
    parts.push(`url=${JSON.stringify(step.url)}`);
  }
  if (step.key) {
    parts.push(`key=${JSON.stringify(step.key)}`);
  }
  if (step.scroll_y !== undefined) {
    parts.push(`scroll_y=${step.scroll_y}`);
  }
  if (step.timeout_ms !== undefined) {
    parts.push(`timeout_ms=${step.timeout_ms}`);
  }

  return parts.join(' ');
}

const OUTCOME_LABELS: Record<ExploreBatchOutcome, string> = {
  pending: 'pending',
  committed: 'committed',
  checkpoint_failed: 'checkpoint_failed',
  probe_failed: 'probe_failed',
  plan_rejected: 'plan_rejected',
};

export function formatBatchLogForPrompt(
  batchLog: ExploreBatchLog,
  phase: ExplorePhase,
): {
  historySection: string;
  validatedSection: string;
  errorsSection: string;
  latestProbeFailureBatch?: number;
} {
  const records = batchLog[phase].slice(-MAX_BATCH_LOG_ENTRIES);

  const historyLines = ['Exploration history (all batches in this phase):'];
  if (records.length === 0) {
    historyLines.push('(none yet)');
  } else {
    for (const record of records) {
      historyLines.push(`Batch ${record.batch} (${OUTCOME_LABELS[record.outcome]}):`);
      if (record.steps.length === 0) {
        historyLines.push('- (no steps)');
      } else {
        for (const step of record.steps) {
          historyLines.push(`- ${formatStepLine(step)}`);
        }
      }
    }
  }

  const committed = records.filter((record) => record.outcome === 'committed');
  const validatedLines = ['Validated batches (committed only):'];
  if (committed.length === 0) {
    validatedLines.push('(none yet)');
  } else {
    for (const record of committed) {
      validatedLines.push(`Batch ${record.batch}:`);
      for (const step of record.steps) {
        validatedLines.push(`- ${formatStepLine(step)}`);
      }
    }
  }

  const failed = records.filter(
    (record) =>
      record.outcome === 'checkpoint_failed' ||
      record.outcome === 'probe_failed' ||
      record.outcome === 'plan_rejected',
  );

  let latestProbeFailureBatch: number | undefined;
  const errorLines = ['Errors (do not repeat these failed approaches):'];
  if (failed.length === 0) {
    errorLines.push('(none yet)');
  } else {
    for (const record of failed) {
      const label =
        record.outcome === 'checkpoint_failed'
          ? 'Checkpoint failed'
          : record.outcome === 'probe_failed'
            ? 'Probe failed'
            : 'Plan rejected';

      errorLines.push(`Batch ${record.batch} — ${label}:`);
      if (record.error) {
        errorLines.push(`- ${record.error}`);
      }
      if (record.failedStep) {
        errorLines.push(`- failed step: ${formatStepLine(record.failedStep)}`);
      }
      if (record.outcome === 'probe_failed') {
        latestProbeFailureBatch = record.batch;
      }
    }
  }

  return {
    historySection: historyLines.join('\n'),
    validatedSection: validatedLines.join('\n'),
    errorsSection: errorLines.join('\n'),
    latestProbeFailureBatch,
  };
}
