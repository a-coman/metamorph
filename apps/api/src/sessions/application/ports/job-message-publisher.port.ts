export type DiscoverJobMessagePayload = {
  jobId: string;
  sessionId: string;
  url: string;
};

export abstract class JobMessagePublisherPort {
  abstract publishDiscoverJob(
    payload: DiscoverJobMessagePayload,
  ): Promise<void>;
}
