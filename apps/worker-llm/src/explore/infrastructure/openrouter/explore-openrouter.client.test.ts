import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { ExploreOpenRouterClient } from './explore-openrouter.client.js';

const originalFetch = globalThis.fetch;
const originalApiKey = process.env.OPENROUTER_API_KEY;
const originalMaxRetries = process.env.OPENROUTER_EMPTY_CONTENT_MAX_RETRIES;
const originalRetryDelay = process.env.OPENROUTER_EMPTY_CONTENT_RETRY_DELAY_MS;

function jsonResponse(payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function validMrPlanContent(): string {
  return JSON.stringify({
    mr_definition: {
      precondition: { description: 'A results page is visible' },
      transformation: {
        transform_family: 'subset',
        description: 'Apply one additional filter',
      },
      relation: {
        on: ['result_count'],
        description: 'The filtered result count does not increase',
      },
    },
    exploration: {
      source_phase_goal: 'Reach an unfiltered results page',
      follow_up_phase_goal: 'Reach the same results page and apply one filter',
    },
  });
}

afterEach(() => {
  globalThis.fetch = originalFetch;

  if (originalApiKey === undefined) delete process.env.OPENROUTER_API_KEY;
  else process.env.OPENROUTER_API_KEY = originalApiKey;

  if (originalMaxRetries === undefined) {
    delete process.env.OPENROUTER_EMPTY_CONTENT_MAX_RETRIES;
  } else {
    process.env.OPENROUTER_EMPTY_CONTENT_MAX_RETRIES = originalMaxRetries;
  }

  if (originalRetryDelay === undefined) {
    delete process.env.OPENROUTER_EMPTY_CONTENT_RETRY_DELAY_MS;
  } else {
    process.env.OPENROUTER_EMPTY_CONTENT_RETRY_DELAY_MS = originalRetryDelay;
  }
});

describe('ExploreOpenRouterClient empty-content retries', () => {
  it('retries an empty response and returns the next valid completion', async () => {
    process.env.OPENROUTER_API_KEY = 'test-key';
    process.env.OPENROUTER_EMPTY_CONTENT_MAX_RETRIES = '2';
    process.env.OPENROUTER_EMPTY_CONTENT_RETRY_DELAY_MS = '0';

    let fetchCalls = 0;
    globalThis.fetch = async () => {
      fetchCalls += 1;
      return fetchCalls === 1
        ? jsonResponse({ choices: [{ message: { content: '' } }] })
        : jsonResponse({
            choices: [{ message: { content: validMrPlanContent() } }],
            usage: { prompt_tokens: 10, completion_tokens: 20 },
          });
    };

    const client = new ExploreOpenRouterClient();
    const result = await client.mrPlan({
      url: 'https://example.com',
      screenshotBase64: '',
      transformFamily: 'subset',
    });

    assert.equal(fetchCalls, 2);
    assert.equal(result.output.mr_definition.transformation.transform_family, 'subset');
  });

  it('fails only after exhausting the configured empty-content retries', async () => {
    process.env.OPENROUTER_API_KEY = 'test-key';
    process.env.OPENROUTER_EMPTY_CONTENT_MAX_RETRIES = '2';
    process.env.OPENROUTER_EMPTY_CONTENT_RETRY_DELAY_MS = '0';

    let fetchCalls = 0;
    globalThis.fetch = async () => {
      fetchCalls += 1;
      return jsonResponse({ choices: [{ message: { content: null } }] });
    };

    const client = new ExploreOpenRouterClient();
    await assert.rejects(
      client.mrPlan({
        url: 'https://example.com',
        screenshotBase64: '',
        transformFamily: 'subset',
      }),
      /OpenRouter returned empty content/,
    );

    assert.equal(fetchCalls, 3);
  });
});
