import type { ObservableDef } from '../../domain/schemas/observable.schema.js';
import { buildObservationPayloadSchema } from '../../domain/schemas/observation-catalog.schema.js';
import {
  evaluateCardinalityLte,
  evaluateEqual,
  evaluateNotEqual,
  evaluateSetEqual,
} from './relation-evaluators.js';

export type FieldEvaluationDetail = {
  source: unknown;
  followUp: unknown;
  ok: boolean;
  compare: ObservableDef['compare'];
  error?: string;
};

export type MrEvaluationResult = {
  verdict: 'pass' | 'fail';
  details: Record<string, FieldEvaluationDetail>;
};

export class MrEvaluationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MrEvaluationError';
  }
}

function isMissingObservation(value: unknown): boolean {
  return value === null || value === undefined;
}

function evaluateObservableCompare(
  compare: ObservableDef['compare'],
  source: unknown,
  followUp: unknown,
): boolean {
  switch (compare) {
    case 'equal':
      return evaluateEqual(source, followUp);
    case 'not_equal':
      return evaluateNotEqual(source, followUp);
    case 'set_equal':
      return evaluateSetEqual(source, followUp);
    case 'cardinality_lte':
      return evaluateCardinalityLte(source, followUp);
    default:
      throw new MrEvaluationError(`Unsupported compare: ${compare}`);
  }
}

export function validateObservationPayload(
  _schemaContent: string,
  payload: unknown,
  observables: ObservableDef[],
): { valid: true } | { valid: false; error: string } {
  const zodSchema = buildObservationPayloadSchema(observables);
  const parsed = zodSchema.safeParse(payload);

  if (!parsed.success) {
    return { valid: false, error: parsed.error.message };
  }

  return { valid: true };
}

export function evaluateMr(
  observables: ObservableDef[],
  sourceObs: Record<string, unknown>,
  followUpObs: Record<string, unknown>,
): MrEvaluationResult {
  const details: Record<string, FieldEvaluationDetail> = {};
  let allOk = true;

  for (const observable of observables) {
    const key = observable.key;
    const source = sourceObs[key];
    const followUp = followUpObs[key];

    if (isMissingObservation(source) || isMissingObservation(followUp)) {
      details[key] = {
        source,
        followUp,
        ok: false,
        compare: observable.compare,
        error: 'Missing observation value',
      };
      allOk = false;
      continue;
    }

    const ok = evaluateObservableCompare(observable.compare, source, followUp);

    details[key] = { source, followUp, ok, compare: observable.compare };
    if (!ok) {
      allOk = false;
    }
  }

  return {
    verdict: allOk ? 'pass' : 'fail',
    details,
  };
}
