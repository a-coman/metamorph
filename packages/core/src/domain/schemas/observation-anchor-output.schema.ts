import { z } from 'zod';
import { ELEMENT_SHORT_ID_PATTERN } from '../element-short-id.js';

export const ObservationAnchorOutputSchema = z.object({
  label_element_id: z.string().regex(ELEMENT_SHORT_ID_PATTERN),
  number_index: z.number().int().nonnegative(),
  rationale: z.string().min(1),
});

export type ObservationAnchorOutput = z.infer<typeof ObservationAnchorOutputSchema>;

export const OBSERVATION_ANCHOR_PROMPT_VERSION = 'observation-anchor-v2';

/** Minimum bounding-box area (px²) for a valid result-count label element. */
export const MIN_RESULT_LABEL_ELEMENT_AREA_PX = 2000;
