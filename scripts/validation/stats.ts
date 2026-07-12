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

export type NumericSummary = {
  count: number;
  median: number | null;
  q1: number | null;
  q3: number | null;
  min: number | null;
  max: number | null;
  range: number | null;
  iqr: number | null;
  lowerFence: number | null;
  upperFence: number | null;
  lowerWhisker: number | null;
  upperWhisker: number | null;
  outliers: number[];
};

/**
 * Summarizes a sample and computes Tukey box-plot values. Min and max are the
 * observed extremes; whiskers are the most extreme observations within the
 * Q1 - 1.5*IQR and Q3 + 1.5*IQR fences.
 */
export function summarizeNumeric(values: number[]): NumericSummary {
  if (values.length === 0) {
    return {
      count: 0,
      median: null,
      q1: null,
      q3: null,
      min: null,
      max: null,
      range: null,
      iqr: null,
      lowerFence: null,
      upperFence: null,
      lowerWhisker: null,
      upperWhisker: null,
      outliers: [],
    };
  }
  const sorted = [...values].sort((left, right) => left - right);
  const spread = iqr(sorted);
  const q1 = spread.q1!;
  const q3 = spread.q3!;
  const interquartileRange = q3 - q1;
  const lowerFence = q1 - 1.5 * interquartileRange;
  const upperFence = q3 + 1.5 * interquartileRange;
  const inliers = sorted.filter((value) => value >= lowerFence && value <= upperFence);
  const outliers = sorted.filter((value) => value < lowerFence || value > upperFence);
  return {
    count: values.length,
    median: median(values),
    q1,
    q3,
    min: sorted[0]!,
    max: sorted[sorted.length - 1]!,
    range: sorted[sorted.length - 1]! - sorted[0]!,
    iqr: interquartileRange,
    lowerFence,
    upperFence,
    lowerWhisker: inliers[0]!,
    upperWhisker: inliers[inliers.length - 1]!,
    outliers,
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
