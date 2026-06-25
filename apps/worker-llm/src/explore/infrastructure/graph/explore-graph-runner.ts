import { Command } from '@langchain/langgraph';
import type { TransformFamily } from '@metamorph/core';
import { PostgresSaver } from '@langchain/langgraph-checkpoint-postgres';
import pg from 'pg';
import { DEFAULT_EXPLORE_STATE, type ProbeResumeValue } from '../graph/explore-state.js';
import { EMPTY_BATCH_LOG } from '../graph/batch-log.js';
import { buildExploreGraph, type ExploreGraphDeps } from '../graph/explore-graph.js';
import {
  interpretExploreGraphOutcome,
  type GraphStateSnapshot,
} from './explore-graph-outcome.js';

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
    transformFamily: TransformFamily;
  }): Promise<{ status: 'completed' | 'interrupted' | 'failed' | 'paused'; mrVersionId?: string; reason?: string }> {
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
      transformFamily: input.transformFamily,
      mrVersionId: '',
      initialSnapshotId: input.pageSnapshotId,
      currentSnapshotId: input.pageSnapshotId,
      checkpointSequence: 0,
      batchLog: EMPTY_BATCH_LOG,
      lastExecutedSteps: [],
      smokeGatePassed: false,
      awaitingSmokeReplay: false,
      smokeRecoveryAttempts: 0,
      maxSmokeRecoveryAttempts: 2,
      anchorRecoveryAttempts: 0,
      maxAnchorRecoveryAttempts: 2,
    };

    const result = (await graph.invoke(initialState, config)) as Record<string, unknown>;
    return this.interpretResult(result, config);
  }

  async resume(
    exploreJobId: string,
    resumeValue: ProbeResumeValue,
  ): Promise<{ status: 'completed' | 'interrupted' | 'failed' | 'paused'; mrVersionId?: string; reason?: string }> {
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

  async resumeFromUserPause(
    exploreJobId: string,
  ): Promise<{ status: 'completed' | 'interrupted' | 'failed' | 'paused'; mrVersionId?: string; reason?: string }> {
    if (!this.compiled) {
      await this.setup();
    }

    const graph = this.compiled!;
    const config = this.threadConfig(exploreJobId);

    const result = (await graph.invoke(null, config)) as Record<string, unknown>;
    return this.interpretResult(result, config, exploreJobId);
  }

  private async interpretResult(
    result: Record<string, unknown>,
    config: { configurable: { thread_id: string } },
    _exploreJobId?: string,
  ): Promise<{
    status: 'completed' | 'interrupted' | 'failed' | 'paused';
    mrVersionId?: string;
    reason?: string;
  }> {
    const graph = this.compiled!;
    const snapshot = (await graph.getState(config)) as GraphStateSnapshot;
    return interpretExploreGraphOutcome(result, snapshot);
  }
}
