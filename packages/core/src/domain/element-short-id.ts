/** Set-of-Marks label format: E1, E2, E42 (no zero-padding). */
export const ELEMENT_SHORT_ID_PATTERN = /^E[1-9]\d*$/;

export function formatElementShortId(index: number): string {
  return `E${index + 1}`;
}

/** Normalize LLM output (e.g. E04 → E4) before schema validation. */
export function normalizeElementShortId(value: string): string {
  const match = value.match(/^E0*(\d+)$/);
  return match ? `E${match[1]}` : value;
}
