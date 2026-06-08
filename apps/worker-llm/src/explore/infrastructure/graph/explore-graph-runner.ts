import { Command } from '@langchain/langgraph';
import { PostgresSaver } from '@langchain/langgraph-checkpoint-postgres';
import pg from 'pg';
import { DEFAULT_EXPLORE_STATE, type ProbeResumeValue } from '../graph/explore-state.js';
import { buildExploreGraph, type ExploreGraphDeps } from '../graph/explore-graph.js';

export class ExploreGraphRunner {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private compiled: any = null;
  private checkpointer: PostgresSaver | null = null;

  constructor(private readonly deps: ExploreGraphDeps) {}

  async setup(): Promise<void> {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error('DATABASE_URL is required for LangGraph checkpointer');
    }

    const pool = new pg.Pool({ connectionString: databaseUrl });
    this.checkpointer = new PostgresSaver(pool);
    await this.checkpointer.setup();

    const graph = buildExploreGraph(this.deps);
    this.compiled = graph.compile({ checkpointer: this.checkpointer });
  }

  private threadConfig(exploreJobId: string) {
    return { configurable: { thread_id: exploreJobId } };
  }

  async start(input: {
    exploreJobId: string;
    sessionId: string;
    sessionUrl: string;
    pageSnapshotId: string;
  }): Promise<{ status: 'completed' | 'interrupted' | 'failed'; mrVersionId?: string; reason?: string }> {
    if (!this.compiled) {
      await this.setup();
    }

    const graph = this.compiled!;
    const config = this.threadConfig(input.exploreJobId);

    const initialState = {
      ...DEFAULT_EXPLORE_STATE,
      sessionId: input.sessionId,
      sessionUrl: input.sessionUrl,
      exploreJobId: input.exploreJobId,
      mrVersionId: '',
      initialSnapshotId: input.pageSnapshotId,
      currentSnapshotId: input.pageSnapshotId,
      checkpointSequence: 0,
      lastExecutedSteps: [],
    };

    const result = (await graph.invoke(initialState, config)) as Record<string, unknown>;
    return this.interpretResult(result, config);
  }

  async resume(
    exploreJobId: string,
    resumeValue: ProbeResumeValue,
  ): Promise<{ status: 'completed' | 'interrupted' | 'failed'; mrVersionId?: string; reason?: string }> {
    if (!this.compiled) {
      await this.setup();
    }

    const graph = this.compiled!;
    const config = this.threadConfig(exploreJobId);

    const result = (await graph.invoke(
      new Command({ resume: resumeValue }),
      config,
    )) as Record<string, unknown>;

    return this.interpretResult(result, config);
  }

  private async interpretResult(
    result: Record<string, unknown>,
    config: { configurable: { thread_id: string } },
  ): Promise<{
    status: 'completed' | 'interrupted' | 'failed';
    mrVersionId?: string;
    reason?: string;
  }> {
    const mrVersionId = result.mrVersionId as string | undefined;
    const failed = result.failed as boolean | undefined;
    const failureReason = result.failureReason as string | undefined;

    if (failed) {
      return { status: 'failed', mrVersionId, reason: failureReason };
    }

    const graph = this.compiled!;
    const snapshot = await graph.getState(config);
    if (snapshot.next.length > 0) {
      return { status: 'interrupted', mrVersionId };
    }

    return { status: 'completed', mrVersionId };
  }
}
