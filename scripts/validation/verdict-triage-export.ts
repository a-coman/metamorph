type FieldEvaluationDetail = {
  source?: unknown;
  followUp?: unknown;
  ok?: boolean;
  compare?: string;
  error?: string;
};

export type EvaluationDetails = Record<string, FieldEvaluationDetail>;

export function parseEvaluationDetails(inputBundle: unknown): EvaluationDetails {
  if (!inputBundle || typeof inputBundle !== 'object') {
    return {};
  }
  const details = (inputBundle as { evaluation_details?: unknown }).evaluation_details;
  if (!details || typeof details !== 'object') {
    return {};
  }
  return details as EvaluationDetails;
}

export function formatEvaluationValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'string') {
    return value.length > 200 ? `${value.slice(0, 200)}…` : value;
  }
  const text = JSON.stringify(value);
  return text.length > 200 ? `${text.slice(0, 200)}…` : text;
}

export function listFailingObservables(inputBundle: unknown): Array<{
  observable: string;
  compare: string;
  sourceValue: string;
  followUpValue: string;
  error: string;
}> {
  const details = parseEvaluationDetails(inputBundle);
  return Object.entries(details)
    .filter(([, detail]) => detail.ok === false)
    .map(([observable, detail]) => ({
      observable,
      compare: detail.compare ?? '',
      sourceValue: formatEvaluationValue(detail.source),
      followUpValue: formatEvaluationValue(detail.followUp),
      error: detail.error ?? '',
    }));
}

export function summarizeEvaluationDetails(inputBundle: unknown): string {
  return listFailingObservables(inputBundle)
    .map(
      (row) =>
        `${row.observable}:${row.sourceValue} vs ${row.followUpValue}`,
    )
    .join('; ');
}
