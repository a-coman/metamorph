export abstract class LlmJobPublisherPort {
  abstract publishExploreJob(input: {
    jobId: string;
    sessionId: string;
    pageSnapshotId: string;
    url: string;
    transformFamily: string;
  }): Promise<void>;
}
