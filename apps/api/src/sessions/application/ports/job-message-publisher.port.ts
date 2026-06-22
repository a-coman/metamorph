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

export type ProbeJobMessagePayload = {
  jobId: string;
  sessionId: string;
  mrVersionId: string;
  payload: Record<string, unknown>;
};

export type ExploreUserResumeMessagePayload = {
  jobId: string;
  sessionId: string;
  exploreJobId: string;
};

export type ExploreJobMessagePayload = {
  jobId: string;
  sessionId: string;
  pageSnapshotId: string;
  url: string;
};

export abstract class JobMessagePublisherPort {
  abstract publishDiscoverJob(
    payload: DiscoverJobMessagePayload,
  ): Promise<void>;

  abstract publishExecutePairJob(
    payload: ExecutePairJobMessagePayload,
  ): Promise<void>;

  abstract publishProbeJob(payload: ProbeJobMessagePayload): Promise<void>;

  abstract publishExploreUserResume(
    payload: ExploreUserResumeMessagePayload,
  ): Promise<void>;

  abstract publishExploreJob(payload: ExploreJobMessagePayload): Promise<void>;
}
