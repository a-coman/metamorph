import { z } from 'zod';
import { ObservableDefSchema } from './observable.schema.js';

export const ObserveSpecOutputSchema = z.object({
  observables: z.array(ObservableDefSchema).min(1).max(8),
});

export type ObserveSpecOutput = z.infer<typeof ObserveSpecOutputSchema>;

export const OBSERVE_SPEC_PROMPT_VERSION = 'observe-spec-v1';
