export function evaluateEqual(source: unknown, followUp: unknown): boolean {
  if (source === followUp) {
    return true;
  }

  if (typeof source === 'string' && typeof followUp === 'string') {
    return source.trim() === followUp.trim();
  }

  if (typeof source === 'number' && typeof followUp === 'number') {
    return source === followUp;
  }

  if (typeof source === 'boolean' && typeof followUp === 'boolean') {
    return source === followUp;
  }

  if (Array.isArray(source) && Array.isArray(followUp)) {
    if (source.length !== followUp.length) {
      return false;
    }

    for (let index = 0; index < source.length; index++) {
      if (!evaluateEqual(source[index], followUp[index])) {
        return false;
      }
    }

    return true;
  }

  return false;
}

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

export function evaluateCardinalityLte(source: unknown, followUp: unknown): boolean {
  if (typeof source !== 'number' || typeof followUp !== 'number') {
    return false;
  }

  if (!Number.isFinite(source) || !Number.isFinite(followUp)) {
    return false;
  }

  return followUp <= source;
}
