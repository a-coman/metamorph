import { z } from 'zod';

export const playwrightDiscoverJobMessageSchema = z.object({
  job_id: z.uuid(),
  session_id: z.uuid(),
  type: z.literal('discover'),
  mr_version_id: z.null(),
  payload: z.object({
    url: z.url(),
  }),
});

export type PlaywrightDiscoverJobMessage = z.infer<
  typeof playwrightDiscoverJobMessageSchema
>;
