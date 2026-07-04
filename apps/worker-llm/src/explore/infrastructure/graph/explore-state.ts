import type {
  GenerationSlots,
  MrIntent,
  ObservationAnchors,
  SlotStep,
  TransformFamily,
} from '@metamorph/core';
import { parseObservationCatalogFields } from '@metamorph/core';
import type { ExploreBatchLog } from './batch-log.js';
import { EMPTY_BATCH_LOG } from './batch-log.js';

export type { ExploreBatchLog, ExploreBatchRecord, ExploreBatchOutcome } from './batch-log.js';

export type ExplorePhase = 'source' | 'follow_up';

export type ExploreSourceReference = {
  exploredSteps: string[];
  endUrl?: string;
};

export type ProbeFailureContext = {
  failedStep: SlotStep;
  failedStepIndex: number;
  failedBatchIndex?: number;
  failedBatchSize?: number;
  urlBeforeFailure: string;
  screenshotBeforeSnapshotId: string;
};

export type ExploreGraphState = {
  sessionId: string;
  sessionUrl: string;
  mrVersionId: string;
  exploreJobId: string;
  transformFamily: TransformFamily;
  phase: ExplorePhase;
  initialSnapshotId: string;
  /** Snapshot at the end of the source phase — used as reference in follow_up planning. */
  sourceEndSnapshotId?: string;
  currentSnapshotId: string;
  validatedSteps: { source: SlotStep[]; follow_up: SlotStep[] };
  batchLog: ExploreBatchLog;
  pendingProbeSteps: SlotStep[];
  pendingProbeJobId?: string;
  lastPlanLlmCallId?: string;
  iteration: number;
  maxIterations: number;
  recoveryAttempts: number;
  maxRecoveryAttempts: number;
  /** LLM plan failures within the current iteration (capped separately from checkpoint recovery). */
  planRecoveryAttempts: number;
  maxPlanRecoveryAttempts: number;
  /** LLM verify infra failures within the current probe batch (capped separately from checkpoint recovery). */
  verifyRecoveryAttempts: number;
  maxVerifyRecoveryAttempts: number;
  checkpointRecoveryAttempts: number;
  mrDefinition?: MrIntent['mr_definition'];
  explorationGoals?: MrIntent['exploration'];
  observationAnchors?: ObservationAnchors;
  probeError?: string;
  probeStatus?: 'ok' | 'failed';
  lastVerdict?: 'ok' | 'fail' | 'goal_reached';
  /** Full-path smoke replay passed for the current phase (after goal_reached). */
  smokeGatePassed?: boolean;
  awaitingSmokeReplay?: boolean;
  smokeRecoveryAttempts: number;
  maxSmokeRecoveryAttempts: number;
  anchorRecoveryAttempts: number;
  maxAnchorRecoveryAttempts: number;
  /** When true, replay validated prefix and capture fresh inventory before plan_next. */
  needsPrefixInventorySync?: boolean;
  pendingPrefixSyncJobId?: string;
  failed?: boolean;
  failureReason?: string;
};

export type ProbeResumeValue = {
  probe_job_id: string;
  snapshot_id: string | null;
  probe_status: 'ok' | 'failed';
  error?: string;
  failureContext?: ProbeFailureContext;
};

export const DEFAULT_EXPLORE_STATE: Omit<
  ExploreGraphState,
  | 'sessionId'
  | 'sessionUrl'
  | 'mrVersionId'
  | 'exploreJobId'
  | 'transformFamily'
  | 'initialSnapshotId'
  | 'currentSnapshotId'
> = {
  phase: 'source',
  validatedSteps: { source: [], follow_up: [] },
  batchLog: EMPTY_BATCH_LOG,
  pendingProbeSteps: [],
  iteration: 0,
  maxIterations: 30,
  recoveryAttempts: 0,
  maxRecoveryAttempts: 8,
  planRecoveryAttempts: 0,
  maxPlanRecoveryAttempts: 3,
  verifyRecoveryAttempts: 0,
  maxVerifyRecoveryAttempts: 3,
  checkpointRecoveryAttempts: 0,
  smokeGatePassed: false,
  awaitingSmokeReplay: false,
  smokeRecoveryAttempts: 0,
  maxSmokeRecoveryAttempts: 2,
  anchorRecoveryAttempts: 0,
  maxAnchorRecoveryAttempts: 2,
};

export function buildGenerationSlots(state: ExploreGraphState): GenerationSlots {
  const observationFields = state.mrDefinition
    ? parseObservationCatalogFields(state.mrDefinition.relation.on)
    : [];

  return {
    source: { steps: state.validatedSteps.source },
    follow_up: { steps: state.validatedSteps.follow_up },
    observation: {
      fields: observationFields,
      ...(state.observationAnchors ? { anchors: state.observationAnchors } : {}),
    },
  };
}
