/** OpenRouter list price for minimax/minimax-m3 (USD per 1M tokens). */
export const TOKEN_PRICE_USD_PER_MILLION = {
  tokensIn: 0.3,
  tokensOut: 1.2,
} as const;

export function computeTokenCostUsd(tokensIn: number, tokensOut: number): number {
  return (
    (tokensIn / 1_000_000) * TOKEN_PRICE_USD_PER_MILLION.tokensIn +
    (tokensOut / 1_000_000) * TOKEN_PRICE_USD_PER_MILLION.tokensOut
  );
}

export function formatUsd(amount: number): string {
  if (amount < 0.01) {
    return `$${amount.toFixed(4)}`;
  }
  return `$${amount.toFixed(2)}`;
}

export type LlmUsageTotals = {
  callCount: number;
  tokensIn: number;
  tokensOut: number;
  latencyMs: number;
  costUsd: number;
};

export function sumLlmUsage(
  calls: Array<{
    tokensIn: number | null;
    tokensOut: number | null;
    latencyMs: number | null;
  }>,
): LlmUsageTotals {
  const tokensIn = calls.reduce((sum, call) => sum + (call.tokensIn ?? 0), 0);
  const tokensOut = calls.reduce((sum, call) => sum + (call.tokensOut ?? 0), 0);
  const latencyMs = calls.reduce((sum, call) => sum + (call.latencyMs ?? 0), 0);
  return {
    callCount: calls.length,
    tokensIn,
    tokensOut,
    latencyMs,
    costUsd: computeTokenCostUsd(tokensIn, tokensOut),
  };
}
