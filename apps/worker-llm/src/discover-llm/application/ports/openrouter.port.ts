import type { LlmDiscoverOutput } from '@metamorph/core';
import type { PageSnapshotInventory } from '@metamorph/core';

export type OpenRouterDiscoverInput = {
  url: string;
  inventory: PageSnapshotInventory;
  screenshotBase64: string;
};

export type OpenRouterDiscoverResult = {
  output: LlmDiscoverOutput;
  model: string;
  tokensIn: number | null;
  tokensOut: number | null;
  latencyMs: number;
};

export abstract class OpenRouterPort {
  abstract proposeDiscoverMr(
    input: OpenRouterDiscoverInput,
  ): Promise<OpenRouterDiscoverResult>;
}
