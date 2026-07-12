import type { NumericSummary } from './stats.js';

export function mdTable(headers: string[], rows: string[][]): string {
  if (rows.length === 0) {
    return '_No data._\n';
  }
  const headerLine = `| ${headers.join(' | ')} |`;
  const separator = `| ${headers.map(() => '---').join(' | ')} |`;
  const body = rows.map((row) => `| ${row.join(' | ')} |`).join('\n');
  return `${headerLine}\n${separator}\n${body}\n`;
}

export function formatPercent(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined) {
    return 'n/a';
  }
  return `${(value * 100).toFixed(digits)}%`;
}

export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return 'n/a';
  }
  return String(value);
}

export function formatMs(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return 'n/a';
  }
  if (Math.abs(value) < 1000) {
    return `${Math.round(value)} ms`;
  }
  return `${(value / 1000).toFixed(1)} s`;
}

export function summarizeNumericBlock(
  label: string,
  summary: NumericSummary,
  valueFormatter: (value: number | null | undefined) => string = formatNumber,
  options: { includeBoxPlot?: boolean } = {},
): string {
  const distribution = mdTable(
    ['Metric', 'Count', 'Median', 'Q1', 'Q3', 'Observed min', 'Observed max', 'Range (max-min)'],
    [[
      label,
      String(summary.count),
      valueFormatter(summary.median),
      valueFormatter(summary.q1),
      valueFormatter(summary.q3),
      valueFormatter(summary.min),
      valueFormatter(summary.max),
      valueFormatter(summary.range),
    ]],
  );
  const boxPlot = mdTable(
    ['Box plot', 'IQR', 'Lower fence', 'Upper fence', 'Lower whisker', 'Upper whisker', 'Outliers'],
    [[
      label,
      valueFormatter(summary.iqr),
      valueFormatter(summary.lowerFence),
      valueFormatter(summary.upperFence),
      valueFormatter(summary.lowerWhisker),
      valueFormatter(summary.upperWhisker),
      summary.outliers.length > 0
        ? summary.outliers.map((value) => valueFormatter(value)).join(', ')
        : 'none',
    ]],
  );
  return options.includeBoxPlot === false ? distribution : `${distribution}\n${boxPlot}`;
}

export function hasFilledColumn(rows: Array<Record<string, string>>, column: string): boolean {
  return rows.some((row) => (row[column] ?? '').trim().length > 0);
}

export function countColumnValues(
  rows: Array<Record<string, string>>,
  column: string,
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const row of rows) {
    const value = (row[column] ?? '').trim();
    if (!value) {
      continue;
    }
    counts[value] = (counts[value] ?? 0) + 1;
  }
  return counts;
}

export function yesNoRates(
  rows: Array<Record<string, string>>,
  columns: string[],
): Array<{ criterion: string; yes: number; total: number; yesRate: number | null }> {
  return columns.map((column) => {
    const answered = rows.filter((row) => {
      const value = (row[column] ?? '').trim().toLowerCase();
      return value === 'yes' || value === 'no';
    });
    const yes = answered.filter((row) => (row[column] ?? '').trim().toLowerCase() === 'yes').length;
    return {
      criterion: column,
      yes,
      total: answered.length,
      yesRate: answered.length ? yes / answered.length : null,
    };
  });
}
