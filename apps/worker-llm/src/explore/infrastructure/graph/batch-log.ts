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

export function getLastPendingBatchRationale(
  log: ExploreBatchLog,
  phase: ExplorePhase,
): string | undefined {
  const phaseLog = log[phase];
  if (phaseLog.length === 0) {
    return undefined;
  }

  const last = phaseLog[phaseLog.length - 1]!;
  if (last.outcome !== 'pending') {
    return undefined;
  }

  const rationale = last.rationale?.trim();
  return rationale && rationale.length > 0 ? rationale : undefined;
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

const UNCOMMITTED_OUTCOMES = new Set<ExploreBatchOutcome>([
  'checkpoint_failed',
  'probe_failed',
  'plan_rejected',
]);

function formatBatchHeaderLabel(outcome: ExploreBatchOutcome): string {
  if (outcome === 'committed' || outcome === 'pending') {
    return `(${outcome})`;
  }

  return `(uncommitted — ${outcome})`;
}

function formatMultilineBulletContinuation(text: string): string[] {
  const lines = text.split('\n').map((line) => line.trim()).filter((line) => line.length > 0);
  if (lines.length === 0) {
    return [];
  }

  const [firstLine, ...continuationLines] = lines;
  const bulletLines = [`  - ${firstLine}`];
  for (const line of continuationLines) {
    bulletLines.push(`    ${line}`);
  }

  return bulletLines;
}

function formatBatchRationaleLines(record: ExploreBatchRecord): string[] {
  const rationale = record.rationale?.trim();
  if (!rationale) {
    return [];
  }

  return ['  rationale:', ...formatMultilineBulletContinuation(rationale)];
}

function formatBatchStepsLines(record: ExploreBatchRecord): string[] {
  const stepLines = ['  steps:'];

  if (record.steps.length === 0) {
    stepLines.push('  - (no steps)');
  } else {
    for (const step of record.steps) {
      stepLines.push(`  - ${formatStepLine(step)}`);
    }
  }

  return stepLines;
}

function formatBatchErrorsLines(record: ExploreBatchRecord): string[] {
  if (!UNCOMMITTED_OUTCOMES.has(record.outcome)) {
    return [];
  }

  if (!record.error && !record.failedStep) {
    return [];
  }

  const errorLines: string[] = ['  errors:'];

  if (record.failedStep) {
    errorLines.push(`  - failed step: ${formatStepLine(record.failedStep)}`);
    if (record.error) {
      for (const line of record.error.split('\n').map((l) => l.trim()).filter((l) => l.length > 0)) {
        errorLines.push(`    ${line}`);
      }
    }
  } else if (record.error) {
    errorLines.push(...formatMultilineBulletContinuation(record.error));
  }

  return errorLines;
}

export function formatBatchLogForPrompt(
  batchLog: ExploreBatchLog,
  phase: ExplorePhase,
): {
  historySection: string;
  latestProbeFailureBatch?: number;
} {
  const records = batchLog[phase].slice(-MAX_BATCH_LOG_ENTRIES);

  const historyLines = ['Exploration history (all batches in this phase):'];
  let latestProbeFailureBatch: number | undefined;

  if (records.length === 0) {
    historyLines.push('(none yet)');
  } else {
    for (const record of records) {
      historyLines.push(`Batch ${record.batch} ${formatBatchHeaderLabel(record.outcome)}:`);
      historyLines.push(...formatBatchRationaleLines(record));
      historyLines.push(...formatBatchStepsLines(record));
      historyLines.push(...formatBatchErrorsLines(record));

      if (record.outcome === 'probe_failed') {
        latestProbeFailureBatch = record.batch;
      }
    }
  }

  return {
    historySection: historyLines.join('\n'),
    latestProbeFailureBatch,
  };
}
