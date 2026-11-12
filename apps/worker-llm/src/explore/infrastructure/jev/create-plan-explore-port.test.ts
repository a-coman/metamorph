import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { createPlanExplorePort, resolvePlanExploreBackend } from './create-plan-explore-port.js';
import { JevPlanExploreAdapter } from './jev-plan-explore.adapter.js';
import { LlmPlanExploreAdapter } from '../openrouter/llm-plan-explore.adapter.js';
import { ExploreOpenRouterClient } from '../openrouter/explore-openrouter.client.js';

const originalBackend = process.env.PLAN_EXPLORE_BACKEND;
const originalApiKey = process.env.OPENROUTER_API_KEY;

afterEach(() => {
  if (originalBackend === undefined) delete process.env.PLAN_EXPLORE_BACKEND;
  else process.env.PLAN_EXPLORE_BACKEND = originalBackend;
  if (originalApiKey === undefined) delete process.env.OPENROUTER_API_KEY;
  else process.env.OPENROUTER_API_KEY = originalApiKey;
});

describe('resolvePlanExploreBackend', () => {
  it('defaults to llm', () => {
    delete process.env.PLAN_EXPLORE_BACKEND;
    assert.equal(resolvePlanExploreBackend(), 'llm');
  });

  it('opts into jev', () => {
    process.env.PLAN_EXPLORE_BACKEND = 'jev';
    assert.equal(resolvePlanExploreBackend(), 'jev');
  });
});

describe('createPlanExplorePort', () => {
  it('returns the LLM adapter by default', () => {
    process.env.OPENROUTER_API_KEY = 'test-key';
    delete process.env.PLAN_EXPLORE_BACKEND;
    const port = createPlanExplorePort(new ExploreOpenRouterClient());
    assert.equal(port instanceof LlmPlanExploreAdapter, true);
    assert.equal(port.needsVision, true);
  });

  it('returns the Jev adapter when PLAN_EXPLORE_BACKEND=jev', () => {
    process.env.OPENROUTER_API_KEY = 'test-key';
    process.env.PLAN_EXPLORE_BACKEND = 'jev';
    const port = createPlanExplorePort(new ExploreOpenRouterClient());
    assert.equal(port instanceof JevPlanExploreAdapter, true);
    assert.equal(port.needsVision, false);
  });
});
