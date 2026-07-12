export type FieldEvaluationDetailDto = {
  source: unknown;
  followUp: unknown;
  ok: boolean;
  compare: string;
  error?: string;
};

export type RunInputBundleDto = {
  evaluation_details?: Record<string, FieldEvaluationDetailDto>;
  error?: string;
};

export type RunSummaryDto = {
  id: string;
  status: string;
  verdictStrict: string | null;
  attempt: number;
  createdAt: Date;
  finishedAt: Date | null;
};

export type RunDetailsDto = {
  id: string;
  mrVersionId: string;
  jobId: string;
  status: string;
  verdictStrict: string | null;
  attempt: number;
  sourceFinalUrl: string | null;
  followUpFinalUrl: string | null;
  playbookContentHash: string | null;
  replayBundleHash: string | null;
  inputBundle: RunInputBundleDto;
  createdAt: Date;
  finishedAt: Date | null;
  observations: Array<{
    id: string;
    role: string;
    payload: unknown;
    payloadHash: string;
    createdAt: Date;
  }>;
  artifacts: Array<{
    id: string;
    kind: string;
    path: string;
    mimeType: string | null;
    sizeBytes: number | null;
    createdAt: Date;
  }>;
  violations: Array<{
    id: string;
    verdictStrict: string;
    createdAt: Date;
  }>;
};

export type ExecuteMrVersionResultDto = {
  jobId: string;
  runId: string;
  status: string;
};

export type ApproveMrVersionResultDto = {
  id: string;
  status: string;
  approvedAt: Date;
};
