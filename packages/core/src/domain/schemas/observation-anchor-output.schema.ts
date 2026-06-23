import { z } from 'zod';
import { ELEMENT_SHORT_ID_PATTERN } from '../element-short-id.js';

export const ObservationAnchorOutputSchema = z.object({
  container_element_id: z.string().regex(ELEMENT_SHORT_ID_PATTERN),
  item_selector_hint: z.enum(['listitem', 'article', 'li']).optional(),
  rationale: z.string().min(1),
});

export type ObservationAnchorOutput = z.infer<typeof ObservationAnchorOutputSchema>;

export const OBSERVATION_ANCHOR_PROMPT_VERSION = 'observation-anchor-v1';
