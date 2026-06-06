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

export type SessionDetailsDto = {
  id: string;
  url: string;
  mode: string;
  generateCount: number;
  weakOracle: boolean;
  createdAt: Date;
  updatedAt: Date;
  jobs: SessionJobSummaryDto[];
  pageSnapshots: SessionSnapshotSummaryDto[];
};
