import type { SlotStep } from '@metamorph/core';

export type PublishedProbeFailureContext = {
  failed_step: SlotStep;
  failed_step_index: number;
  failed_batch_index?: number;
  failed_batch_size?: number;
  url_before_failure: string;
  screenshot_before_snapshot_id: string;
};

export abstract class ExploreResumePublisherPort {
  abstract publishExploreResume(input: {
    exploreJobId: string;
    sessionId: string;
    probeJobId: string;
    snapshotId: string | null;
    probeStatus: 'ok' | 'failed';
    error?: string;
    failureContext?: PublishedProbeFailureContext;
  }): Promise<void>;
}
