import { Annotation, END, START, StateGraph, interrupt } from '@langchain/langgraph';
import {
  compilePlaybook,
  extractHostFromUrl,
  parseObservationCatalogFields,
  resolveStepTargets,
  validateInventoryElementIds,
  type MrIntent,
  type SlotStep,
} from '@metamorph/core';
import { S3ArtifactReaderAdapter } from '../../../shared/infrastructure/minio/s3-artifact-reader.adapter.js';
import { ProbeJobPublisher } from '../messaging/probe-job.publisher.js';
import { ExploreOpenRouterClient } from '../openrouter/explore-openrouter.client.js';
import { logExploreGraphEvent } from '../openrouter/explore-llm-logger.js';
import { ExplorationPrismaRepository } from '../persistence/exploration-prisma.repository.js';
import { ExploreSnapshotRepository } from '../persistence/explore-snapshot.repository.js';
import {
  buildGenerationSlots,
  type ExploreGraphState,
  type ExploreSourceReference,
  type ProbeResumeValue,
} from './explore-state.js';

export type ExploreGraphDeps = {
  explorationRepo: ExplorationPrismaRepository;
  snapshotRepo: ExploreSnapshotRepository;
  openRouter: ExploreOpenRouterClient;
  probePublisher: ProbeJobPublisher;
  artifactReader: S3ArtifactReaderAdapter;
};

const ExploreAnnotation = Annotation.Root({
  sessionId: Annotation<string>,
  sessionUrl: Annotation<string>,
  mrVersionId: Annotation<string>,
  exploreJobId: Annotation<string>,
  phase: Annotation<ExploreGraphState['phase']>,
  initialSnapshotId: Annotation<string>,
  sourceEndSnapshotId: Annotation<string | undefined>,
  currentSnapshotId: Annotation<string>,
  validatedSteps: Annotation<ExploreGraphState['validatedSteps']>,
  pendingProbeSteps: Annotation<SlotStep[]>,
  lastExecutedSteps: Annotation<SlotStep[]>,
  pendingProbeJobId: Annotation<string | undefined>,
  iteration: Annotation<number>,
  maxIterations: Annotation<number>,
  recoveryAttempts: Annotation<number>,
  maxRecoveryAttempts: Annotation<number>,
  planRecoveryAttempts: Annotation<number>,
  maxPlanRecoveryAttempts: Annotation<number>,
  checkpointRecoveryAttempts: Annotation<number>,
  mrDefinition: Annotation<ExploreGraphState['mrDefinition']>,
  explorationGoals: Annotation<ExploreGraphState['explorationGoals']>,
  probeError: Annotation<string | undefined>,
  probeStatus: Annotation<'ok' | 'failed' | undefined>,
  lastVerdict: Annotation<'ok' | 'fail' | 'goal_reached' | undefined>,
  failed: Annotation<boolean | undefined>,
  failureReason: Annotation<string | undefined>,
  checkpointSequence: Annotation<number>,
  snapshotBeforeId: Annotation<string | undefined>,
});

type State = typeof ExploreAnnotation.State;

async function resolveSourceReference(
  state: State,
  deps: ExploreGraphDeps,
): Promise<ExploreSourceReference | undefined> {
  if (state.phase !== 'follow_up' || state.validatedSteps.source.length === 0) {
    return undefined;
  }

  let endUrl: string | undefined;
  if (state.sourceEndSnapshotId) {
    const sourceEnd = await deps.snapshotRepo.findById(state.sourceEndSnapshotId);
    endUrl = sourceEnd?.url;
  }

  return {
    steps: state.validatedSteps.source,
    endUrl,
  };
}

function buildAbortProbeError(phase: ExploreGraphState['phase'], rationale: string): string {
  if (phase === 'follow_up') {
    return [
      `Plan aborted: ${rationale}`,
      'Re-plan: follow_up is an independent scenario from the homepage.',
      'Use validated source steps to reach the same filtered results state, then repeat the filter action once.',
      'Do not abort only because follow_up validated path is empty at the start.',
    ].join(' ');
  }

  return `Plan aborted: ${rationale}`;
}

function buildEmptyPathBacktrackHint(
  phase: ExploreGraphState['phase'],
  probeError?: string,
): string {
  const base =
    phase === 'follow_up'
      ? 'Checkpoint failed with no validated follow_up progress. Rebuild from homepage using validated source steps as reference, then repeat the filter action.'
      : 'Checkpoint failed with no validated progress. Try a different element or navigation path toward the phase goal.';

  return probeError ? `${probeError} ${base}` : base;
}

export function buildExploreGraph(deps: ExploreGraphDeps) {
  let checkpointSequence = 0;

  async function loadAnnotatedBase64(snapshotId: string): Promise<string> {
    const path = await deps.snapshotRepo.loadAnnotatedScreenshot(snapshotId);
    const buffer = await deps.artifactReader.get(path);
    return buffer.toString('base64');
  }

  async function loadRawBase64(snapshotId: string): Promise<string> {
    const path = await deps.snapshotRepo.loadRawScreenshot(snapshotId);
    const buffer = await deps.artifactReader.get(path);
    return buffer.toString('base64');
  }

  function buildMrIntent(state: State): MrIntent | undefined {
    if (!state.mrDefinition || !state.explorationGoals) {
      return undefined;
    }

    return {
      mr_definition: state.mrDefinition,
      exploration: state.explorationGoals,
    };
  }

  async function initNode(state: State): Promise<Partial<State>> {
    if (state.mrVersionId) {
      return {};
    }

    const snapshot = await deps.snapshotRepo.findById(state.initialSnapshotId);
    if (!snapshot) {
      return { failed: true, failureReason: 'Initial snapshot not found' };
    }

    const { mrVersionId } = await deps.explorationRepo.initExploration({
      sessionId: state.sessionId,
      pageSnapshotId: state.initialSnapshotId,
      host: extractHostFromUrl(snapshot.url),
      exploreJobId: state.exploreJobId,
    });

    return {
      mrVersionId,
      currentSnapshotId: state.initialSnapshotId,
      checkpointSequence: 0,
    };
  }

  async function mrPlanNode(state: State): Promise<Partial<State>> {
    if (state.failed) {
      return {};
    }

    if (state.mrDefinition && state.explorationGoals) {
      return {};
    }

    const snapshot = await deps.snapshotRepo.findById(state.initialSnapshotId);
    if (!snapshot) {
      return { failed: true, failureReason: 'Initial snapshot not found' };
    }

    try {
      const screenshotBase64 = await loadRawBase64(state.initialSnapshotId);
      const planResult = await deps.openRouter.mrPlan({
        url: state.sessionUrl,
        inventory: snapshot.inventory,
        screenshotBase64,
      });

      await deps.explorationRepo.recordLlmCall({
        exploreJobId: state.exploreJobId,
        mrVersionId: state.mrVersionId,
        audit: planResult.audit,
      });

      logExploreGraphEvent('mr_plan complete');

      return {
        mrDefinition: planResult.output.mr_definition,
        explorationGoals: planResult.output.exploration,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'mr_plan LLM error';
      return { failed: true, failureReason: message };
    }
  }

  async function planNextNode(state: State): Promise<Partial<State>> {
    if (state.failed) {
      return {};
    }

    if (state.planRecoveryAttempts >= state.maxPlanRecoveryAttempts) {
      return {
        failed: true,
        failureReason:
          state.probeError ??
          `Max plan recovery attempts (${state.maxPlanRecoveryAttempts}) exceeded`,
      };
    }

    const nextIteration = state.iteration + 1;
    if (nextIteration > state.maxIterations) {
      return {
        failed: true,
        failureReason: `Max iterations (${state.maxIterations}) exceeded`,
      };
    }

    const mrIntent = buildMrIntent(state);
    if (!mrIntent) {
      return { failed: true, failureReason: 'MR intent missing — mr_plan did not run' };
    }

    const snapshot = await deps.snapshotRepo.findById(state.currentSnapshotId);
    if (!snapshot) {
      return { failed: true, failureReason: 'Current snapshot not found' };
    }

    const screenshotBase64 = await loadAnnotatedBase64(state.currentSnapshotId);
    const sourceReference = await resolveSourceReference(state, deps);

    try {
      const planResult = await deps.openRouter.planNext({
        url: state.sessionUrl,
        phase: state.phase,
        mrIntent,
        inventory: snapshot.inventory,
        validatedSteps: state.validatedSteps,
        sourceReference,
        screenshotBase64,
        probeError: state.probeError,
      });

      await deps.explorationRepo.recordLlmCall({
        exploreJobId: state.exploreJobId,
        mrVersionId: state.mrVersionId,
        audit: planResult.audit,
      });

      if (planResult.output.action === 'abort') {
        const abortMessage = planResult.output.rationale;

        return {
          iteration: nextIteration,
          probeError: buildAbortProbeError(state.phase, abortMessage),
          planRecoveryAttempts: state.planRecoveryAttempts + 1,
        };
      }

      if (planResult.output.action === 'scenario_complete') {
        logExploreGraphEvent(
          `iter=${nextIteration} phase=${state.phase} plan→scenario_complete (no probe)`,
        );
        return {
          iteration: nextIteration,
          lastVerdict: 'goal_reached',
          probeError: undefined,
          checkpointRecoveryAttempts: 0,
        };
      }

      const steps = planResult.output.steps ?? [];
      const observationFields = parseObservationCatalogFields(
        state.mrDefinition!.relation.on,
      );
      const missingIds = validateInventoryElementIds(
        {
          source: { steps: state.phase === 'source' ? steps : [] },
          follow_up: { steps: state.phase === 'follow_up' ? steps : [] },
          observation: { fields: observationFields },
        },
        snapshot.inventory,
      );

      if (missingIds.length > 0) {
        return {
          iteration: nextIteration,
          probeError: `Unknown element_ids: ${missingIds.join(', ')}`,
          planRecoveryAttempts: state.planRecoveryAttempts + 1,
        };
      }

      if (steps.length === 0) {
        return {
          iteration: nextIteration,
          probeError: 'Plan returned append_steps with no executable steps',
          planRecoveryAttempts: state.planRecoveryAttempts + 1,
        };
      }

      const pendingProbeSteps = resolveStepTargets(steps, snapshot.inventory);
      logExploreGraphEvent(
        `iter=${nextIteration} phase=${state.phase} plan→probe | prefix=${state.validatedSteps[state.phase].length} batch=${pendingProbeSteps.length}`,
      );

      return {
        pendingProbeSteps,
        iteration: nextIteration,
        probeError: undefined,
        planRecoveryAttempts: 0,
        snapshotBeforeId: state.currentSnapshotId,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'plan_next LLM error';
      return {
        iteration: nextIteration,
        probeError: message,
        planRecoveryAttempts: state.planRecoveryAttempts + 1,
      };
    }
  }

  // Publishes the probe job. Kept free of `interrupt()` so it is NOT
  // re-executed on resume (LangGraph re-runs only the node that interrupts).
  // The published job id is persisted in state to stay idempotent.
  async function dispatchProbeNode(state: State): Promise<Partial<State>> {
    if (state.failed) {
      return {};
    }

    if (state.lastVerdict === 'goal_reached' || state.pendingProbeSteps.length === 0) {
      return {};
    }

    if (state.pendingProbeJobId) {
      return {};
    }

    const probeJobId = await deps.probePublisher.publish({
      sessionId: state.sessionId,
      mrVersionId: state.mrVersionId,
      exploreJobId: state.exploreJobId,
      phase: state.phase,
      inventorySnapshotId: state.currentSnapshotId,
      validatedPrefix: state.validatedSteps[state.phase],
      probeSteps: state.pendingProbeSteps,
      resumeUrl: state.sessionUrl,
    });

    logExploreGraphEvent(
      `iter=${state.iteration} phase=${state.phase} probe queued job=${probeJobId.slice(0, 8)}`,
    );

    return { pendingProbeJobId: probeJobId };
  }

  // Interrupt-only node: no side effects before `interrupt()`, so re-execution
  // on resume is safe and never republishes a probe.
  async function awaitProbeNode(state: State): Promise<Partial<State>> {
    if (state.failed) {
      return {};
    }

    if (state.lastVerdict === 'goal_reached' || state.pendingProbeSteps.length === 0) {
      return {};
    }

    const resumeValue = interrupt({ probeJobId: state.pendingProbeJobId }) as ProbeResumeValue;
    const executedSteps = state.pendingProbeSteps;

    logExploreGraphEvent(
      `iter=${state.iteration} phase=${state.phase} probe ${resumeValue.probe_status}${resumeValue.snapshot_id ? ` snapshot=${resumeValue.snapshot_id.slice(0, 8)}` : ''}${resumeValue.error ? ` err=${resumeValue.error.slice(0, 60)}` : ''}`,
    );

    return {
      pendingProbeJobId: undefined,
      pendingProbeSteps: [],
      lastExecutedSteps: executedSteps,
      probeStatus: resumeValue.probe_status,
      probeError: resumeValue.error,
      currentSnapshotId: resumeValue.snapshot_id ?? state.currentSnapshotId,
    };
  }

  async function assessCheckpointNode(state: State): Promise<Partial<State>> {
    if (state.failed || state.lastVerdict === 'goal_reached') {
      return {};
    }

    if (state.probeStatus === 'failed') {
      logExploreGraphEvent(
        `iter=${state.iteration} phase=${state.phase} verify skipped (probe failed)`,
      );
      return {
        lastVerdict: 'fail',
        checkpointRecoveryAttempts: state.checkpointRecoveryAttempts + 1,
      };
    }

    const beforeId = state.snapshotBeforeId ?? state.currentSnapshotId;
    const afterId = state.currentSnapshotId;

    const mrIntent = buildMrIntent(state);
    if (!mrIntent) {
      return {
        lastVerdict: 'fail',
        checkpointRecoveryAttempts: state.checkpointRecoveryAttempts + 1,
        probeError: 'MR intent missing for verification',
      };
    }

    const after = await deps.snapshotRepo.findById(afterId);
    if (!after) {
      return {
        lastVerdict: 'fail',
        checkpointRecoveryAttempts: state.checkpointRecoveryAttempts + 1,
        probeError: 'Missing after snapshot for verification',
      };
    }

    const [screenshotBefore, screenshotAfter] = await Promise.all([
      loadAnnotatedBase64(beforeId),
      loadAnnotatedBase64(afterId),
    ]);

    const sourceReference = await resolveSourceReference(state, deps);

    logExploreGraphEvent(
      `iter=${state.iteration} phase=${state.phase} verify→llm (before=${beforeId.slice(0, 8)} after=${afterId.slice(0, 8)})`,
    );

    let verifyResult: Awaited<ReturnType<ExploreOpenRouterClient['verifyCheckpoint']>>;
    try {
      verifyResult = await deps.openRouter.verifyCheckpoint({
        url: state.sessionUrl,
        urlAfter: after.url,
        phase: state.phase,
        mrIntent,
        validatedSteps: state.validatedSteps,
        sourceReference,
        executedSteps: state.lastExecutedSteps,
        screenshotBeforeBase64: screenshotBefore,
        screenshotAfterBase64: screenshotAfter,
        probeError: state.probeError,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'verify LLM error';
      logExploreGraphEvent(
        `iter=${state.iteration} phase=${state.phase} verify→error ${message.slice(0, 120)}`,
      );
      return {
        lastVerdict: 'fail',
        checkpointRecoveryAttempts: state.checkpointRecoveryAttempts + 1,
        probeError: `Checkpoint verification failed: ${message}`,
      };
    }

    await deps.explorationRepo.recordLlmCall({
      exploreJobId: state.exploreJobId,
      mrVersionId: state.mrVersionId,
      audit: verifyResult.audit,
    });

    checkpointSequence += 1;
    await deps.explorationRepo.saveCheckpoint({
      mrVersionId: state.mrVersionId,
      phase: state.phase,
      sequence: state.checkpointSequence + 1,
      snapshotId: afterId,
      stepsJson: state.lastExecutedSteps,
      verdict: verifyResult.output.verdict,
      rationale: verifyResult.output.rationale,
    });

    logExploreGraphEvent(
      `iter=${state.iteration} phase=${state.phase} verify→${verifyResult.output.verdict} checkpoint=${state.checkpointSequence + 1}`,
    );

    return {
      lastVerdict: verifyResult.output.verdict,
      checkpointSequence: state.checkpointSequence + 1,
      probeError:
        verifyResult.output.verdict === 'fail'
          ? `Checkpoint failed: ${verifyResult.output.rationale}`
          : undefined,
    };
  }

  async function commitOrBacktrackNode(state: State): Promise<Partial<State>> {
    if (state.failed) {
      return {};
    }

    if (state.lastVerdict === 'goal_reached') {
      const phase = state.phase;
      let updatedPhaseSteps = [...state.validatedSteps[phase]];

      if (state.lastExecutedSteps.length > 0) {
        updatedPhaseSteps = [...updatedPhaseSteps, ...state.lastExecutedSteps];
      }

      const validatedSteps = {
        ...state.validatedSteps,
        [phase]: updatedPhaseSteps,
      };

      if (updatedPhaseSteps.length > state.validatedSteps[phase].length) {
        await deps.explorationRepo.updateGenerationSlots(
          state.mrVersionId,
          buildGenerationSlots({ ...state, validatedSteps }),
        );
      }

      logExploreGraphEvent(
        `iter=${state.iteration} phase=${state.phase} commit goal_reached | path=${updatedPhaseSteps.length} steps`,
      );

      return {
        validatedSteps,
        lastExecutedSteps: [],
        checkpointRecoveryAttempts: 0,
        recoveryAttempts: 0,
        planRecoveryAttempts: 0,
      };
    }

    if (state.recoveryAttempts >= state.maxRecoveryAttempts) {
      return {
        failed: true,
        failureReason:
          state.probeError ?? `Max checkpoint recovery attempts (${state.maxRecoveryAttempts}) exceeded`,
      };
    }

    if (state.checkpointRecoveryAttempts > 5) {
      return {
        failed: true,
        failureReason: 'Max recovery attempts exceeded for checkpoint',
      };
    }

    if (state.lastVerdict === 'ok') {
      const phase = state.phase;
      const updatedPhaseSteps = [
        ...state.validatedSteps[phase],
        ...state.lastExecutedSteps,
      ];

      const validatedSteps = {
        ...state.validatedSteps,
        [phase]: updatedPhaseSteps,
      };

      await deps.explorationRepo.updateGenerationSlots(
        state.mrVersionId,
        buildGenerationSlots({ ...state, validatedSteps }),
      );

      logExploreGraphEvent(
        `iter=${state.iteration} phase=${state.phase} commit ok | path=${updatedPhaseSteps.length} steps`,
      );

      return {
        validatedSteps,
        lastExecutedSteps: [],
        checkpointRecoveryAttempts: 0,
        recoveryAttempts: 0,
        planRecoveryAttempts: 0,
      };
    }

    if (state.lastVerdict === 'fail') {
      const phase = state.phase;
      const current = [...state.validatedSteps[phase]];
      const batchSize = Math.min(state.lastExecutedSteps.length || 3, current.length);
      if (batchSize > 0) {
        current.splice(-batchSize, batchSize);
      }

      const backtrackHint =
        current.length === 0
          ? buildEmptyPathBacktrackHint(phase, state.probeError)
          : undefined;

      logExploreGraphEvent(
        `iter=${state.iteration} phase=${state.phase} commit fail → backtrack | path=${current.length} steps`,
      );

      return {
        validatedSteps: {
          ...state.validatedSteps,
          [phase]: current,
        },
        lastExecutedSteps: [],
        recoveryAttempts: state.recoveryAttempts + 1,
        ...(backtrackHint ? { probeError: backtrackHint } : {}),
      };
    }

    return {};
  }

  async function switchPhaseNode(state: State): Promise<Partial<State>> {
    if (state.failed || state.lastVerdict !== 'goal_reached') {
      return {};
    }

    if (state.phase === 'follow_up') {
      return {};
    }

    const initialSnapshot = await deps.snapshotRepo.findById(state.initialSnapshotId);
    if (!initialSnapshot) {
      return { failed: true, failureReason: 'Initial snapshot missing for follow_up phase' };
    }

    logExploreGraphEvent(
      `phase source complete → follow_up | source_path=${state.validatedSteps.source.length} steps | source_end=${state.currentSnapshotId.slice(0, 8)}`,
    );

    return {
      phase: 'follow_up',
      sourceEndSnapshotId: state.currentSnapshotId,
      currentSnapshotId: state.initialSnapshotId,
      lastVerdict: undefined,
      checkpointRecoveryAttempts: 0,
      probeError: undefined,
    };
  }

  async function compileDraftNode(state: State): Promise<Partial<State>> {
    if (state.failed || !state.mrDefinition) {
      return {};
    }

    const snapshot = await deps.snapshotRepo.findById(state.initialSnapshotId);
    if (!snapshot) {
      return { failed: true, failureReason: 'Snapshot missing for compile' };
    }

    const generationSlots = buildGenerationSlots(state);

    const compiled = compilePlaybook(
      generationSlots,
      state.mrDefinition,
      snapshot.inventory,
      { sessionUrl: state.sessionUrl },
    );

    const mrDefinitionId = await deps.explorationRepo.findMrDefinitionId(state.mrVersionId);
    if (!mrDefinitionId) {
      return { failed: true, failureReason: 'MR definition not found' };
    }

    await deps.explorationRepo.saveDraft({
      mrVersionId: state.mrVersionId,
      mrDefinitionId,
      mrDefinition: state.mrDefinition,
      generationSlots,
      compiled,
      llmAudit: {
        purpose: 'compile_draft',
        model: process.env.OPENROUTER_MODEL ?? 'openai/gpt-4o',
        promptVersion: 'compile-v1',
        tokensIn: null,
        tokensOut: null,
        latencyMs: 0,
      },
      exploreJobId: state.exploreJobId,
    });

    return {};
  }

  async function failNode(state: State): Promise<Partial<State>> {
    if (state.failed && state.mrVersionId) {
      await deps.explorationRepo.markExplorationFailed(
        state.mrVersionId,
        state.failureReason ?? 'Exploration failed',
      );
    }

    return {};
  }

  function routeAfterPlan(state: State): string {
    if (state.failed) {
      return 'fail';
    }

    if (state.lastVerdict === 'goal_reached') {
      return state.phase === 'source' ? 'switch_phase' : 'compile_draft';
    }

    if (state.pendingProbeSteps.length > 0) {
      return 'dispatch_probe';
    }

    if (state.probeError && state.planRecoveryAttempts > 0) {
      return 'plan_next';
    }

    if (state.probeError) {
      return 'fail';
    }

    return 'plan_next';
  }

  function routeAfterCommit(state: State): string {
    if (state.failed) {
      return 'fail';
    }

    if (state.lastVerdict === 'goal_reached') {
      return state.phase === 'source' ? 'switch_phase' : 'compile_draft';
    }

    return 'plan_next';
  }

  function routeAfterMrPlan(state: State): string {
    if (state.failed) {
      return 'fail';
    }

    return 'plan_next';
  }

  function routeAfterSwitch(state: State): string {
    if (state.failed) {
      return 'fail';
    }

    return 'plan_next';
  }

  const graph = new StateGraph(ExploreAnnotation)
    .addNode('init', initNode)
    .addNode('mr_plan', mrPlanNode)
    .addNode('plan_next', planNextNode)
    .addNode('dispatch_probe', dispatchProbeNode)
    .addNode('await_probe', awaitProbeNode)
    .addNode('assess_checkpoint', assessCheckpointNode)
    .addNode('commit_or_backtrack', commitOrBacktrackNode)
    .addNode('switch_phase', switchPhaseNode)
    .addNode('compile_draft', compileDraftNode)
    .addNode('fail', failNode)
    .addEdge(START, 'init')
    .addEdge('init', 'mr_plan')
    .addConditionalEdges('mr_plan', routeAfterMrPlan, {
      plan_next: 'plan_next',
      fail: 'fail',
    })
    .addConditionalEdges('plan_next', routeAfterPlan, {
      dispatch_probe: 'dispatch_probe',
      switch_phase: 'switch_phase',
      compile_draft: 'compile_draft',
      plan_next: 'plan_next',
      fail: 'fail',
    })
    .addEdge('dispatch_probe', 'await_probe')
    .addEdge('await_probe', 'assess_checkpoint')
    .addEdge('assess_checkpoint', 'commit_or_backtrack')
    .addConditionalEdges('commit_or_backtrack', routeAfterCommit, {
      plan_next: 'plan_next',
      switch_phase: 'switch_phase',
      compile_draft: 'compile_draft',
      fail: 'fail',
    })
    .addConditionalEdges('switch_phase', routeAfterSwitch, {
      plan_next: 'plan_next',
      fail: 'fail',
    })
    .addEdge('compile_draft', END)
    .addEdge('fail', END);

  return graph;
}

export type ExploreCompiledGraph = ReturnType<typeof buildExploreGraph>['compile'];
