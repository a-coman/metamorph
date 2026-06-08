export type DiscoverJobMessagePayload = {
  jobId: string;
  sessionId: string;
  url: string;
};

export type ExecutePairJobMessagePayload = {
  jobId: string;
  sessionId: string;
  mrVersionId: string;
  runId: string;
  url: string;
};

export abstract class JobMessagePublisherPort {
  abstract publishDiscoverJob(
    payload: DiscoverJobMessagePayload,
  ): Promise<void>;

  abstract publishExecutePairJob(
    payload: ExecutePairJobMessagePayload,
  ): Promise<void>;
}
