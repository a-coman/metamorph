import {
  applyFamilyProfile,
  EXPLORE_VERIFY_PROMPT_VERSION,
  ExplorePlanOutputSchema,
  ExploreVerifyOutputSchema,
  MR_PLAN_PROMPT_VERSION,
  MrDefinitionSchema,
  MrPlanOutputSchema,
  ObserveSpecOutputSchema,
  OBSERVE_SPEC_PROMPT_VERSION,
  PLAN_EXPLORE_PROMPT_VERSION,
  normalizeElementShortId,
  type MrIntent,
  type ObserveSpecOutput,
  type PageSnapshotInventory,
  type SlotStep,
  type TransformFamily,
} from '@metamorph/core';
import {
  buildExploreVerifySystemPrompt,
  buildExploreVerifyUserText,
} from '../../prompts/explore-verify.prompt.js';
import {
  buildMrPlanSystemPrompt,
  buildMrPlanUserText,
} from '../../prompts/mr-plan.prompt.js';
import {
  buildObserveSpecSystemPrompt,
  buildObserveSpecUserText,
} from '../../prompts/observe-spec.prompt.js';
import {
  buildPlanExploreSystemPrompt,
  buildPlanExploreUserText,
} from '../../prompts/plan-explore.prompt.js';
import type { ExplorePhase, ExploreSourceReference, ExploreBatchLog } from '../graph/explore-state.js';
import {
  ExploreLlmCallError,
  ExploreLlmValidationError,
  formatLlmValidationErrorForPrompt,
} from './explore-llm-validation.error.js';
import type { ExploreLlmPromptAudit, ExploreLlmPromptImages } from './explore-llm-validation.error.js';
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

export type { ExploreLlmPromptAudit, ExploreLlmPromptImages } from './explore-llm-validation.error.js';

export type ExploreLlmAudit = {
  purpose: string;
  model: string;
  promptVersion: string;
  tokensIn: number | null;
  tokensOut: number | null;
  latencyMs: number;
  systemPrompt: string;
  userPrompt: string;
  userPromptImages: ExploreLlmPromptImages | null;
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

  getModel(): string {
    return this.model;
  }

  async mrPlan(input: {
    url: string;
    screenshotBase64: string;
    transformFamily: TransformFamily;
  }): Promise<ExploreLlmResult<MrIntent>> {
    return this.call({
      purpose: 'mr_plan',
      promptVersion: MR_PLAN_PROMPT_VERSION,
      system: buildMrPlanSystemPrompt(input.transformFamily),
      userText: buildMrPlanUserText(input),
      screenshotsBase64: [input.screenshotBase64],
      schema: MrPlanOutputSchema,
      schemaName: 'mr_plan',
      normalize: (raw) => normalizeMrPlanOutput(raw, input.transformFamily),
    });
  }

  async observeSpec(input: {
    url: string;
    screenshotBase64: string;
    transformFamily: TransformFamily;
    mrIntent: MrIntent;
    inventory: PageSnapshotInventory;
    inventorySnapshotId: string;
    sourceSteps: SlotStep[];
  }): Promise<ExploreLlmResult<ObserveSpecOutput>> {
    return this.call({
      purpose: 'observe_spec',
      promptVersion: OBSERVE_SPEC_PROMPT_VERSION,
      system: buildObserveSpecSystemPrompt(input.transformFamily),
      userText: buildObserveSpecUserText({
        url: input.url,
        transformFamily: input.transformFamily,
        mrIntent: input.mrIntent,
        inventory: input.inventory,
        inventorySnapshotId: input.inventorySnapshotId,
        sourceSteps: input.sourceSteps,
        observationIntents: input.mrIntent.observation_intents,
      }),
      screenshotsBase64: [input.screenshotBase64],
      schema: ObserveSpecOutputSchema,
      schemaName: 'observe_spec',
      normalize: (raw) => normalizeObserveSpecOutput(raw),
    });
  }

  async planNext(input: {
    url: string;
    phase: ExplorePhase;
    mrIntent: MrIntent;
    inventory: PageSnapshotInventory;
    validatedSteps: { source: unknown[]; follow_up: unknown[] };
    batchLog: ExploreBatchLog;
    sourceReference?: ExploreSourceReference;
    screenshotBase64: string;
    failureScreenshotBase64?: string;
    latestProbeFailureBatch?: number;
  }): Promise<ExploreLlmResult<import('@metamorph/core').ExplorePlanOutput>> {
    const phaseSteps = input.validatedSteps[input.phase as keyof typeof input.validatedSteps];
    const nextStepId =
      (Array.isArray(phaseSteps) ? phaseSteps.length : 0) + 1;

    const screenshotsBase64 = [input.screenshotBase64];
    if (input.failureScreenshotBase64) {
      screenshotsBase64.push(input.failureScreenshotBase64);
    }

    return this.call({
      purpose: 'plan_explore',
      promptVersion: PLAN_EXPLORE_PROMPT_VERSION,
      system: buildPlanExploreSystemPrompt(),
      userText: buildPlanExploreUserText({
        url: input.url,
        phase: input.phase,
        mrIntent: input.mrIntent,
        inventory: input.inventory,
        batchLog: input.batchLog,
        sourceReference: input.sourceReference,
        latestProbeFailureBatch: input.latestProbeFailureBatch,
      }),
      screenshotsBase64,
      schema: ExplorePlanOutputSchema,
      schemaName: 'plan_explore',
      normalize: (raw) => normalizePlanOutput(raw, nextStepId),
      maxTokens: this.planExploreMaxTokens(),
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
    batchRationale?: string;
    screenshotBeforeBase64: string;
    screenshotAfterBase64: string;
    probeError?: string;
  }): Promise<ExploreLlmResult<import('@metamorph/core').ExploreVerifyOutput>> {
    return this.call({
      purpose: 'explore_verify',
      promptVersion: EXPLORE_VERIFY_PROMPT_VERSION,
      system: buildExploreVerifySystemPrompt(),
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
    schema: { safeParse: (data: unknown) => { success: boolean; data?: T; error?: { message: string; issues?: readonly { message: string }[] } } };
    schemaName: string;
    normalize?: (raw: unknown) => unknown;
    maxTokens?: number;
  }): Promise<ExploreLlmResult<T>> {
    const startedAt = Date.now();
    const screenshotCount = input.screenshotsBase64?.length ?? 0;
    const promptAudit = buildPromptAudit(input.system, input.userText, input.purpose, screenshotCount);

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

    try {
      const completion = await this.completeWithFormatFallback(
        messages,
        input.schemaName,
        input.schema,
        input.maxTokens,
      );
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

      if (!validated.success || validated.data === undefined) {
        const promptMessage = formatLlmValidationErrorForPrompt(
          (validated.error ?? { issues: [{ message: 'unknown validation error', code: 'custom', path: [] }] }) as {
            issues: readonly { code: string; path: PropertyKey[]; message: string }[];
          },
          normalized,
        );

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

        throw new ExploreLlmValidationError(
          promptMessage,
          normalized,
          parsed,
          promptAudit,
        );
      }

      const output = validated.data;

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
        output,
      });

      return {
        output,
        audit: {
          purpose: input.purpose,
          model: this.model,
          promptVersion: input.promptVersion,
          tokensIn: usage.tokensIn,
          tokensOut: usage.tokensOut,
          latencyMs: usage.latencyMs,
          ...promptAudit,
        },
      };
    } catch (error) {
      if (error instanceof ExploreLlmValidationError) {
        throw error;
      }

      const message = error instanceof Error ? error.message : 'LLM error';
      throw new ExploreLlmCallError(message, promptAudit, error);
    }
  }

  private async completeWithFormatFallback(
    messages: Array<{ role: string; content: unknown }>,
    schemaName: string,
    zodSchema: unknown,
    maxTokens?: number,
  ): Promise<{
    content: string;
    payload: ChatCompletionResponse;
    responseFormat: OpenRouterResponseFormat;
  }> {
    let responseFormat = buildOpenRouterResponseFormat(zodSchema, schemaName);
    let response = await this.postCompletion(messages, responseFormat, maxTokens);

    if (!response.ok) {
      const body = await response.text();
      if (
        responseFormat.type === 'json_schema' &&
        isStructuredOutputUnsupported(response.status, body)
      ) {
        responseFormat = { type: 'json_object' };
        response = await this.postCompletion(messages, responseFormat, maxTokens);
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
      response = await this.postCompletion(messages, responseFormat, maxTokens);
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

  private planExploreMaxTokens(): number {
    const configured = Number(process.env.OPENROUTER_PLAN_EXPLORE_MAX_TOKENS ?? 4096);
    return Number.isFinite(configured) && configured > 0 ? configured : 4096;
  }

  private async postCompletion(
    messages: Array<{ role: string; content: unknown }>,
    responseFormat: OpenRouterResponseFormat,
    maxTokens?: number,
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
          ...(maxTokens !== undefined ? { max_tokens: maxTokens } : {}),
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

function normalizeMrPlanOutput(
  raw: unknown,
  lockedFamily: TransformFamily,
): unknown {
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
      transform_family: lockedFamily,
      description: mrDefinition.transformation,
    };
  }

  if (!mrDefinition.transformation || typeof mrDefinition.transformation !== 'object') {
    mrDefinition.transformation = {
      transform_family: lockedFamily,
      description: 'Pending transformation description.',
    };
  } else {
    const transformation = {
      ...(mrDefinition.transformation as Record<string, unknown>),
      transform_family: lockedFamily,
    };
    mrDefinition.transformation = transformation;
  }

  if (typeof mrDefinition.relation === 'string') {
    mrDefinition.relation = {
      on: [],
      description: mrDefinition.relation,
    };
  }

  if (!mrDefinition.relation || typeof mrDefinition.relation !== 'object') {
    mrDefinition.relation = {
      on: [],
      description: 'Relation pending.',
    };
  } else {
    const relation = mrDefinition.relation as Record<string, unknown>;
    if (!Array.isArray(relation.on)) {
      relation.on = [];
    }
    if (typeof relation.description !== 'string') {
      relation.description = 'Observations must satisfy the metamorphic relation.';
    }
  }

  const parsed = MrDefinitionSchema.safeParse(
    applyFamilyProfile(mrDefinition as MrIntent['mr_definition'], lockedFamily),
  );

  if (parsed.success) {
    record.mr_definition = parsed.data;
  } else {
    record.mr_definition = applyFamilyProfile(
      {
        precondition: { description: 'Explored page satisfies the MR precondition.' },
        transformation: {
          transform_family: lockedFamily,
          description: 'Exploration transformation.',
        },
        relation: {
          on: [],
          description: 'Relation enforced by family profile.',
        },
      },
      lockedFamily,
    );
  }

  return record;
}

function normalizeObserveSpecOutput(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object') {
    return raw;
  }

  const record = { ...(raw as Record<string, unknown>) };
  if (!Array.isArray(record.observables)) {
    return record;
  }

  record.observables = record.observables.map((observable) => {
    if (!observable || typeof observable !== 'object') {
      return observable;
    }

    const obs = { ...(observable as Record<string, unknown>) };
    if (obs.binding && typeof obs.binding === 'object') {
      obs.binding = normalizeObservationBinding(obs.binding as Record<string, unknown>);
    }
    return obs;
  });

  return record;
}

function normalizeObservationBinding(
  binding: Record<string, unknown>,
): Record<string, unknown> {
  const normalized = { ...binding };

  if (typeof normalized.element_id === 'string') {
    normalized.element_id = normalizeElementShortId(normalized.element_id);
  }

  if (Array.isArray(normalized.element_ids)) {
    normalized.element_ids = normalized.element_ids.map((id) =>
      typeof id === 'string' ? normalizeElementShortId(id) : id,
    );
  }

  if (Array.isArray(normalized.parts)) {
    normalized.parts = normalized.parts.map((part) => {
      if (!part || typeof part !== 'object') {
        return part;
      }
      const partRecord = { ...(part as Record<string, unknown>) };
      if (typeof partRecord.element_id === 'string') {
        partRecord.element_id = normalizeElementShortId(partRecord.element_id);
      }
      return partRecord;
    });
  }

  return normalized;
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

  if (typeof record.element_id === 'string') {
    record.element_id = normalizeElementShortId(record.element_id);
  }

  if (record.action === 'scroll') {
    delete record.element_id;
    delete record.resolved_locator;
    delete record.resolved_selector;
  }

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

function buildPromptImageLabels(purpose: string, count: number): string[] {
  if (count <= 0) {
    return [];
  }

  if (purpose === 'explore_verify') {
    return count >= 2 ? ['before', 'after'] : ['before'];
  }

  if (purpose === 'plan_explore' && count >= 2) {
    return ['inventory', 'failure'];
  }

  return Array.from({ length: count }, (_, index) =>
    index === 0 ? 'inventory' : `image_${index + 1}`,
  );
}

function buildPromptAudit(
  system: string,
  userText: string,
  purpose: string,
  screenshotCount: number,
): ExploreLlmPromptAudit {
  return {
    systemPrompt: system,
    userPrompt: userText,
    userPromptImages:
      screenshotCount > 0
        ? { count: screenshotCount, labels: buildPromptImageLabels(purpose, screenshotCount) }
        : null,
  };
}
