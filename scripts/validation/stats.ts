export function rate(numerator: number, denominator: number): number | null {
  if (denominator === 0) {
    return null;
  }
  return numerator / denominator;
}

export function formatPercent(value: number | null, digits = 1): string {
  if (value === null) {
    return 'n/a';
  }
  return `${(value * 100).toFixed(digits)}%`;
}

export function median(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1]! + sorted[middle]!) / 2;
  }
  return sorted[middle]!;
}

export function iqr(values: number[]): { q1: number | null; q3: number | null } {
  if (values.length === 0) {
    return { q1: null, q3: null };
  }
  const sorted = [...values].sort((left, right) => left - right);
  return {
    q1: percentile(sorted, 0.25),
    q3: percentile(sorted, 0.75),
  };
}

function percentile(sorted: number[], p: number): number {
  const index = (sorted.length - 1) * p;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) {
    return sorted[lower]!;
  }
  const weight = index - lower;
  return sorted[lower]! * (1 - weight) + sorted[upper]! * weight;
}

export function summarizeNumeric(values: number[]): {
  count: number;
  median: number | null;
  q1: number | null;
  q3: number | null;
  min: number | null;
  max: number | null;
} {
  if (values.length === 0) {
    return { count: 0, median: null, q1: null, q3: null, min: null, max: null };
  }
  const sorted = [...values].sort((left, right) => left - right);
  const spread = iqr(sorted);
  return {
    count: values.length,
    median: median(values),
    q1: spread.q1,
    q3: spread.q3,
    min: sorted[0]!,
    max: sorted[sorted.length - 1]!,
  };
}

export function countBy<T extends string>(
  items: T[],
): Record<T, number> {
  const counts = {} as Record<T, number>;
  for (const item of items) {
    counts[item] = (counts[item] ?? 0) + 1;
  }
  return counts;
}
