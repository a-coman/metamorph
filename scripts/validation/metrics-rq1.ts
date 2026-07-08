import type { BatchManifest } from './manifest.js';
import { sumLlmUsage, TOKEN_PRICE_USD_PER_MILLION } from './llm-pricing.js';
import { getPrisma } from './prisma.js';
import { rate, summarizeNumeric } from './stats.js';
import { TRANSFORM_FAMILIES } from './config.js';

type GenerationSlots = {
  source?: { steps?: unknown[] };
  follow_up?: { steps?: unknown[] };
};

export async function computeRq1Metrics(manifest: BatchManifest) {
  const prisma = getPrisma();
  const mrVersionIds = manifest.sessions.flatMap((session) =>
    session.families
      .map((family) => family.mrVersionId)
      .filter((id): id is string => id !== null),
  );

  const mrVersions = await prisma.mrVersion.findMany({
    where: { id: { in: mrVersionIds } },
    include: {
      mrDefinition: true,
      session: true,
      jobs: true,
      llmCalls: true,
    },
  });

  const mrById = new Map(mrVersions.map((version) => [version.id, version]));
  const attempts = manifest.sessions.flatMap((session) =>
    session.families.map((family) => ({
      domain: session.domain,
      generation: session.generation,
      sessionId: session.sessionId,
      transformFamily: family.transformFamily,
      mrVersionId: family.mrVersionId,
      explorationSuccess: family.explorationSuccess,
      explorationFailureReason: family.explorationFailureReason,
    })),
  );

  const totalAttempts = attempts.length;
  const successCount = attempts.filter((attempt) => attempt.explorationSuccess).length;
  const failureCount = totalAttempts - successCount;

  const byFamily = Object.fromEntries(
    TRANSFORM_FAMILIES.map((family) => {
      const familyAttempts = attempts.filter((attempt) => attempt.transformFamily === family);
      const familySuccess = familyAttempts.filter((attempt) => attempt.explorationSuccess).length;
      return [
        family,
        {
          attempts: familyAttempts.length,
          successes: familySuccess,
          failures: familyAttempts.length - familySuccess,
          successRate: rate(familySuccess, familyAttempts.length),
        },
      ];
    }),
  );

  const domains = [...new Set(manifest.sessions.map((session) => session.domain))];
  const byDomain = Object.fromEntries(
    domains.map((domain) => {
      const domainAttempts = attempts.filter((attempt) => attempt.domain === domain);
      const domainSuccess = domainAttempts.filter((attempt) => attempt.explorationSuccess).length;
      return [
        domain,
        {
          attempts: domainAttempts.length,
          successes: domainSuccess,
          failures: domainAttempts.length - domainSuccess,
          successRate: rate(domainSuccess, domainAttempts.length),
        },
      ];
    }),
  );

  const domainFamilyCrossTab: Record<string, Record<string, { attempts: number; successes: number; successRate: number | null }>> = {};
  for (const domain of domains) {
    domainFamilyCrossTab[domain] = {};
    for (const family of TRANSFORM_FAMILIES) {
      const cell = attempts.filter(
        (attempt) => attempt.domain === domain && attempt.transformFamily === family,
      );
      const successes = cell.filter((attempt) => attempt.explorationSuccess).length;
      domainFamilyCrossTab[domain]![family] = {
        attempts: cell.length,
        successes,
        successRate: rate(successes, cell.length),
      };
    }
  }

  const sessionIds = manifest.sessions.map((session) => session.sessionId);
  const allSessionLlmCalls = await prisma.llmCall.findMany({
    where: {
      OR: [
        { mrVersion: { sessionId: { in: sessionIds } } },
        { job: { sessionId: { in: sessionIds } } },
      ],
    },
    include: {
      mrVersion: { select: { sessionId: true } },
      job: { select: { sessionId: true } },
    },
  });

  const llmCallsBySessionId = new Map<string, typeof allSessionLlmCalls>();
  for (const call of allSessionLlmCalls) {
    const sessionId = call.mrVersion?.sessionId ?? call.job?.sessionId;
    if (!sessionId) {
      continue;
    }
    const bucket = llmCallsBySessionId.get(sessionId) ?? [];
    bucket.push(call);
    llmCallsBySessionId.set(sessionId, bucket);
  }

  const probeJobs = await prisma.job.findMany({
    where: {
      sessionId: { in: sessionIds },
      type: 'probe',
    },
  });

  const probeBySession = manifest.sessions.map((session) => {
    const sessionProbes = probeJobs.filter((job) => job.sessionId === session.sessionId);
    const failed = sessionProbes.filter((job) => job.status === 'failed').length;
    return {
      sessionId: session.sessionId,
      domain: session.domain,
      generation: session.generation,
      total: sessionProbes.length,
      failed,
      failureRate: rate(failed, sessionProbes.length),
    };
  });

  const successfulMrIds = attempts
    .filter((attempt) => attempt.explorationSuccess && attempt.mrVersionId)
    .map((attempt) => attempt.mrVersionId!);

  const probeBySuccessfulMr = successfulMrIds.map((mrVersionId) => {
    const mrProbes = probeJobs.filter((job) => job.mrVersionId === mrVersionId);
    const failed = mrProbes.filter((job) => job.status === 'failed').length;
    const mrVersion = mrById.get(mrVersionId);
    return {
      mrVersionId,
      domain: manifest.sessions.find((session) => session.sessionId === mrVersion?.sessionId)?.domain ?? 'unknown',
      transformFamily: mrVersion?.mrDefinition.transformFamily ?? 'unknown',
      total: mrProbes.length,
      failed,
      failureRate: rate(failed, mrProbes.length),
    };
  });

  const validatedSteps = successfulMrIds.map((mrVersionId) => {
    const mrVersion = mrById.get(mrVersionId);
    const slots = (mrVersion?.generationSlots ?? {}) as GenerationSlots;
    return {
      mrVersionId,
      sourceSteps: slots.source?.steps?.length ?? 0,
      followUpSteps: slots.follow_up?.steps?.length ?? 0,
    };
  });

  const llmByMr = successfulMrIds.map((mrVersionId) => {
    const calls = mrById.get(mrVersionId)?.llmCalls ?? [];
    const usage = sumLlmUsage(calls);
    const latenciesPerCall = calls
      .map((call) => call.latencyMs)
      .filter((value): value is number => value !== null);
    return {
      mrVersionId,
      ...usage,
      latencyPerCall: summarizeNumeric(latenciesPerCall),
    };
  });

  const successfulMrCalls = successfulMrIds.flatMap(
    (mrVersionId) => mrById.get(mrVersionId)?.llmCalls ?? [],
  );
  const successfulUsage = sumLlmUsage(successfulMrCalls);
  const latencyPerCallAll = summarizeNumeric(
    successfulMrCalls
      .map((call) => call.latencyMs)
      .filter((value): value is number => value !== null),
  );
  const latencyPerMr = summarizeNumeric(llmByMr.map((row) => row.latencyMs));

  const llmCallsByMrVersionId = new Map<string, typeof allSessionLlmCalls>();
  for (const call of allSessionLlmCalls) {
    if (!call.mrVersionId) {
      continue;
    }
    const bucket = llmCallsByMrVersionId.get(call.mrVersionId) ?? [];
    bucket.push(call);
    llmCallsByMrVersionId.set(call.mrVersionId, bucket);
  }

  function usageForCalls(calls: typeof allSessionLlmCalls) {
    const usage = sumLlmUsage(calls);
    const latenciesPerCall = calls
      .map((call) => call.latencyMs)
      .filter((value): value is number => value !== null);
    return {
      ...usage,
      latencyPerCall: summarizeNumeric(latenciesPerCall),
    };
  }

  const perSession = manifest.sessions.map((session) => {
    const calls = llmCallsBySessionId.get(session.sessionId) ?? [];
    return {
      sessionId: session.sessionId,
      domain: session.domain,
      generation: session.generation,
      ...usageForCalls(calls),
    };
  });

  const perSessionFamily = manifest.sessions.flatMap((session) =>
    session.families.map((family) => {
      const calls = family.mrVersionId
        ? (llmCallsByMrVersionId.get(family.mrVersionId) ?? [])
        : [];
      return {
        sessionId: session.sessionId,
        domain: session.domain,
        generation: session.generation,
        transformFamily: family.transformFamily,
        mrVersionId: family.mrVersionId,
        explorationSuccess: family.explorationSuccess,
        ...usageForCalls(calls),
      };
    }),
  );

  const perFamily = TRANSFORM_FAMILIES.map((transformFamily) => {
    const rows = perSessionFamily.filter((row) => row.transformFamily === transformFamily);
    const calls = rows.flatMap((row) =>
      row.mrVersionId ? (llmCallsByMrVersionId.get(row.mrVersionId) ?? []) : [],
    );
    return {
      transformFamily,
      attempts: rows.length,
      ...usageForCalls(calls),
    };
  });

  const totalSessionUsage = sumLlmUsage(allSessionLlmCalls);

  const timeToDraftMs = successfulMrIds
    .map((mrVersionId) => {
      const mrVersion = mrById.get(mrVersionId);
      if (!mrVersion) {
        return null;
      }
      const exploreJob = mrVersion.jobs.find((job) => job.type === 'explore');
      if (!exploreJob?.startedAt) {
        return null;
      }
      return mrVersion.updatedAt.getTime() - exploreJob.startedAt.getTime();
    })
    .filter((value): value is number => value !== null);

  const phaseDecomposition = buildPhaseDecomposition(mrVersions, probeJobs, successfulMrIds);

  const failureReasons = attempts
    .filter((attempt) => !attempt.explorationSuccess && attempt.explorationFailureReason)
    .map((attempt) => attempt.explorationFailureReason!);

  const failureReasonCounts = countStrings(failureReasons);

  return {
    exploration: {
      totalAttempts,
      successes: successCount,
      failures: failureCount,
      successRate: rate(successCount, totalAttempts),
      failureRate: rate(failureCount, totalAttempts),
      byFamily,
      byDomain,
      domainFamilyCrossTab,
    },
    probes: {
      perSession: probeBySession,
      perSuccessfulMr: probeBySuccessfulMr,
      sessionAggregate: {
        total: probeBySession.reduce((sum, row) => sum + row.total, 0),
        failed: probeBySession.reduce((sum, row) => sum + row.failed, 0),
        failureRate: rate(
          probeBySession.reduce((sum, row) => sum + row.failed, 0),
          probeBySession.reduce((sum, row) => sum + row.total, 0),
        ),
      },
    },
    validatedSteps: {
      rows: validatedSteps,
      summary: {
        source: summarizeNumeric(validatedSteps.map((row) => row.sourceSteps)),
        followUp: summarizeNumeric(validatedSteps.map((row) => row.followUpSteps)),
      },
    },
    llmCost: {
      pricing: TOKEN_PRICE_USD_PER_MILLION,
      latencyNote:
        'latencyMs is the sum of per-call OpenRouter round-trip times, not end-to-end wall clock',
      successfulMrs: {
        rows: llmByMr,
        aggregate: {
          ...successfulUsage,
          latencyPerCall: latencyPerCallAll,
          latencyPerMr,
        },
      },
      perSession,
      perSessionFamily,
      perFamily,
      total: totalSessionUsage,
    },
    timeToDraft: summarizeNumeric(timeToDraftMs),
    phaseDecomposition,
    failureReasonCounts,
  };
}

function buildPhaseDecomposition(
  mrVersions: Array<{
    id: string;
    llmCalls: Array<{ purpose: string; tokensIn: number | null; tokensOut: number | null; latencyMs: number | null }>;
    jobs: Array<{ type: string; startedAt: Date | null; finishedAt: Date | null; payload: unknown }>;
    updatedAt: Date;
  }>,
  probeJobs: Array<{ mrVersionId: string | null; type: string; status: string; startedAt: Date | null; finishedAt: Date | null; payload: unknown }>,
  successfulMrIds: string[],
) {
  const successful = mrVersions.filter((version) => successfulMrIds.includes(version.id));
  const llmCalls = successful.flatMap((version) => version.llmCalls);
  const relevantProbes = probeJobs.filter(
    (job) => job.mrVersionId && successfulMrIds.includes(job.mrVersionId),
  );

  const sumPhaseLlm = (purposes: string[]) => {
    const calls = llmCalls.filter((call) => purposes.includes(call.purpose));
    const latenciesPerCall = calls
      .map((call) => call.latencyMs)
      .filter((value): value is number => value !== null);
    const usage = sumLlmUsage(calls);
    return {
      ...usage,
      latencyPerCall: summarizeNumeric(latenciesPerCall),
    };
  };

  const sumProbeWallMs = (jobs: typeof relevantProbes) =>
    jobs
      .map((job) => wallMs(job.startedAt, job.finishedAt))
      .filter((value): value is number => value !== null);

  const allProbeWall = sumProbeWallMs(relevantProbes);
  const smokeProbes = relevantProbes.filter((job) => isSmokeReplay(job.payload));
  const smokeWall = sumProbeWallMs(smokeProbes);

  return {
    plan: sumPhaseLlm(['mr_plan']),
    exploreLoop: sumPhaseLlm(['plan_explore', 'explore_verify']),
    probes: summarizeNumeric(allProbeWall),
    smoke: summarizeNumeric(smokeWall),
    observe: sumPhaseLlm(['observe_spec']),
    compile: {
      note: 'Negligible LLM time; compile uses MR updated_at after explore job start',
      mrCount: successful.length,
    },
  };
}

function isSmokeReplay(payload: unknown): boolean {
  if (!payload || typeof payload !== 'object') {
    return false;
  }
  return (payload as { mode?: string }).mode === 'smoke_replay';
}

function wallMs(startedAt: Date | null, finishedAt: Date | null): number | null {
  if (!startedAt || !finishedAt) {
    return null;
  }
  return finishedAt.getTime() - startedAt.getTime();
}

function sumNullable(values: Array<number | null>): number {
  return values.reduce<number>((sum, value) => sum + (value ?? 0), 0);
}

function countStrings(values: string[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const value of values) {
    counts[value] = (counts[value] ?? 0) + 1;
  }
  return counts;
}
