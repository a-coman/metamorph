export type SessionMode = 'hitl' | 'auto';

export type SessionControlStatus = 'active' | 'pausing' | 'paused';

export type MrVersionStatus =
  | 'exploring'
  | 'exploration_failed'
  | 'draft_pending_hitl'
  | 'approved'
  | 'replayable'
  | 'stale'
  | 'violation_pending_triage';

export type ExecutePairJobMessagePayload = {
  jobId: string;
  sessionId: string;
  mrVersionId: string;
  runId: string;
  url: string;
};

export type MrPromotionPrismaClient = {
  session: {
    findUnique(args: {
      where: { id: string };
      select: { mode: true; controlStatus: true };
    }): Promise<{ mode: SessionMode; controlStatus: SessionControlStatus } | null>;
  };
  mrVersion: {
    findUnique(
      args: Record<string, unknown>,
    ): Promise<{
      id: string;
      sessionId: string;
      status: MrVersionStatus;
      playbookBlobId: string | null;
      session?: { mode: SessionMode; controlStatus: SessionControlStatus; url: string };
      playbookBlob?: { contentHash: string } | null;
    } | null>;
    update(args: {
      where: { id: string };
      data: {
        status?: MrVersionStatus;
        approvedAt?: Date;
      };
    }): Promise<{ id: string; status: MrVersionStatus; approvedAt: Date | null }>;
  };
  playbookBlob: {
    update(args: {
      where: { id: string };
      data: { content: string; contentHash: string };
    }): Promise<unknown>;
  };
  job: {
    create(args: {
      data: {
        sessionId: string;
        mrVersionId: string;
        type: string;
        status: string;
        payload: Record<string, unknown>;
      };
    }): Promise<{ id: string }>;
    update(args: {
      where: { id: string };
      data: {
        status?: string;
        payload?: Record<string, unknown>;
        errorMessage?: string | null;
      };
    }): Promise<unknown>;
  };
  run: {
    create(args: {
      data: {
        mrVersionId: string;
        jobId: string;
        status: string;
        playbookContentHash?: string;
      };
    }): Promise<{ id: string }>;
  };
  $transaction<T>(fn: (tx: MrPromotionPrismaClient) => Promise<T>): Promise<T>;
};

export type MrPromotionDeps = {
  prisma: MrPromotionPrismaClient;
  publishExecutePairJob: (payload: ExecutePairJobMessagePayload) => Promise<void>;
};
