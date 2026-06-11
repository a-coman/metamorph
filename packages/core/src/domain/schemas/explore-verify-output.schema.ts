import { z } from 'zod';

export const ExploreVerifyVerdictSchema = z.enum(['ok', 'fail', 'goal_reached']);

export const ExploreVerifyOutputSchema = z.object({
  verdict: ExploreVerifyVerdictSchema,
  rationale: z.string().min(1),
});

export type ExploreVerifyOutput = z.infer<typeof ExploreVerifyOutputSchema>;

export const EXPLORE_VERIFY_PROMPT_VERSION = 'explore-verify-v5';
