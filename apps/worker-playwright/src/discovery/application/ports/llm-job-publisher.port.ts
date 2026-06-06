export abstract class LlmJobPublisherPort {
  abstract publishDiscoverLlmJob(input: {
    jobId: string;
    sessionId: string;
    pageSnapshotId: string;
    url: string;
  }): Promise<void>;
}
