import { FILTER_ARIA_LABEL_PATTERNS } from './inventory-scan-config.js';

export type ResolveShortDisplayNameOptions = {
  filterAriaLabelPatterns?: RegExp[];
};

/** Prefer visible text; otherwise shorten common filter aria-label patterns. */
export function resolveShortDisplayName(
  fullName: string,
  visibleText?: string | null,
  options?: ResolveShortDisplayNameOptions,
): string {
  const trimmedVisible = visibleText?.trim();
  if (trimmedVisible && trimmedVisible.length > 0 && trimmedVisible.length <= 60) {
    return trimmedVisible;
  }

  const patterns = options?.filterAriaLabelPatterns ?? FILTER_ARIA_LABEL_PATTERNS;
  const trimmed = fullName.trim();
  for (const pattern of patterns) {
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
