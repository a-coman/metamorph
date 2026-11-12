import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import {
  OpenRouterDecisionsClient,
  OpenRouterDecisionsError,
  asChoiceAnswer,
  asNoulAnswer,
  readUsageTokens,
} from './openrouter-decisions.client.js';

const originalFetch = globalThis.fetch;
const originalApiKey = process.env.OPENROUTER_API_KEY;
const originalModel = process.env.JEV_MODEL;
const originalUrl = process.env.OPENROUTER_DECISIONS_URL;

afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalApiKey === undefined) delete process.env.OPENROUTER_API_KEY;
  else process.env.OPENROUTER_API_KEY = originalApiKey;
  if (originalModel === undefined) delete process.env.JEV_MODEL;
  else process.env.JEV_MODEL = originalModel;
  if (originalUrl === undefined) delete process.env.OPENROUTER_DECISIONS_URL;
  else process.env.OPENROUTER_DECISIONS_URL = originalUrl;
});

describe('OpenRouterDecisionsClient', () => {
  it('posts state and questions to the decisions URL', async () => {
    process.env.OPENROUTER_API_KEY = 'test-key';
    process.env.JEV_MODEL = 'typesafe/jev-1.13';
    process.env.OPENROUTER_DECISIONS_URL = 'https://openrouter.ai/api/alpha/decisions';

    let posted: { url: string; body: Record<string, unknown> } | undefined;
    globalThis.fetch = async (input, init) => {
      posted = {
        url: String(input),
        body: JSON.parse(String(init?.body)) as Record<string, unknown>,
      };
      return new Response(
        JSON.stringify({
          model: 'typesafe/jev-1.13',
          answers: {
            plan_action: { type: 'choice', choice: 'append_steps', confidence: 0.9 },
            wait_first: { type: 'noul', noul: 0.2 },
          },
          usage: { input_tokens: 11, output_tokens: 0 },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    };

    const client = new OpenRouterDecisionsClient();
    const result = await client.decide({
      state: { url: 'https://example.com' },
      questions: {
        plan_action: {
          type: 'choice',
          instructions: 'What next?',
          criteria: { append_steps: 'Go', abort: 'Stop' },
        },
      },
    });

    assert.equal(posted?.url, 'https://openrouter.ai/api/alpha/decisions');
    assert.equal(posted?.body.model, 'typesafe/jev-1.13');
    assert.equal(result.answers.plan_action && 'choice' in result.answers.plan_action, true);
    assert.equal(asChoiceAnswer(result.answers, 'plan_action')?.choice, 'append_steps');
    assert.equal(asNoulAnswer(result.answers, 'wait_first')?.noul, 0.2);
    assert.deepEqual(readUsageTokens(result.usage), { tokensIn: 11, tokensOut: 0 });
  });

  it('throws on a non-OK decisions response', async () => {
    process.env.OPENROUTER_API_KEY = 'test-key';
    globalThis.fetch = async () =>
      new Response('nope', { status: 401, headers: { 'Content-Type': 'text/plain' } });

    const client = new OpenRouterDecisionsClient();
    await assert.rejects(
      client.decide({ state: 'x', questions: {} }),
      OpenRouterDecisionsError,
    );
  });
});
