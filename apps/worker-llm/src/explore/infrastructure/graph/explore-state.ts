import type {
  GenerationSlots,
  MrIntent,
  ObservableDef,
  SlotStep,
  TransformFamily,
} from '@metamorph/core';
import { OBSERVATION_SPEC_SCHEMA_VERSION } from '@metamorph/core';
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
  planRecoveryAttempts: number;
  maxPlanRecoveryAttempts: number;
  verifyRecoveryAttempts: number;
  maxVerifyRecoveryAttempts: number;
  checkpointRecoveryAttempts: number;
  mrDefinition?: MrIntent['mr_definition'];
  explorationGoals?: MrIntent['exploration'];
  observationIntents?: string[];
  observationSpec?: ObservableDef[];
  probeError?: string;
  probeStatus?: 'ok' | 'failed';
  lastVerdict?: 'ok' | 'fail' | 'goal_reached';
  smokeGatePassed?: boolean;
  awaitingSmokeReplay?: boolean;
  smokeRecoveryAttempts: number;
  maxSmokeRecoveryAttempts: number;
  observeSpecRecoveryAttempts: number;
  maxObserveSpecRecoveryAttempts: number;
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
  observeSpecRecoveryAttempts: 0,
  maxObserveSpecRecoveryAttempts: 2,
};

export function buildGenerationSlots(state: ExploreGraphState): GenerationSlots {
  return {
    source: { steps: state.validatedSteps.source },
    follow_up: { steps: state.validatedSteps.follow_up },
    observation: {
      schemaVersion: OBSERVATION_SPEC_SCHEMA_VERSION,
      observables: state.observationSpec ?? [],
    },
  };
}
