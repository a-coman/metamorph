import type { ExploreOpenRouterClient } from '../openrouter/explore-openrouter.client.js';
import type { PlanExplorePort } from '../../application/ports/plan-explore.port.js';
import { JevPlanExploreAdapter } from './jev-plan-explore.adapter.js';
import { LlmPlanExploreAdapter } from '../openrouter/llm-plan-explore.adapter.js';

export type PlanExploreBackend = 'llm' | 'jev';

export function resolvePlanExploreBackend(): PlanExploreBackend {
  const raw = (process.env.PLAN_EXPLORE_BACKEND ?? 'llm').trim().toLowerCase();
  return raw === 'jev' ? 'jev' : 'llm';
}

export function createPlanExplorePort(
  openRouter: ExploreOpenRouterClient,
): PlanExplorePort {
  if (resolvePlanExploreBackend() === 'jev') {
    return new JevPlanExploreAdapter(openRouter);
  }

  return new LlmPlanExploreAdapter(openRouter);
}
