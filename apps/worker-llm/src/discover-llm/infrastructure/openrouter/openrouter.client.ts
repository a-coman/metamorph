import {
  LLM_DISCOVER_PROMPT_VERSION,
  LlmDiscoverOutputSchema,
  type PageSnapshotInventory,
} from '@metamorph/core';
import {
  OpenRouterPort,
  type OpenRouterDiscoverInput,
  type OpenRouterDiscoverResult,
} from '../../application/ports/openrouter.port.js';
import { buildDiscoverLlmSystemPrompt, buildInventorySummary } from './discover-llm.prompt.js';

type ChatCompletionResponse = {
  choices?: Array<{ message?: { content?: string | null } }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
  };
};

export class OpenRouterClient extends OpenRouterPort {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly model: string;

  constructor() {
    super();

    const apiKey = process.env.OPENROUTER_API_KEY;
    const baseUrl = process.env.OPENROUTER_BASE_URL ?? 'https://openrouter.ai/api/v1';
    const model = process.env.OPENROUTER_MODEL ?? 'openai/gpt-4o';

    if (!apiKey) {
      throw new Error('OPENROUTER_API_KEY is required');
    }

    this.apiKey = apiKey;
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.model = model;
  }

  async proposeDiscoverMr(
    input: OpenRouterDiscoverInput,
  ): Promise<OpenRouterDiscoverResult> {
    const startedAt = Date.now();
    const inventorySummary = buildInventorySummary(input.inventory);

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: buildDiscoverLlmSystemPrompt(),
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: [
                  `Target URL: ${input.url}`,
                  '',
                  'Interactive inventory (element_id = shortId):',
                  inventorySummary,
                  '',
                  'Propose an idempotence-of-filter metamorphic relation using only element_ids from the inventory above.',
                ].join('\n'),
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/png;base64,${input.screenshotBase64}`,
                },
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`OpenRouter request failed (${response.status}): ${body}`);
    }

    const payload = (await response.json()) as ChatCompletionResponse;
    const content = payload.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('OpenRouter returned empty content');
    }

    let parsed: unknown;
    try {
      parsed = parseLlmJsonContent(content);
    } catch (error) {
      const preview = content.trim().slice(0, 300);
      const message =
        error instanceof Error ? error.message : 'OpenRouter returned non-JSON content';
      throw new Error(`${message} — preview: ${preview}`);
    }

    const validated = LlmDiscoverOutputSchema.safeParse(parsed);
    if (!validated.success) {
      throw new Error(
        `LLM output failed validation: ${validated.error.message}`,
      );
    }

    return {
      output: validated.data,
      model: this.model,
      tokensIn: payload.usage?.prompt_tokens ?? null,
      tokensOut: payload.usage?.completion_tokens ?? null,
      latencyMs: Date.now() - startedAt,
    };
  }
}

export function summarizeInventoryForPrompt(inventory: PageSnapshotInventory): string {
  return buildInventorySummary(inventory);
}

function parseLlmJsonContent(content: string): unknown {
  const trimmed = content.trim();

  try {
    return JSON.parse(trimmed);
  } catch {
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced?.[1]) {
      return JSON.parse(fenced[1].trim());
    }

    const objectStart = trimmed.indexOf('{');
    const objectEnd = trimmed.lastIndexOf('}');
    if (objectStart >= 0 && objectEnd > objectStart) {
      return JSON.parse(trimmed.slice(objectStart, objectEnd + 1));
    }

    throw new Error('OpenRouter returned non-JSON content');
  }
}

export { LLM_DISCOVER_PROMPT_VERSION };
