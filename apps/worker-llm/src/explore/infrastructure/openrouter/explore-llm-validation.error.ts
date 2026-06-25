import type { SlotAction, SlotStep } from '@metamorph/core';
import { formatStepLine } from '../graph/batch-log.js';

export type ExploreLlmPromptImages = {
  count: number;
  labels?: string[];
};

export type ExploreLlmPromptAudit = {
  systemPrompt: string;
  userPrompt: string;
  userPromptImages: ExploreLlmPromptImages | null;
};

type ZodIssueLike = {
  code: string;
  path: PropertyKey[];
  message: string;
  expected?: string;
  received?: string;
  options?: readonly string[];
};

type ZodErrorLike = {
  issues: readonly ZodIssueLike[];
};

export class ExploreLlmValidationError extends Error {
  readonly normalizedOutput: unknown;
  readonly rawOutput: unknown;
  readonly promptAudit?: ExploreLlmPromptAudit;

  constructor(
    message: string,
    normalizedOutput: unknown,
    rawOutput: unknown,
    promptAudit?: ExploreLlmPromptAudit,
  ) {
    super(message);
    this.name = 'ExploreLlmValidationError';
    this.normalizedOutput = normalizedOutput;
    this.rawOutput = rawOutput;
    this.promptAudit = promptAudit;
  }
}

export class ExploreLlmCallError extends Error {
  readonly promptAudit: ExploreLlmPromptAudit;
  readonly cause: unknown;

  constructor(message: string, promptAudit: ExploreLlmPromptAudit, cause?: unknown) {
    super(message);
    this.name = 'ExploreLlmCallError';
    this.promptAudit = promptAudit;
    this.cause = cause;
  }
}

function valueAtPath(obj: unknown, path: PropertyKey[]): unknown {
  let current = obj;
  for (const key of path) {
    if (current == null || typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<PropertyKey, unknown>)[key];
  }
  return current;
}

function formatReceived(value: unknown): string {
  if (value === undefined) {
    return 'missing';
  }
  if (typeof value === 'string') {
    return JSON.stringify(value);
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return JSON.stringify(value);
}

function formatFieldPath(path: PropertyKey[]): string {
  if (path.length === 0) {
    return 'output';
  }

  if (path[0] === 'steps' && typeof path[1] === 'number' && path.length > 2) {
    return path.slice(2).map(String).join('.');
  }

  return path.map(String).join('.');
}

function stepRecordAtIssue(output: unknown, path: PropertyKey[]): Record<string, unknown> | undefined {
  if (path[0] !== 'steps' || typeof path[1] !== 'number') {
    return undefined;
  }

  const steps = valueAtPath(output, ['steps']);
  if (!Array.isArray(steps)) {
    return undefined;
  }

  const stepRecord = steps[path[1]];
  if (!stepRecord || typeof stepRecord !== 'object') {
    return undefined;
  }

  return stepRecord as Record<string, unknown>;
}

function formatPlanLine(output: unknown): string {
  if (!output || typeof output !== 'object') {
    return 'plan';
  }

  const record = output as Record<string, unknown>;
  const parts: string[] = [];

  if (typeof record.action === 'string') {
    parts.push(`action=${record.action}`);
  } else if (record.action !== undefined) {
    parts.push(`action=${formatReceived(record.action)}`);
  }

  if (typeof record.rationale === 'string') {
    const rationale =
      record.rationale.length > 80 ? `${record.rationale.slice(0, 77)}...` : record.rationale;
    parts.push(`rationale=${JSON.stringify(rationale)}`);
  } else if (record.rationale !== undefined) {
    parts.push(`rationale=${formatReceived(record.rationale)}`);
  }

  if (Array.isArray(record.steps)) {
    if (record.steps.length === 0) {
      parts.push('steps=(empty)');
    } else {
      const stepLines = record.steps
        .filter(
          (step): step is Record<string, unknown> => Boolean(step) && typeof step === 'object',
        )
        .map((step, index) => formatStepLine(toDisplayStep(step, index + 1)));
      parts.push(`steps=[${stepLines.join('; ')}]`);
    }
  } else if (record.steps !== undefined) {
    parts.push(`steps=${formatReceived(record.steps)}`);
  }

  return parts.length > 0 ? parts.join(' ') : 'plan';
}

function formatIssueDetail(issue: ZodIssueLike, output: unknown): string {
  const received = valueAtPath(output, issue.path);
  const receivedStr = formatReceived(received);
  const field = issue.path.at(-1);

  if (field === 'element_id' && issue.code === 'invalid_format') {
    return `element_id: got ${receivedStr} — use a shortId from Current inventory (e.g. E4), not a selector or DOM id`;
  }

  if (issue.code === 'invalid_value') {
    const options = issue.options?.length ? issue.options.join(' | ') : undefined;
    const location = formatFieldPath(issue.path);
    return options
      ? `${location}: got ${receivedStr} — allowed: ${options}`
      : `${location}: ${issue.message}`;
  }

  if (issue.code === 'invalid_type') {
    const location = formatFieldPath(issue.path);
    const expected = issue.expected ?? 'valid value';
    const got = issue.received ?? typeof received;
    return `${location}: expected ${expected}, got ${got}`;
  }

  const location = formatFieldPath(issue.path);
  if (received !== undefined) {
    return `${location}: ${issue.message} (got ${receivedStr})`;
  }

  return `${location}: ${issue.message}`;
}

function formatIssue(issue: ZodIssueLike, output: unknown): string {
  const detail = formatIssueDetail(issue, output);
  const stepRecord = stepRecordAtIssue(output, issue.path);

  if (stepRecord && issue.path.length >= 2) {
    const stepIndex = issue.path[1] as number;
    const stepLine = formatStepLine(toDisplayStep(stepRecord, stepIndex + 1));
    return `${stepLine} failed validation - ${detail}`;
  }

  const planLine = formatPlanLine(output);
  return `${planLine} failed validation - ${detail}`;
}

/** Human-readable validation summary for plan_explore retries (batch log Errors section). */
export function formatLlmValidationErrorForPrompt(
  error: ZodErrorLike,
  normalizedOutput: unknown,
): string {
  const lines = error.issues.map((issue) => formatIssue(issue, normalizedOutput));
  if (lines.length === 0) {
    return 'LLM output did not match the required JSON schema.';
  }
  if (lines.length === 1) {
    return lines[0]!;
  }
  return lines.join('\n');
}

function toDisplayStep(record: Record<string, unknown>, fallbackId: number): SlotStep {
  const action = (
    typeof record.action === 'string' ? record.action : 'click'
  ) as SlotAction;

  return {
    id: typeof record.id === 'number' ? record.id : fallbackId,
    action,
    ...(typeof record.element_id === 'string' ? { element_id: record.element_id } : {}),
    ...(typeof record.value === 'string' ? { value: record.value } : {}),
    ...(typeof record.url === 'string' ? { url: record.url } : {}),
    ...(typeof record.key === 'string' ? { key: record.key } : {}),
    ...(typeof record.scroll_y === 'number' ? { scroll_y: record.scroll_y } : {}),
    ...(typeof record.timeout_ms === 'number' ? { timeout_ms: record.timeout_ms } : {}),
  };
}

function stepsFromPlanOutput(output: unknown): SlotStep[] {
  if (!output || typeof output !== 'object') {
    return [];
  }

  const steps = (output as Record<string, unknown>).steps;
  if (!Array.isArray(steps)) {
    return [];
  }

  return steps
    .filter((step): step is Record<string, unknown> => Boolean(step) && typeof step === 'object')
    .map((step, index) => toDisplayStep(step, index + 1));
}

/** Best-effort steps from a plan_explore response that failed schema validation. */
export function extractRejectedPlanSteps(
  normalizedOutput: unknown,
  rawOutput?: unknown,
): SlotStep[] {
  const fromNormalized = stepsFromPlanOutput(normalizedOutput);
  if (fromNormalized.length > 0) {
    return fromNormalized;
  }

  return stepsFromPlanOutput(rawOutput);
}
