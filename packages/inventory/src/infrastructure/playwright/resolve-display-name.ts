const FILTER_ARIA_PATTERNS: RegExp[] = [
  /^aplicar filtro de (.+?) para reducir/i,
  /^apply (?:the )?(.+?) filter/i,
  /^filter by (.+)$/i,
  /^select (.+)$/i,
];

/** Prefer visible text; otherwise shorten common filter aria-label patterns. */
export function resolveShortDisplayName(
  fullName: string,
  visibleText?: string | null,
): string {
  const trimmedVisible = visibleText?.trim();
  if (trimmedVisible && trimmedVisible.length > 0 && trimmedVisible.length <= 60) {
    return trimmedVisible;
  }

  const trimmed = fullName.trim();
  for (const pattern of FILTER_ARIA_PATTERNS) {
    const match = trimmed.match(pattern);
    if (match?.[1]) {
      return match[1].trim();
    }
  }

  if (trimmed.length > 60) {
    return `${trimmed.slice(0, 57)}...`;
  }

  return trimmed;
}
