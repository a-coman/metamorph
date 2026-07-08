export type FieldEvaluationDetail = {
  source: unknown;
  followUp: unknown;
  ok: boolean;
  compare: string;
  error?: string;
};

export type RunEvaluation = {
  details: Record<string, FieldEvaluationDetail>;
  sortedKeys: string[];
  displayKeys: string[];
  passedCount: number;
  failedCount: number;
  totalCount: number;
  failedKeys: string[];
};

const MAX_VALUE_LENGTH = 80;

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function parseFieldDetail(value: unknown): FieldEvaluationDetail | null {
  const record = asRecord(value);
  if (!record || typeof record.ok !== 'boolean' || typeof record.compare !== 'string') {
    return null;
  }

  return {
    source: record.source,
    followUp: record.followUp,
    ok: record.ok,
    compare: record.compare,
    error: typeof record.error === 'string' ? record.error : undefined,
  };
}

export function formatObservationValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '—';
  }

  if (typeof value === 'string') {
    return value.length > MAX_VALUE_LENGTH
      ? `${value.slice(0, MAX_VALUE_LENGTH)}…`
      : value;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  const serialized = JSON.stringify(value);
  return serialized.length > MAX_VALUE_LENGTH
    ? `${serialized.slice(0, MAX_VALUE_LENGTH)}…`
    : serialized;
}

export function parseRunEvaluation(inputBundle: unknown): RunEvaluation | null {
  const bundle = asRecord(inputBundle);
  const rawDetails = bundle?.evaluation_details;
  if (!rawDetails || typeof rawDetails !== 'object' || Array.isArray(rawDetails)) {
    return null;
  }

  const details: Record<string, FieldEvaluationDetail> = {};
  for (const [key, value] of Object.entries(rawDetails)) {
    const parsed = parseFieldDetail(value);
    if (parsed) {
      details[key] = parsed;
    }
  }

  if (Object.keys(details).length === 0) {
    return null;
  }

  const sortedKeys = Object.keys(details).sort((a, b) => a.localeCompare(b));
  const failedKeys = sortedKeys.filter((key) => !details[key].ok);
  const passedKeys = sortedKeys.filter((key) => details[key].ok);
  const displayKeys = [...failedKeys, ...passedKeys];
  const passedCount = passedKeys.length;

  return {
    details,
    sortedKeys,
    displayKeys,
    passedCount,
    failedCount: failedKeys.length,
    totalCount: sortedKeys.length,
    failedKeys,
  };
}

export function formatCompareOperator(compare: string): string {
  switch (compare) {
    case 'equal':
      return '=';
    case 'not_equal':
      return '≠';
    case 'set_equal':
      return 'set =';
    case 'cardinality_lte':
      return '≤';
    default:
      return compare;
  }
}

export function observationValuesMatch(source: unknown, followUp: unknown): boolean {
  return formatObservationValue(source) === formatObservationValue(followUp);
}

export function parseRunInputBundleError(inputBundle: unknown): string | null {
  const bundle = asRecord(inputBundle);
  return typeof bundle?.error === 'string' ? bundle.error : null;
}
