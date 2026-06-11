import {
  EXPLORE_VERIFY_PROMPT_VERSION,
  ExplorePlanOutputSchema,
  ExploreVerifyOutputSchema,
  MR_PLAN_PROMPT_VERSION,
  MrPlanOutputSchema,
  PLAN_EXPLORE_PROMPT_VERSION,
  type MrIntent,
  type PageSnapshotInventory,
} from '@metamorph/core';
import { MR_PLAN_OPTIONS } from '../../prompts/mr-vertical.config.js';
import {
  buildExploreVerifySystemPrompt,
  buildExploreVerifyUserText,
} from '../../prompts/explore-verify.prompt.js';
import {
  buildMrPlanSystemPrompt,
  buildMrPlanUserText,
} from '../../prompts/mr-plan.prompt.js';
import {
  buildPlanExploreSystemPrompt,
  buildPlanExploreUserText,
} from '../../prompts/plan-explore.prompt.js';
import type { ExplorePhase, ExploreSourceReference } from '../graph/explore-state.js';
import { logExploreLlmExchange } from './explore-llm-logger.js';
import {
  buildOpenRouterResponseFormat,
  isStructuredOutputUnsupported,
  openRouterPlugins,
  type OpenRouterResponseFormat,
} from './openrouter-response-format.js';

type ChatCompletionResponse = {
  choices?: Array<{ message?: { content?: string | null } }>;
  error?: { message?: string };
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
  };
};

export type ExploreLlmAudit = {
  purpose: string;
  model: string;
  promptVersion: string;
  tokensIn: number | null;
  tokensOut: number | null;
  latencyMs: number;
};

export type ExploreLlmResult<T> = {
  output: T;
  audit: ExploreLlmAudit;
};

export class ExploreOpenRouterClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly model: string;

  constructor() {
    const apiKey = process.env.OPENROUTER_API_KEY;
    const baseUrl = process.env.OPENROUTER_BASE_URL ?? 'https://openrouter.ai/api/v1';
    const model = (process.env.OPENROUTER_MODEL ?? 'openai/gpt-4o').trim();

    if (!apiKey) {
      throw new Error('OPENROUTER_API_KEY is required');
    }

    this.apiKey = apiKey;
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.model = model;
  }

  async mrPlan(input: {
    url: string;
    screenshotBase64: string;
  }): Promise<ExploreLlmResult<MrIntent>> {
    return this.call({
      purpose: 'mr_plan',
      promptVersion: MR_PLAN_PROMPT_VERSION,
      system: buildMrPlanSystemPrompt(),
      userText: buildMrPlanUserText(input),
      screenshotsBase64: [input.screenshotBase64],
      schema: MrPlanOutputSchema,
      schemaName: 'mr_plan',
      normalize: normalizeMrPlanOutput,
    });
  }

  async planNext(input: {
    url: string;
    phase: ExplorePhase;
    mrIntent: MrIntent;
    inventory: PageSnapshotInventory;
    validatedSteps: { source: unknown[]; follow_up: unknown[] };
    sourceReference?: ExploreSourceReference;
    screenshotBase64: string;
    probeError?: string;
  }): Promise<ExploreLlmResult<import('@metamorph/core').ExplorePlanOutput>> {
    const phaseSteps = input.validatedSteps[input.phase as keyof typeof input.validatedSteps];
    const nextStepId =
      (Array.isArray(phaseSteps) ? phaseSteps.length : 0) + 1;

    return this.call({
      purpose: 'plan_explore',
      promptVersion: PLAN_EXPLORE_PROMPT_VERSION,
      system: buildPlanExploreSystemPrompt(),
      userText: buildPlanExploreUserText(input),
      screenshotsBase64: [input.screenshotBase64],
      schema: ExplorePlanOutputSchema,
      schemaName: 'plan_explore',
      normalize: (raw) => normalizePlanOutput(raw, nextStepId),
    });
  }

  async verifyCheckpoint(input: {
    url: string;
    urlAfter: string;
    phase: ExplorePhase;
    mrIntent: MrIntent;
    validatedSteps: { source: unknown[]; follow_up: unknown[] };
    sourceReference?: ExploreSourceReference;
    executedSteps: unknown[];
    screenshotBeforeBase64: string;
    screenshotAfterBase64: string;
    probeError?: string;
  }): Promise<ExploreLlmResult<import('@metamorph/core').ExploreVerifyOutput>> {
    return this.call({
      purpose: 'explore_verify',
      promptVersion: EXPLORE_VERIFY_PROMPT_VERSION,
      system: buildExploreVerifySystemPrompt(input.phase),
      userText: buildExploreVerifyUserText(input),
      screenshotsBase64: [input.screenshotBeforeBase64, input.screenshotAfterBase64],
      schema: ExploreVerifyOutputSchema,
      schemaName: 'explore_verify',
    });
  }

  private async call<T>(input: {
    purpose: string;
    promptVersion: string;
    system: string;
    userText: string;
    screenshotsBase64?: string[];
    schema: { safeParse: (data: unknown) => { success: boolean; data?: T; error?: { message: string } } };
    schemaName: string;
    normalize?: (raw: unknown) => unknown;
  }): Promise<ExploreLlmResult<T>> {
    const startedAt = Date.now();

    const userContent: Array<{ type: string; text?: string; image_url?: { url: string } }> = [
      { type: 'text', text: input.userText },
    ];

    for (const screenshotBase64 of input.screenshotsBase64 ?? []) {
      userContent.push({
        type: 'image_url',
        image_url: { url: `data:image/png;base64,${screenshotBase64}` },
      });
    }

    const messages = [
      { role: 'system', content: input.system },
      { role: 'user', content: userContent },
    ];

    const completion = await this.completeWithFormatFallback(messages, input.schemaName, input.schema);
    const { content, payload } = completion;

    const parsed = parseLlmJsonContent(content);
    const normalized = input.normalize ? input.normalize(parsed) : parsed;
    const validated = input.schema.safeParse(normalized);

    const latencyMs = Date.now() - startedAt;
    const usage = {
      tokensIn: payload.usage?.prompt_tokens ?? null,
      tokensOut: payload.usage?.completion_tokens ?? null,
      latencyMs,
    };

    const screenshotCount = input.screenshotsBase64?.length ?? 0;

    if (!validated.success || !validated.data) {
      logExploreLlmExchange({
        purpose: input.purpose,
        promptVersion: input.promptVersion,
        model: this.model,
        userText: input.userText,
        system: input.system,
        screenshotCount,
        latencyMs: usage.latencyMs,
        tokensIn: usage.tokensIn,
        tokensOut: usage.tokensOut,
        output: normalized,
        validationError: validated.error?.message ?? 'unknown',
      });

      throw new Error(
        `LLM output failed validation: ${validated.error?.message ?? 'unknown'}`,
      );
    }

    logExploreLlmExchange({
      purpose: input.purpose,
      promptVersion: input.promptVersion,
      model: this.model,
      userText: input.userText,
      system: input.system,
      screenshotCount,
      latencyMs: usage.latencyMs,
      tokensIn: usage.tokensIn,
      tokensOut: usage.tokensOut,
      output: validated.data,
    });

    return {
      output: validated.data,
      audit: {
        purpose: input.purpose,
        model: this.model,
        promptVersion: input.promptVersion,
        tokensIn: usage.tokensIn,
        tokensOut: usage.tokensOut,
        latencyMs: usage.latencyMs,
      },
    };
  }

  private async completeWithFormatFallback(
    messages: Array<{ role: string; content: unknown }>,
    schemaName: string,
    zodSchema: unknown,
  ): Promise<{
    content: string;
    payload: ChatCompletionResponse;
    responseFormat: OpenRouterResponseFormat;
  }> {
    let responseFormat = buildOpenRouterResponseFormat(zodSchema, schemaName);
    let response = await this.postCompletion(messages, responseFormat);

    if (!response.ok) {
      const body = await response.text();
      if (
        responseFormat.type === 'json_schema' &&
        isStructuredOutputUnsupported(response.status, body)
      ) {
        responseFormat = { type: 'json_object' };
        response = await this.postCompletion(messages, responseFormat);
        if (!response.ok) {
          const retryBody = await response.text();
          throw new Error(`OpenRouter request failed (${response.status}): ${retryBody}`);
        }
      } else {
        throw new Error(`OpenRouter request failed (${response.status}): ${body}`);
      }
    }

    let payload = (await response.json()) as ChatCompletionResponse;
    let content = payload.choices?.[0]?.message?.content?.trim() ?? '';

    const shouldFallbackToJsonObject =
      responseFormat.type === 'json_schema' &&
      (!content || Boolean(payload.error?.message));

    if (shouldFallbackToJsonObject) {
      responseFormat = { type: 'json_object' };
      response = await this.postCompletion(messages, responseFormat);
      if (!response.ok) {
        const body = await response.text();
        throw new Error(`OpenRouter request failed (${response.status}): ${body}`);
      }
      payload = (await response.json()) as ChatCompletionResponse;
      content = payload.choices?.[0]?.message?.content?.trim() ?? '';
    }

    if (!content) {
      const providerError = payload.error?.message;
      throw new Error(
        providerError
          ? `OpenRouter returned empty content: ${providerError}`
          : 'OpenRouter returned empty content',
      );
    }

    return { content, payload, responseFormat };
  }

  private openRouterTimeoutMs(): number {
    const configured = Number(process.env.OPENROUTER_TIMEOUT_MS ?? 120_000);
    return Number.isFinite(configured) && configured > 0 ? configured : 120_000;
  }

  private async postCompletion(
    messages: Array<{ role: string; content: unknown }>,
    responseFormat: OpenRouterResponseFormat,
  ): Promise<Response> {
    const plugins = openRouterPlugins(responseFormat);
    const temperature = process.env.OPENROUTER_TEMPERATURE
      ? Number(process.env.OPENROUTER_TEMPERATURE)
      : undefined;
    const timeoutMs = this.openRouterTimeoutMs();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      return await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          response_format: responseFormat,
          ...(plugins ? { plugins } : {}),
          ...(temperature !== undefined && !Number.isNaN(temperature)
            ? { temperature }
            : {}),
          messages,
        }),
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(
          `OpenRouter request timed out after ${timeoutMs}ms (model=${this.model})`,
        );
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
}

const DEFAULT_TRANSFORM_FAMILY = MR_PLAN_OPTIONS.transformFamilies[0];
const DEFAULT_RELATION_TYPE = MR_PLAN_OPTIONS.relationTypes[0];
const DEFAULT_OBSERVATION_FIELDS = [...MR_PLAN_OPTIONS.observationFields];

function isAllowedTransformFamily(value: unknown): boolean {
  return (
    typeof value === 'string' &&
    (MR_PLAN_OPTIONS.transformFamilies as readonly string[]).includes(value)
  );
}

function isAllowedRelationType(value: unknown): boolean {
  return (
    typeof value === 'string' &&
    (MR_PLAN_OPTIONS.relationTypes as readonly string[]).includes(value)
  );
}

function normalizeObservationFields(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return DEFAULT_OBSERVATION_FIELDS;
  }

  const allowed = new Set(MR_PLAN_OPTIONS.observationFields as readonly string[]);
  const filtered = value.filter(
    (field): field is string => typeof field === 'string' && allowed.has(field),
  );

  return filtered.length > 0 ? filtered : DEFAULT_OBSERVATION_FIELDS;
}

function normalizeMrPlanOutput(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object') {
    return raw;
  }

  const record = { ...(raw as Record<string, unknown>) };

  if (!record.mr_definition || typeof record.mr_definition !== 'object') {
    return record;
  }

  const mrDefinition = { ...(record.mr_definition as Record<string, unknown>) };

  if (typeof mrDefinition.precondition === 'string') {
    mrDefinition.precondition = { description: mrDefinition.precondition };
  }

  if (!mrDefinition.precondition || typeof mrDefinition.precondition !== 'object') {
    mrDefinition.precondition = {
      description: 'Explored page satisfies the MR precondition.',
    };
  }

  if (typeof mrDefinition.transformation === 'string') {
    mrDefinition.transformation = {
      transform_family: DEFAULT_TRANSFORM_FAMILY,
      description: mrDefinition.transformation,
    };
  }

  if (!mrDefinition.transformation || typeof mrDefinition.transformation !== 'object') {
    mrDefinition.transformation = {
      transform_family: DEFAULT_TRANSFORM_FAMILY,
      description: 'Repeat the validated follow-up action.',
    };
  } else {
    const transformation = {
      ...(mrDefinition.transformation as Record<string, unknown>),
    };

    if (!isAllowedTransformFamily(transformation.transform_family)) {
      transformation.transform_family = DEFAULT_TRANSFORM_FAMILY;
    }

    mrDefinition.transformation = transformation;
  }

  if (typeof mrDefinition.relation === 'string') {
    mrDefinition.relation = {
      type: DEFAULT_RELATION_TYPE,
      on: DEFAULT_OBSERVATION_FIELDS,
      description: mrDefinition.relation,
    };
  }

  if (!mrDefinition.relation || typeof mrDefinition.relation !== 'object') {
    mrDefinition.relation = {
      type: DEFAULT_RELATION_TYPE,
      on: DEFAULT_OBSERVATION_FIELDS,
      description: 'Observations remain equal after repeating the action.',
    };
  } else {
    const relation = { ...(mrDefinition.relation as Record<string, unknown>) };
    relation.on = normalizeObservationFields(relation.on);

    if (!isAllowedRelationType(relation.type)) {
      relation.type = DEFAULT_RELATION_TYPE;
    }

    if (typeof relation.description !== 'string' || relation.description.length === 0) {
      relation.description = 'Observations remain equal after repeating the action.';
    }

    mrDefinition.relation = relation;
  }

  record.mr_definition = mrDefinition;
  return record;
}

function normalizePlanOutput(raw: unknown, startId: number): unknown {
  if (!raw || typeof raw !== 'object') {
    return raw;
  }

  const plan = { ...(raw as Record<string, unknown>) };

  if (typeof plan.rationale !== 'string' && Array.isArray(plan.steps)) {
    for (const step of plan.steps) {
      if (step && typeof step === 'object') {
        const stepRecord = step as Record<string, unknown>;
        if (typeof stepRecord.rationale === 'string') {
          plan.rationale = stepRecord.rationale;
          break;
        }
      }
    }
  }

  if (!Array.isArray(plan.steps)) {
    return plan;
  }

  const interactiveActions = new Set(['click', 'fill', 'selectOption']);

  return {
    ...plan,
    steps: plan.steps
      .map((step, index) => normalizePlanStep(step, startId + index))
      .filter((step) => {
        if (!step || typeof step !== 'object') {
          return false;
        }

        const record = step as Record<string, unknown>;
        const action = record.action;

        if (typeof action !== 'string' || !interactiveActions.has(action)) {
          return true;
        }

        return typeof record.element_id === 'string' && record.element_id.length > 0;
      }),
  };
}

function normalizePlanStep(step: unknown, fallbackId: number): unknown {
  if (!step || typeof step !== 'object') {
    return step;
  }

  const record = { ...(step as Record<string, unknown>) };

  if (typeof record.action !== 'string' && typeof record.type === 'string') {
    record.action = record.type;
  }
  delete record.type;

  if (record.action === 'wait') {
    record.action = 'waitFor';
  }

  if (record.action === 'waitFor' && record.timeout_ms === undefined) {
    if (typeof record.duration_ms === 'number') {
      record.timeout_ms = record.duration_ms;
    } else if (typeof record.ms === 'number') {
      record.timeout_ms = record.ms;
    } else if (typeof record.wait_ms === 'number') {
      record.timeout_ms = record.wait_ms;
    }
  }

  delete record.rationale;
  delete record.duration_ms;
  delete record.ms;
  delete record.wait_ms;

  return {
    ...record,
    id: typeof record.id === 'number' ? record.id : fallbackId,
  };
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
