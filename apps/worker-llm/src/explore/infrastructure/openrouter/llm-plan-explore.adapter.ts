import { PLAN_EXPLORE_PROMPT_VERSION, type ExplorePlanOutput } from '@metamorph/core';
import type { PlanExploreInput, PlanExplorePort } from '../../application/ports/plan-explore.port.js';
import type { ExploreLlmResult } from './explore-openrouter.client.js';
import { ExploreOpenRouterClient } from './explore-openrouter.client.js';

export class LlmPlanExploreAdapter implements PlanExplorePort {
  readonly needsVision = true;

  constructor(private readonly openRouter: ExploreOpenRouterClient) {}

  getModel(): string {
    return this.openRouter.getModel();
  }

  getPromptVersion(): string {
    return PLAN_EXPLORE_PROMPT_VERSION;
  }

  planNext(input: PlanExploreInput): Promise<ExploreLlmResult<ExplorePlanOutput>> {
    if (!input.screenshotBase64) {
      throw new Error('LLM plan_explore requires an annotated screenshot');
    }

    return this.openRouter.planNext({
      url: input.url,
      phase: input.phase,
      mrIntent: input.mrIntent,
      inventory: input.inventory,
      validatedSteps: input.validatedSteps,
      batchLog: input.batchLog,
      sourceReference: input.sourceReference,
      screenshotBase64: input.screenshotBase64,
      failureScreenshotBase64: input.failureScreenshotBase64,
      latestProbeFailureBatch: input.latestProbeFailureBatch,
    });
  }
}
