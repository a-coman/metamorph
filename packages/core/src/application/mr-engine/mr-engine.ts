import type { MrDefinition } from '../../domain/schemas/mr-definition.schema.js';
import {
  buildObservationPayloadSchema,
  OBSERVATION_FIELD_TYPES,
  parseObservationCatalogFields,
  type ObservationCatalogField,
} from '../../domain/schemas/observation-catalog.schema.js';
import {
  evaluateCardinalityLte,
  evaluateEqual,
  evaluateSetEqual,
} from './relation-evaluators.js';

export type FieldEvaluationDetail = {
  source: unknown;
  followUp: unknown;
  ok: boolean;
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

function evaluateFieldRelation(
  relationType: MrDefinition['relation']['type'],
  field: string,
  source: unknown,
  followUp: unknown,
): boolean {
  const fieldType =
    field in OBSERVATION_FIELD_TYPES
      ? OBSERVATION_FIELD_TYPES[field as ObservationCatalogField]
      : 'string';

  switch (relationType) {
    case 'equal':
      return evaluateEqual(source, followUp);
    case 'set_equal':
      return evaluateSetEqual(source, followUp);
    case 'cardinality_lte':
      if (fieldType === 'number') {
        return evaluateCardinalityLte(source, followUp);
      }
      return evaluateEqual(source, followUp);
    default:
      throw new MrEvaluationError(`Unsupported relation type: ${relationType}`);
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

    if (isMissingObservation(source) || isMissingObservation(followUp)) {
      details[field] = {
        source,
        followUp,
        ok: false,
        error: 'Missing observation value',
      };
      allOk = false;
      continue;
    }

    let ok: boolean;

    try {
      ok = evaluateFieldRelation(
        mrDefinition.relation.type,
        field,
        source,
        followUp,
      );
    } catch (error) {
      if (error instanceof MrEvaluationError) {
        throw error;
      }
      throw error;
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
