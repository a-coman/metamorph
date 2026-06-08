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
  phase: string;
  sequence: number;
  snapshotId: string;
  stepsJson: unknown;
  verdict: string;
  rationale: string | null;
  tracePath: string | null;
  createdAt: Date;
};

export type ExplorationTimelineDto = {
  mrVersionId: string;
  status: string;
  validatedSteps: {
    source: unknown[];
    follow_up: unknown[];
  };
  checkpoints: ExplorationCheckpointDto[];
};

export type MrVersionPlaybookDto = {
  id: string;
  content: string;
  contentHash: string;
  templateVersion: string;
};

export type SessionMrVersionSummaryDto = {
  id: string;
  status: string;
  transformFamily: string;
};
