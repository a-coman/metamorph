import type { MrDefinition } from '../../domain/schemas/mr-definition.schema.js';
import {
  buildObservationPayloadSchema,
  parseObservationCatalogFields,
} from '../../domain/schemas/observation-catalog.schema.js';
import { evaluateEqual, evaluateSetEqual } from './relation-evaluators.js';

export type FieldEvaluationDetail = {
  source: unknown;
  followUp: unknown;
  ok: boolean;
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

export function validateObservationPayload(
  schemaContent: string,
  payload: unknown,
): { valid: true } | { valid: false; error: string } {
  let schemaJson: { properties?: Record<string, { type?: string }>; required?: string[] };

  try {
    schemaJson = JSON.parse(schemaContent) as {
      properties?: Record<string, { type?: string }>;
      required?: string[];
    };
  } catch {
    return { valid: false, error: 'Invalid observation schema JSON' };
  }

  const requiredFields = schemaJson.required ?? Object.keys(schemaJson.properties ?? {});
  const catalogFields = parseObservationCatalogFields(requiredFields);
  const zodSchema = buildObservationPayloadSchema(catalogFields);
  const parsed = zodSchema.safeParse(payload);

  if (!parsed.success) {
    return { valid: false, error: parsed.error.message };
  }

  return { valid: true };
}

export function evaluateMr(
  mrDefinition: MrDefinition,
  sourceObs: Record<string, unknown>,
  followUpObs: Record<string, unknown>,
): MrEvaluationResult {
  const details: Record<string, FieldEvaluationDetail> = {};
  let allOk = true;

  for (const field of mrDefinition.relation.on) {
    const source = sourceObs[field];
    const followUp = followUpObs[field];
    let ok: boolean;

    switch (mrDefinition.relation.type) {
      case 'equal':
        ok = evaluateEqual(source, followUp);
        break;
      case 'set_equal':
        ok = evaluateSetEqual(source, followUp);
        break;
      default:
        throw new MrEvaluationError(
          `Unsupported relation type for MVP: ${mrDefinition.relation.type}`,
        );
    }

    details[field] = { source, followUp, ok };
    if (!ok) {
      allOk = false;
    }
  }

  return {
    verdict: allOk ? 'pass' : 'fail',
    details,
  };
}
