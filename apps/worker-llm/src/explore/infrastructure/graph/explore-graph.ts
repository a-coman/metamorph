import { Annotation, END, START, StateGraph, interrupt } from '@langchain/langgraph';
import {
  compilePlaybook,
  EXPLORE_VERIFY_PROMPT_VERSION,
  extractHostFromUrl,
  isFillableInventoryItem,
  MR_PLAN_PROMPT_VERSION,
  parseObservationCatalogFields,
  PLAN_EXPLORE_PROMPT_VERSION,
  resolveStepTargets,
  validateInventoryElementIds,
  type MrIntent,
  type SlotStep,
} from '@metamorph/core';
import { S3ArtifactReaderAdapter } from '../../../shared/infrastructure/minio/s3-artifact-reader.adapter.js';
import { ProbeJobPublisher } from '../messaging/probe-job.publisher.js';
import {
  ExploreOpenRouterClient,
  type ExploreLlmResult,
} from '../openrouter/explore-openrouter.client.js';
import {
  ExploreLlmValidationError,
  extractRejectedPlanSteps,
} from '../openrouter/explore-llm-validation.error.js';
import { logExploreGraphEvent } from '../openrouter/explore-llm-logger.js';
import { ExplorationPrismaRepository } from '../persistence/exploration-prisma.repository.js';
import { ExploreSnapshotRepository } from '../persistence/explore-snapshot.repository.js';
import {
  buildGenerationSlots,
  type ExploreGraphState,
  type ExploreSourceReference,
  type ProbeFailureContext,
  type ProbeResumeValue,
} from './explore-state.js';
import {
  appendBatchRecord,
  EMPTY_BATCH_LOG,
  finalizeLastPendingBatch,
  findLatestProbeFailureScreenshotId,
  formatBatchLogForPrompt,
} from './batch-log.js';

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
  batchLog: Annotation<ExploreGraphState['batchLog']>,
  pendingProbeSteps: Annotation<SlotStep[]>({
    reducer: (_, update) => update,
    default: () => [],
  }),
  lastExecutedSteps: Annotation<SlotStep[]>,
  pendingProbeJobId: Annotation<string | undefined>,
  lastPlanLlmCallId: Annotation<string | undefined>,
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
  probeFailureContext: Annotation<ProbeFailureContext | undefined>,
  probeStatus: Annotation<'ok' | 'failed' | undefined>,
  lastVerdict: Annotation<'ok' | 'fail' | 'goal_reached' | undefined>,
  failed: Annotation<boolean | undefined>,
  failureReason: Annotation<string | undefined>,
  checkpointSequence: Annotation<number>,
  snapshotBeforeId: Annotation<string | undefined>,
  smokeGatePassed: Annotation<boolean | undefined>,
  awaitingSmokeReplay: Annotation<boolean | undefined>,
  smokeRecoveryAttempts: Annotation<number>,
  maxSmokeRecoveryAttempts: Annotation<number>,
});

type State = typeof ExploreAnnotation.State;

async function runTrackedLlmCall<T>(
  deps: ExploreGraphDeps,
  state: Pick<State, 'exploreJobId' | 'mrVersionId'>,
  meta: {
    purpose: string;
    promptVersion: string;
    enrichResponse?: (output: T) => unknown;
    enrichFailureResponse?: (error: string) => unknown;
  },
  call: () => Promise<ExploreLlmResult<T>>,
): Promise<{ output: T; llmCallId: string }> {
  const llmCallId = await deps.explorationRepo.beginLlmCall({
    exploreJobId: state.exploreJobId,
    mrVersionId: state.mrVersionId,
    purpose: meta.purpose,
    model: deps.openRouter.getModel(),
    promptVersion: meta.promptVersion,
  });

  try {
    const result = await call();
    await deps.explorationRepo.completeLlmCall({
      id: llmCallId,
      audit: result.audit,
      responseJson: meta.enrichResponse
        ? meta.enrichResponse(result.output)
        : result.output,
    });
    return { output: result.output, llmCallId };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'LLM error';
    await deps.explorationRepo.failLlmCall({
      id: llmCallId,
      error: message,
      responseJson: meta.enrichFailureResponse?.(message),
    });
    throw error;
  }
}

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

function withPlanRejection(
  state: State,
  steps: SlotStep[],
  error: string,
  iteration: number,
  planLlmCallId?: string,
): Partial<State> {
  return {
    iteration,
    probeError: error,
    planRecoveryAttempts: state.planRecoveryAttempts + 1,
    pendingProbeSteps: [],
    ...(planLlmCallId ? { lastPlanLlmCallId: planLlmCallId } : {}),
    batchLog: appendBatchRecord(state.batchLog ?? EMPTY_BATCH_LOG, state.phase, {
      steps,
      outcome: 'plan_rejected',
      error,
    }),
  };
}

async function rejectPlan(
  deps: ExploreGraphDeps,
  state: State,
  steps: SlotStep[],
  error: string,
  iteration: number,
  planLlmCallId: string | undefined,
  planResponse: Record<string, unknown> | undefined,
): Promise<Partial<State>> {
  if (planLlmCallId && planResponse) {
    await deps.explorationRepo.patchLlmCallResponse({
      id: planLlmCallId,
      responseJson: {
        ...planResponse,
        action: 'plan_rejected',
        error,
      },
    });
  }

  return withPlanRejection(state, steps, error, iteration, planLlmCallId);
}

function afterAssessCheckpoint(update: Partial<State>): Partial<State> {
  return { ...update, pendingProbeSteps: [] };
}

function withBatchFinalized(
  state: State,
  outcome: 'committed' | 'checkpoint_failed' | 'probe_failed',
  details?: {
    error?: string;
    failedStep?: SlotStep;
    screenshotBeforeSnapshotId?: string;
  },
): ExploreGraphState['batchLog'] {
  return finalizeLastPendingBatch(state.batchLog ?? EMPTY_BATCH_LOG, state.phase, outcome, details);
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
      const { output: mrPlanOutput } = await runTrackedLlmCall(
        deps,
        state,
        { purpose: 'mr_plan', promptVersion: MR_PLAN_PROMPT_VERSION },
        () =>
          deps.openRouter.mrPlan({
            url: state.sessionUrl,
            screenshotBase64,
          }),
      );

      await deps.explorationRepo.saveExplorationGoals(
        state.mrVersionId,
        mrPlanOutput.exploration,
      );

      logExploreGraphEvent('mr_plan complete');

      return {
        mrDefinition: mrPlanOutput.mr_definition,
        explorationGoals: mrPlanOutput.exploration,
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
    const latestProbeScreenshotId =
      findLatestProbeFailureScreenshotId(state.batchLog ?? EMPTY_BATCH_LOG, state.phase) ??
      state.probeFailureContext?.screenshotBeforeSnapshotId;
    const failureScreenshotBase64 = latestProbeScreenshotId
      ? await loadRawBase64(latestProbeScreenshotId)
      : undefined;
    const { latestProbeFailureBatch } = formatBatchLogForPrompt(
      state.batchLog ?? EMPTY_BATCH_LOG,
      state.phase,
    );
    const sourceReference = await resolveSourceReference(state, deps);

    try {
      const { output: planOutput, llmCallId: planLlmCallId } = await runTrackedLlmCall(
        deps,
        state,
        {
          purpose: 'plan_explore',
          promptVersion: PLAN_EXPLORE_PROMPT_VERSION,
          enrichResponse: (output) => ({
            ...output,
            inventorySnapshotId: state.currentSnapshotId,
          }),
          enrichFailureResponse: (error) => ({
            error,
            inventorySnapshotId: state.currentSnapshotId,
          }),
        },
        () =>
          deps.openRouter.planNext({
            url: state.sessionUrl,
            phase: state.phase,
            mrIntent,
            inventory: snapshot.inventory,
            validatedSteps: state.validatedSteps,
            batchLog: state.batchLog ?? EMPTY_BATCH_LOG,
            sourceReference,
            screenshotBase64,
            failureScreenshotBase64,
            latestProbeFailureBatch: failureScreenshotBase64
              ? latestProbeFailureBatch
              : undefined,
          }),
      );

      if (planOutput.action === 'abort') {
        const abortMessage = planOutput.rationale;
        logExploreGraphEvent(
          `iter=${nextIteration} phase=${state.phase} plan→abort | ${abortMessage.slice(0, 120)}`,
        );

        return {
          iteration: nextIteration,
          failed: true,
          failureReason: `Plan aborted: ${abortMessage}`,
          lastPlanLlmCallId: planLlmCallId,
        };
      }

      if (planOutput.action === 'scenario_complete') {
        logExploreGraphEvent(
          `iter=${nextIteration} phase=${state.phase} plan→scenario_complete (no probe)`,
        );
        return {
          iteration: nextIteration,
          lastVerdict: 'goal_reached',
          probeError: undefined,
          probeFailureContext: undefined,
          checkpointRecoveryAttempts: 0,
          lastPlanLlmCallId: planLlmCallId,
        };
      }

      const steps = planOutput.steps ?? [];
      const planResponse = {
        ...planOutput,
        inventorySnapshotId: state.currentSnapshotId,
      };
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
        return rejectPlan(
          deps,
          state,
          steps,
          `Unknown element_ids: ${missingIds.join(', ')}`,
          nextIteration,
          planLlmCallId,
          planResponse,
        );
      }

      const itemMap = new Map(snapshot.inventory.items.map((item) => [item.shortId, item]));
      const nonFillableFill = steps.filter((step) => {
        if (step.action !== 'fill' || !step.element_id) {
          return false;
        }
        const item = itemMap.get(step.element_id);
        return item !== undefined && !isFillableInventoryItem(item);
      });
      if (nonFillableFill.length > 0) {
        const ids = nonFillableFill.map((s) => s.element_id).join(', ');
        return rejectPlan(
          deps,
          state,
          steps,
          `fill not allowed on ${ids} (not input/textarea/combobox). ` +
            'For travel/combobox UIs: batch 1 = click destination trigger + waitFor; batch 2 = fill the revealed input or pick a suggestion, then click search.',
          nextIteration,
          planLlmCallId,
          planResponse,
        );
      }

      if (steps.length === 0) {
        return rejectPlan(
          deps,
          state,
          steps,
          'Plan returned append_steps with no executable steps',
          nextIteration,
          planLlmCallId,
          planResponse,
        );
      }

      const pendingProbeSteps = resolveStepTargets(steps, snapshot.inventory);
      logExploreGraphEvent(
        `iter=${nextIteration} phase=${state.phase} plan→probe | prefix=${state.validatedSteps[state.phase].length} batch=${pendingProbeSteps.length}`,
      );

      return {
        pendingProbeSteps,
        iteration: nextIteration,
        probeError: undefined,
        probeFailureContext: undefined,
        planRecoveryAttempts: 0,
        lastPlanLlmCallId: planLlmCallId,
        snapshotBeforeId: state.currentSnapshotId,
        batchLog: appendBatchRecord(state.batchLog ?? EMPTY_BATCH_LOG, state.phase, {
          steps: pendingProbeSteps,
          outcome: 'pending',
        }),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'plan_next LLM error';
      const rejectedSteps =
        error instanceof ExploreLlmValidationError
          ? extractRejectedPlanSteps(error.normalizedOutput, error.rawOutput)
          : [];
      return withPlanRejection(state, rejectedSteps, message, nextIteration);
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

    const probeJobId = await deps.probePublisher.publishIncremental({
      sessionId: state.sessionId,
      mrVersionId: state.mrVersionId,
      exploreJobId: state.exploreJobId,
      phase: state.phase,
      inventorySnapshotId: state.currentSnapshotId,
      validatedPrefix: state.validatedSteps[state.phase],
      probeSteps: state.pendingProbeSteps,
      resumeUrl: state.sessionUrl,
      planLlmCallId: state.lastPlanLlmCallId,
      cycleIteration: state.iteration,
    });

    logExploreGraphEvent(
      `iter=${state.iteration} phase=${state.phase} probe queued job=${probeJobId.slice(0, 8)}`,
    );

    return { pendingProbeJobId: probeJobId };
  }

  // Interrupt-only node: no side effects before `interrupt()`, so re-execution
  // on resume is safe and never republishes a probe.
  async function awaitProbeNode(state: State): Promise<Partial<State>> {
    if (state.failed || !state.pendingProbeJobId) {
      return {};
    }

    const isSmoke = state.awaitingSmokeReplay === true;
    const skipIncremental =
      !isSmoke &&
      (state.lastVerdict === 'goal_reached' || state.pendingProbeSteps.length === 0);

    if (skipIncremental) {
      return {};
    }

    const resumeValue = interrupt({ probeJobId: state.pendingProbeJobId }) as ProbeResumeValue;

    if (isSmoke) {
      logExploreGraphEvent(
        `iter=${state.iteration} phase=${state.phase} smoke ${resumeValue.probe_status}${resumeValue.snapshot_id ? ` snapshot=${resumeValue.snapshot_id.slice(0, 8)}` : ''}${resumeValue.error ? ` err=${resumeValue.error.slice(0, 60)}` : ''}`,
      );

      return {
        probeStatus: resumeValue.probe_status,
        probeError: resumeValue.error,
        currentSnapshotId: resumeValue.snapshot_id ?? state.currentSnapshotId,
      };
    }

    const executedSteps = state.pendingProbeSteps;

    logExploreGraphEvent(
      `iter=${state.iteration} phase=${state.phase} probe ${resumeValue.probe_status}${resumeValue.snapshot_id ? ` snapshot=${resumeValue.snapshot_id.slice(0, 8)}` : ''}${resumeValue.error ? ` err=${resumeValue.error.slice(0, 60)}` : ''}`,
    );

    if (resumeValue.probe_status === 'failed') {
      return {
        pendingProbeJobId: undefined,
        lastExecutedSteps: executedSteps,
        probeStatus: resumeValue.probe_status,
        probeError: resumeValue.error,
        probeFailureContext: resumeValue.failureContext,
      };
    }

    return {
      pendingProbeJobId: undefined,
      lastExecutedSteps: executedSteps,
      probeStatus: resumeValue.probe_status,
      probeError: undefined,
      probeFailureContext: undefined,
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
      return afterAssessCheckpoint({
        lastVerdict: 'fail',
        checkpointRecoveryAttempts: state.checkpointRecoveryAttempts + 1,
      });
    }

    const beforeId = state.snapshotBeforeId ?? state.currentSnapshotId;
    const afterId = state.currentSnapshotId;

    const mrIntent = buildMrIntent(state);
    if (!mrIntent) {
      return afterAssessCheckpoint({
        lastVerdict: 'fail',
        checkpointRecoveryAttempts: state.checkpointRecoveryAttempts + 1,
        probeError: 'MR intent missing for verification',
      });
    }

    const after = await deps.snapshotRepo.findById(afterId);
    if (!after) {
      return afterAssessCheckpoint({
        lastVerdict: 'fail',
        checkpointRecoveryAttempts: state.checkpointRecoveryAttempts + 1,
        probeError: 'Missing after snapshot for verification',
      });
    }

    const [screenshotBefore, screenshotAfter] = await Promise.all([
      loadAnnotatedBase64(beforeId),
      loadAnnotatedBase64(afterId),
    ]);

    const sourceReference = await resolveSourceReference(state, deps);

    logExploreGraphEvent(
      `iter=${state.iteration} phase=${state.phase} verify→llm (before=${beforeId.slice(0, 8)} after=${afterId.slice(0, 8)})`,
    );

    let verifyResult: { output: Awaited<ReturnType<ExploreOpenRouterClient['verifyCheckpoint']>>['output']; llmCallId: string };
    try {
      verifyResult = await runTrackedLlmCall(
        deps,
        state,
        { purpose: 'explore_verify', promptVersion: EXPLORE_VERIFY_PROMPT_VERSION },
        () =>
          deps.openRouter.verifyCheckpoint({
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
          }),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'verify LLM error';
      logExploreGraphEvent(
        `iter=${state.iteration} phase=${state.phase} verify→error ${message.slice(0, 120)}`,
      );
      return afterAssessCheckpoint({
        lastVerdict: 'fail',
        checkpointRecoveryAttempts: state.checkpointRecoveryAttempts + 1,
        probeError: `Checkpoint verification failed: ${message}`,
      });
    }

    const llmCallId = verifyResult.llmCallId;

    checkpointSequence += 1;
    await deps.explorationRepo.saveCheckpoint({
      mrVersionId: state.mrVersionId,
      llmCallId,
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

    return afterAssessCheckpoint({
      lastVerdict: verifyResult.output.verdict,
      checkpointSequence: state.checkpointSequence + 1,
      probeError:
        verifyResult.output.verdict === 'fail'
          ? `Checkpoint failed: ${verifyResult.output.rationale}`
          : undefined,
    });
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
        batchLog: withBatchFinalized(state, 'committed'),
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
        batchLog: withBatchFinalized(state, 'committed'),
      };
    }

    if (state.lastVerdict === 'fail') {
      const phase = state.phase;
      const committedStepCount = state.validatedSteps[phase].length;

      const backtrackHint =
        committedStepCount === 0
          ? buildEmptyPathBacktrackHint(phase, state.probeError)
          : undefined;

      logExploreGraphEvent(
        `iter=${state.iteration} phase=${state.phase} commit fail → revert snapshot | path=${committedStepCount} steps`,
      );

      const revertedSnapshotId =
        committedStepCount === 0
          ? state.initialSnapshotId
          : (state.snapshotBeforeId ?? state.initialSnapshotId);

      const batchLog =
        state.probeStatus === 'failed' || state.probeFailureContext
          ? withBatchFinalized(state, 'probe_failed', {
              error: state.probeError,
              failedStep: state.probeFailureContext?.failedStep,
              screenshotBeforeSnapshotId:
                state.probeFailureContext?.screenshotBeforeSnapshotId,
            })
          : withBatchFinalized(state, 'checkpoint_failed', {
              error: state.probeError,
            });

      return {
        lastExecutedSteps: [],
        recoveryAttempts: state.recoveryAttempts + 1,
        currentSnapshotId: revertedSnapshotId,
        snapshotBeforeId: undefined,
        batchLog,
        ...(backtrackHint ? { probeError: backtrackHint } : {}),
      };
    }

    return {};
  }

  async function dispatchSmokeNode(state: State): Promise<Partial<State>> {
    if (state.failed || state.smokeGatePassed || state.lastVerdict !== 'goal_reached') {
      return {};
    }

    if (state.pendingProbeJobId) {
      return {};
    }

    const phaseSteps = state.validatedSteps[state.phase];
    if (phaseSteps.length === 0) {
      return {
        failed: true,
        failureReason: `Smoke replay: no validated steps for ${state.phase}`,
      };
    }

    const probeJobId = await deps.probePublisher.publishSmokeReplay({
      sessionId: state.sessionId,
      mrVersionId: state.mrVersionId,
      exploreJobId: state.exploreJobId,
      phase: state.phase,
      inventorySnapshotId: state.initialSnapshotId,
      resumeUrl: state.sessionUrl,
      replaySteps: phaseSteps,
      planLlmCallId: state.lastPlanLlmCallId,
      cycleIteration: state.iteration,
    });

    logExploreGraphEvent(
      `iter=${state.iteration} phase=${state.phase} smoke queued job=${probeJobId.slice(0, 8)} | path=${phaseSteps.length} steps`,
    );

    return {
      pendingProbeJobId: probeJobId,
      awaitingSmokeReplay: true,
    };
  }

  async function assessSmokeNode(state: State): Promise<Partial<State>> {
    if (state.failed || !state.awaitingSmokeReplay) {
      return {};
    }

    if (state.probeStatus === 'failed') {
      const phase = state.phase;
      const error = state.probeError ?? 'Smoke replay failed';
      const nextSmokeRecovery = state.smokeRecoveryAttempts + 1;

      if (nextSmokeRecovery >= state.maxSmokeRecoveryAttempts) {
        logExploreGraphEvent(
          `iter=${state.iteration} phase=${phase} smoke failed — max retries (${state.maxSmokeRecoveryAttempts})`,
        );
        return {
          failed: true,
          failureReason: `Phase ${phase} smoke replay failed after ${state.maxSmokeRecoveryAttempts} attempts: ${error}`,
        };
      }

      const current = [...state.validatedSteps[phase]];
      const backtrackSize = Math.min(3, current.length);
      if (backtrackSize > 0) {
        current.splice(-backtrackSize, backtrackSize);
      }

      const smokeError = [
        `Smoke replay failed (full path from homepage): ${error}`,
        'The incremental probes passed but the complete scenario is unstable.',
        'Simplify the path, dismiss modals earlier, or use more stable locators.',
      ].join(' ');

      logExploreGraphEvent(
        `iter=${state.iteration} phase=${phase} smoke failed → backtrack | path=${current.length} steps`,
      );

      const validatedSteps = {
        ...state.validatedSteps,
        [phase]: current,
      };

      await deps.explorationRepo.updateGenerationSlots(
        state.mrVersionId,
        buildGenerationSlots({ ...state, validatedSteps }),
      );

      return {
        lastVerdict: undefined,
        smokeGatePassed: false,
        awaitingSmokeReplay: false,
        pendingProbeJobId: undefined,
        probeStatus: undefined,
        smokeRecoveryAttempts: nextSmokeRecovery,
        validatedSteps,
        probeError: smokeError,
      };
    }

    logExploreGraphEvent(
      `iter=${state.iteration} phase=${state.phase} smoke passed | path=${state.validatedSteps[state.phase].length} steps`,
    );

    return {
      smokeGatePassed: true,
      awaitingSmokeReplay: false,
      pendingProbeJobId: undefined,
      probeStatus: undefined,
      probeError: undefined,
      smokeRecoveryAttempts: 0,
    };
  }

  async function switchPhaseNode(state: State): Promise<Partial<State>> {
    if (state.failed || state.lastVerdict !== 'goal_reached' || !state.smokeGatePassed) {
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
      smokeGatePassed: false,
      awaitingSmokeReplay: false,
      smokeRecoveryAttempts: 0,
    };
  }

  async function compileDraftNode(state: State): Promise<Partial<State>> {
    if (state.failed || !state.mrDefinition || !state.smokeGatePassed) {
      return {};
    }

    const snapshot = await deps.snapshotRepo.findById(state.initialSnapshotId);
    if (!snapshot) {
      return { failed: true, failureReason: 'Snapshot missing for compile' };
    }

    const generationSlots = buildGenerationSlots(state);
    const llmCallId = await deps.explorationRepo.beginLlmCall({
      exploreJobId: state.exploreJobId,
      mrVersionId: state.mrVersionId,
      purpose: 'compile_draft',
      model: deps.openRouter.getModel(),
      promptVersion: 'compile-v1',
    });

    try {
      const compiled = compilePlaybook(
        generationSlots,
        state.mrDefinition,
        snapshot.inventory,
        { sessionUrl: state.sessionUrl },
      );

      const mrDefinitionId = await deps.explorationRepo.findMrDefinitionId(state.mrVersionId);
      if (!mrDefinitionId) {
        throw new Error('MR definition not found');
      }

      await deps.explorationRepo.saveDraft({
        mrVersionId: state.mrVersionId,
        mrDefinitionId,
        mrDefinition: state.mrDefinition,
        generationSlots,
        compiled,
        exploreJobId: state.exploreJobId,
      });

      await deps.explorationRepo.completeLlmCall({
        id: llmCallId,
        audit: {
          purpose: 'compile_draft',
          model: deps.openRouter.getModel(),
          promptVersion: 'compile-v1',
          tokensIn: null,
          tokensOut: null,
          latencyMs: 0,
        },
        responseJson: { compiled: true },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'compile draft failed';
      await deps.explorationRepo.failLlmCall({ id: llmCallId, error: message });
      return { failed: true, failureReason: message };
    }

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

  function routeAfterGoalReached(state: State): string {
    if (!state.smokeGatePassed) {
      return 'dispatch_smoke';
    }

    return state.phase === 'source' ? 'switch_phase' : 'compile_draft';
  }

  function routeAfterPlan(state: State): string {
    if (state.failed) {
      return 'fail';
    }

    if (state.lastVerdict === 'goal_reached') {
      return routeAfterGoalReached(state);
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
      return routeAfterGoalReached(state);
    }

    return 'plan_next';
  }

  function routeAfterAwaitProbe(state: State): string {
    if (state.awaitingSmokeReplay) {
      return 'assess_smoke';
    }

    return 'assess_checkpoint';
  }

  function routeAfterAssessSmoke(state: State): string {
    if (state.failed) {
      return 'fail';
    }

    if (state.smokeGatePassed) {
      return routeAfterGoalReached(state);
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
    .addNode('dispatch_smoke', dispatchSmokeNode)
    .addNode('assess_smoke', assessSmokeNode)
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
      dispatch_smoke: 'dispatch_smoke',
      switch_phase: 'switch_phase',
      compile_draft: 'compile_draft',
      plan_next: 'plan_next',
      fail: 'fail',
    })
    .addEdge('dispatch_probe', 'await_probe')
    .addEdge('dispatch_smoke', 'await_probe')
    .addConditionalEdges('await_probe', routeAfterAwaitProbe, {
      assess_checkpoint: 'assess_checkpoint',
      assess_smoke: 'assess_smoke',
    })
    .addEdge('assess_checkpoint', 'commit_or_backtrack')
    .addConditionalEdges('commit_or_backtrack', routeAfterCommit, {
      plan_next: 'plan_next',
      dispatch_smoke: 'dispatch_smoke',
      switch_phase: 'switch_phase',
      compile_draft: 'compile_draft',
      fail: 'fail',
    })
    .addConditionalEdges('assess_smoke', routeAfterAssessSmoke, {
      plan_next: 'plan_next',
      dispatch_smoke: 'dispatch_smoke',
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
