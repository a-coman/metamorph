function normalizeSet(value: unknown): Set<string> {
  if (Array.isArray(value)) {
    return new Set(value.map((item) => String(item)));
  }

  if (typeof value === 'string') {
    return new Set(
      value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
    );
  }

  return new Set([String(value)]);
}

export function evaluateEqual(source: unknown, followUp: unknown): boolean {
  return source === followUp;
}

export function evaluateSetEqual(source: unknown, followUp: unknown): boolean {
  const sourceSet = normalizeSet(source);
  const followUpSet = normalizeSet(followUp);

  if (sourceSet.size !== followUpSet.size) {
    return false;
  }

  for (const item of sourceSet) {
    if (!followUpSet.has(item)) {
      return false;
    }
  }

  return true;
}
