export type MrVersionDetailsDto = {
  id: string;
  status: string;
  generationSlots: unknown;
  validatedSteps?: {
    source: unknown[];
    follow_up: unknown[];
  };
  mrDefinition: unknown;
  pageSnapshotId: string | null;
  locatorValidationScore: number | null;
  createdAt: Date;
  updatedAt: Date;
};

export type ExplorationCheckpointDto = {
  id: string;
  mrVersionId?: string | null;
  phase: string;
  sequence: number;
  snapshotId: string;
  stepsJson: unknown;
  verdict: string;
  rationale: string | null;
  llmCallId: string | null;
  tracePath: string | null;
  traceArtifactId: string | null;
  createdAt: Date;
};

export type ExplorationPhaseGoalsDto = {
  source: string;
  follow_up: string;
};

export type ExplorationCheckpointStatsDto = {
  source: { ok: number; fail: number; goal_reached: number };
  follow_up: { ok: number; fail: number; goal_reached: number };
};

export type ExplorationTimelineDto = {
  mrVersionId: string;
  status: string;
  validatedSteps: {
    source: unknown[];
    follow_up: unknown[];
  };
  checkpoints: ExplorationCheckpointDto[];
  failureReason?: string;
  phaseGoals?: ExplorationPhaseGoalsDto;
  checkpointStats?: ExplorationCheckpointStatsDto;
};

export type MrVersionPlaybookDto = {
  id: string;
  content: string;
  contentHash: string;
  templateVersion: string;
};

export type ApproveMrVersionRequest = {
  playbookContent?: string;
};

export type RejectMrVersionResultDto = {
  id: string;
  status: string;
};
