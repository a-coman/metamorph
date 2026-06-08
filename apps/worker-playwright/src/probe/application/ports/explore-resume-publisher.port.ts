export abstract class ExploreResumePublisherPort {
  abstract publishExploreResume(input: {
    exploreJobId: string;
    sessionId: string;
    probeJobId: string;
    snapshotId: string | null;
    probeStatus: 'ok' | 'failed';
    error?: string;
  }): Promise<void>;
}
