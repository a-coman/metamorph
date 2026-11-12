import type { ExplorePlanOutput, MrIntent, PageSnapshotInventory } from '@metamorph/core';
import type { ExploreLlmResult } from '../../infrastructure/openrouter/explore-openrouter.client.js';
import type {
  ExploreBatchLog,
  ExplorePhase,
  ExploreSourceReference,
} from '../../infrastructure/graph/explore-state.js';

export type PlanExploreInput = {
  url: string;
  phase: ExplorePhase;
  mrIntent: MrIntent;
  inventory: PageSnapshotInventory;
  validatedSteps: { source: unknown[]; follow_up: unknown[] };
  batchLog: ExploreBatchLog;
  sourceReference?: ExploreSourceReference;
  screenshotBase64?: string;
  failureScreenshotBase64?: string;
  latestProbeFailureBatch?: number;
};

export type PlanExplorePort = {
  readonly needsVision: boolean;
  getModel(): string;
  getPromptVersion(): string;
  planNext(input: PlanExploreInput): Promise<ExploreLlmResult<ExplorePlanOutput>>;
};
