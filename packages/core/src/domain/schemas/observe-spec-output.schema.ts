import { z } from 'zod';
import { ObservableDefSchema, OBSERVE_SPEC_MAX_OBSERVABLES } from './observable.schema.js';

export const OBSERVE_SPEC_MIN_OBSERVABLES = 1;

export const ObserveSpecOutputSchema = z.object({
  observables: z
    .array(ObservableDefSchema)
    .min(OBSERVE_SPEC_MIN_OBSERVABLES)
    .max(OBSERVE_SPEC_MAX_OBSERVABLES),
});

export type ObserveSpecOutput = z.infer<typeof ObserveSpecOutputSchema>;

export const OBSERVE_SPEC_PROMPT_VERSION = 'observe-spec-v1';
