import { z } from 'zod';
import { GenerationSlotsSchema } from './generation-slots.schema.js';
import { MrDefinitionSchema } from './mr-definition.schema.js';

export const LlmDiscoverOutputSchema = z.object({
  mr_definition: MrDefinitionSchema,
  generation_slots: GenerationSlotsSchema,
});

export type LlmDiscoverOutput = z.infer<typeof LlmDiscoverOutputSchema>;

export const LLM_DISCOVER_PROMPT_VERSION = 'discover-llm-v1';
