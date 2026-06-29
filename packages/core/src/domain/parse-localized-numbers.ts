/**
 * Parse numeric tokens from localized result-count labels (ES/EN).
 * Returns integers in order of appearance; ranges like "1-48" yield two numbers.
 */
export function parseLocalizedNumberToken(token: string): number | null {
  const trimmed = token.trim();
  if (!trimmed) {
    return null;
  }

  const lastComma = trimmed.lastIndexOf(',');
  const lastDot = trimmed.lastIndexOf('.');

  let normalized = trimmed;

  if (lastComma >= 0 && lastDot >= 0) {
    if (lastComma > lastDot) {
      normalized = trimmed.replace(/\./g, '').replace(',', '.');
    } else {
      normalized = trimmed.replace(/,/g, '');
    }
  } else if (lastComma >= 0) {
    const afterComma = trimmed.length - lastComma - 1;
    normalized =
      afterComma === 3 ? trimmed.replace(/,/g, '') : trimmed.replace(',', '.');
  } else if (lastDot >= 0) {
    const afterDot = trimmed.length - lastDot - 1;
    normalized =
      afterDot === 3 ? trimmed.replace(/\./g, '') : trimmed;
  }

  const value = Number(normalized);
  if (!Number.isFinite(value)) {
    return null;
  }

  return Math.trunc(value);
}

export function parseLocalizedNumbers(text: string): number[] {
  const numbers: number[] = [];
  const pattern = /\d[\d.,]*/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    const parsed = parseLocalizedNumberToken(match[0]);
    if (parsed !== null) {
      numbers.push(parsed);
    }
  }

  return numbers;
}

export function pickNumberAtIndex(text: string, index: number): number | null {
  if (!Number.isInteger(index) || index < 0) {
    return null;
  }

  const numbers = parseLocalizedNumbers(text);
  if (index >= numbers.length) {
    return null;
  }

  return numbers[index] ?? null;
}

/** Inline JS source for the same parser, embedded in generated playbooks. */
export const PARSE_LOCALIZED_NUMBERS_FN_SOURCE = `function parseLocalizedNumbers(text) {
  function parseToken(token) {
    const trimmed = token.trim();
    if (!trimmed) return null;
    const lastComma = trimmed.lastIndexOf(',');
    const lastDot = trimmed.lastIndexOf('.');
    let normalized = trimmed;
    if (lastComma >= 0 && lastDot >= 0) {
      normalized = lastComma > lastDot
        ? trimmed.replace(/\\./g, '').replace(',', '.')
        : trimmed.replace(/,/g, '');
    } else if (lastComma >= 0) {
      const afterComma = trimmed.length - lastComma - 1;
      normalized = afterComma === 3 ? trimmed.replace(/,/g, '') : trimmed.replace(',', '.');
    } else if (lastDot >= 0) {
      const afterDot = trimmed.length - lastDot - 1;
      normalized = afterDot === 3 ? trimmed.replace(/\\./g, '') : trimmed;
    }
    const value = Number(normalized);
    return Number.isFinite(value) ? Math.trunc(value) : null;
  }
  const numbers = [];
  const pattern = /\\d[\\d.,]*/g;
  let match;
  while ((match = pattern.exec(text)) !== null) {
    const parsed = parseToken(match[0]);
    if (parsed !== null) numbers.push(parsed);
  }
  return numbers;
}`;
