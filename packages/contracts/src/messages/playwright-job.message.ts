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

export const playwrightExecutePairJobMessageSchema = z.object({
  job_id: z.uuid(),
  session_id: z.uuid(),
  type: z.literal('execute_pair'),
  mr_version_id: z.uuid(),
  payload: z.object({
    url: z.url(),
    run_id: z.uuid(),
  }),
});

export {
  playwrightProbeJobMessageSchema,
  type PlaywrightProbeJobMessage,
} from './playwright-probe-job.message.js';

import { playwrightProbeJobMessageSchema } from './playwright-probe-job.message.js';

export const playwrightJobMessageSchema = z.discriminatedUnion('type', [
  playwrightDiscoverJobMessageSchema,
  playwrightExecutePairJobMessageSchema,
  playwrightProbeJobMessageSchema,
]);

export type PlaywrightDiscoverJobMessage = z.infer<
  typeof playwrightDiscoverJobMessageSchema
>;

export type PlaywrightExecutePairJobMessage = z.infer<
  typeof playwrightExecutePairJobMessageSchema
>;

export type PlaywrightJobMessage = z.infer<typeof playwrightJobMessageSchema>;
