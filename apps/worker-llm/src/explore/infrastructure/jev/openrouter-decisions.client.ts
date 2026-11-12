import { DEFAULT_DECISIONS_URL, DEFAULT_JEV_MODEL } from './jev-plan-explore.constants.js';

export type JevChoiceQuestion = {
  type: 'choice';
  instructions: string;
  criteria: Record<string, string | null>;
};

export type JevNoulQuestion = {
  type: 'noul';
  instructions: string;
  criteria?: { true: string; false: string };
};

export type JevQuestion = JevChoiceQuestion | JevNoulQuestion;

export type JevChoiceAnswer = {
  type?: 'choice';
  choice: string;
  confidence?: number;
  probabilities?: Record<string, number>;
};

export type JevNoulAnswer = {
  type?: 'noul';
  noul: number;
};

export type JevAnswer = JevChoiceAnswer | JevNoulAnswer;

export type DecisionsUsage = {
  input_tokens?: number;
  output_tokens?: number;
  prompt_tokens?: number;
  completion_tokens?: number;
};

export type DecisionsResponse = {
  model?: string;
  answers: Record<string, JevAnswer>;
  usage?: DecisionsUsage;
};

export class OpenRouterDecisionsError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly body?: string,
  ) {
    super(message);
    this.name = 'OpenRouterDecisionsError';
  }
}

export class OpenRouterDecisionsClient {
  private readonly apiKey: string;
  private readonly decisionsUrl: string;
  private readonly model: string;

  constructor() {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new Error('OPENROUTER_API_KEY is required');
    }

    this.apiKey = apiKey;
    this.decisionsUrl = (
      process.env.OPENROUTER_DECISIONS_URL ?? DEFAULT_DECISIONS_URL
    ).replace(/\/$/, '');
    this.model = (process.env.JEV_MODEL ?? DEFAULT_JEV_MODEL).trim() || DEFAULT_JEV_MODEL;
  }

  getModel(): string {
    return this.model;
  }

  async decide(input: {
    state: unknown;
    questions: Record<string, JevQuestion>;
  }): Promise<DecisionsResponse> {
    const timeoutMs = openRouterTimeoutMs();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    let response: Response;
    try {
      response = await fetch(this.decisionsUrl, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          state: input.state,
          questions: input.questions,
        }),
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new OpenRouterDecisionsError(
          `OpenRouter decisions request timed out after ${timeoutMs}ms (model=${this.model})`,
        );
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }

    const body = await response.text();
    if (!response.ok) {
      throw new OpenRouterDecisionsError(
        `OpenRouter decisions request failed (${response.status}): ${body}`,
        response.status,
        body,
      );
    }

    let payload: unknown;
    try {
      payload = JSON.parse(body) as unknown;
    } catch {
      throw new OpenRouterDecisionsError(
        'OpenRouter decisions returned non-JSON content',
        response.status,
        body,
      );
    }

    return normalizeDecisionsResponse(payload, body);
  }
}

export function readUsageTokens(usage: DecisionsUsage | undefined): {
  tokensIn: number | null;
  tokensOut: number | null;
} {
  if (!usage) {
    return { tokensIn: null, tokensOut: null };
  }

  const tokensIn = usage.input_tokens ?? usage.prompt_tokens;
  const tokensOut = usage.output_tokens ?? usage.completion_tokens;
  return {
    tokensIn: typeof tokensIn === 'number' ? tokensIn : null,
    tokensOut: typeof tokensOut === 'number' ? tokensOut : null,
  };
}

export function asChoiceAnswer(
  answers: Record<string, JevAnswer>,
  key: string,
): JevChoiceAnswer | undefined {
  const answer = answers[key];
  if (!answer || typeof answer !== 'object') {
    return undefined;
  }
  if (!('choice' in answer) || typeof answer.choice !== 'string') {
    return undefined;
  }
  return answer;
}

export function asNoulAnswer(
  answers: Record<string, JevAnswer>,
  key: string,
): JevNoulAnswer | undefined {
  const answer = answers[key];
  if (!answer || typeof answer !== 'object') {
    return undefined;
  }
  if (!('noul' in answer) || typeof answer.noul !== 'number') {
    return undefined;
  }
  return answer;
}

function openRouterTimeoutMs(): number {
  const configured = Number(process.env.OPENROUTER_TIMEOUT_MS ?? 120_000);
  return Number.isFinite(configured) && configured > 0 ? configured : 120_000;
}

function normalizeDecisionsResponse(payload: unknown, body: string): DecisionsResponse {
  if (!payload || typeof payload !== 'object') {
    throw new OpenRouterDecisionsError(
      'OpenRouter decisions returned an empty payload',
      undefined,
      body,
    );
  }

  const record = payload as Record<string, unknown>;
  const answersRaw = record.answers;
  if (!answersRaw || typeof answersRaw !== 'object' || Array.isArray(answersRaw)) {
    throw new OpenRouterDecisionsError(
      'OpenRouter decisions response is missing answers',
      undefined,
      body,
    );
  }

  return {
    model: typeof record.model === 'string' ? record.model : undefined,
    answers: answersRaw as Record<string, JevAnswer>,
    usage:
      record.usage && typeof record.usage === 'object'
        ? (record.usage as DecisionsUsage)
        : undefined,
  };
}
