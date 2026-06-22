export type SessionJobSummaryDto = {
  id: string;
  type: string;
  status: string;
  createdAt: Date;
  startedAt: Date | null;
  finishedAt: Date | null;
  errorMessage: string | null;
};

export type SessionSnapshotSummaryDto = {
  id: string;
  url: string;
  createdAt: Date;
  labeledCount: number;
};

export type SessionMrVersionSummaryDto = {
  id: string;
  status: string;
  transformFamily: string;
};

export type SessionDetailsDto = {
  id: string;
  url: string;
  mode: string;
  generateCount: number;
  weakOracle: boolean;
  controlStatus: string;
  createdAt: Date;
  updatedAt: Date;
  jobs: SessionJobSummaryDto[];
  pageSnapshots: SessionSnapshotSummaryDto[];
  mrVersions: SessionMrVersionSummaryDto[];
};

export type SessionListItemDto = {
  id: string;
  url: string;
  mode: string;
  status: string;
  createdAt: Date;
  mrVersionStatus?: string;
};

export type SessionListDto = {
  items: SessionListItemDto[];
  nextCursor?: string;
};

export type CreateSessionResultDto = {
  sessionId: string;
  jobId: string;
  status: string;
};

export type QueueDiscoverResultDto = {
  jobId: string;
  status: string;
};

export type PauseSessionResultDto = {
  controlStatus: string;
};

export type ResumeSessionResultDto = {
  controlStatus: string;
  jobId: string;
  jobType: string;
};
