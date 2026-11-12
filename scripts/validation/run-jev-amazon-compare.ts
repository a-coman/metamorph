import { loadValidationEnv } from './env.js';
loadValidationEnv();

import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createValidationApiClient } from './api.js';
import { TRANSFORM_FAMILIES, getGitSha, type TransformFamily } from './config.js';
import { computeTokenCostUsd, formatUsd } from './llm-pricing.js';
import { formatObservablesSummary, formatStepsSummary } from './mr-quality-export.js';
import { REPO_ROOT } from './paths.js';
import { pollSessionUntilTerminal } from './poll.js';
import { disconnectPrisma, getPrisma } from './prisma.js';
import { median } from './stats.js';

const AMAZON_URL = 'https://www.amazon.es/';
const OUT_DIR = join(REPO_ROOT, 'scripts/validation/out/jev-amazon');
const JEV_INPUT_USD_PER_MILLION = 0.042;
const JEV_OUTPUT_USD_PER_MILLION = 0;

const BASELINE = {
  label: 'LLM planner (thesis amazon generation 1)',
  sessionId: '82ece300-e5c9-4b32-9b2d-9cd9fb95944f',
  startedAt: '2026-07-09T15:27:46.131Z',
  finishedAt: '2026-07-09T15:39:49.680Z',
  wallMs: Date.parse('2026-07-09T15:39:49.680Z') - Date.parse('2026-07-09T15:27:46.131Z'),
  model: 'minimax/minimax-m3',
  planExploreBackend: 'llm',
  callCount: 53,
  tokensIn: 369109,
  tokensOut: 45502,
  latencyMs: 700595,
  costUsd: 0.1653351,
  families: {
    idempotence: {
      transformFamily: 'idempotence' as TransformFamily,
      explorationSuccess: true,
      status: 'approved',
      verdict: 'pass',
      failureReason: null as string | null,
      callCount: 14,
      tokensIn: 87690,
      tokensOut: 5539,
      latencyMs: 106740,
      costUsd: 0.0329538,
    },
    subset: {
      transformFamily: 'subset' as TransformFamily,
      explorationSuccess: false,
      status: 'exploration_failed',
      verdict: null as string | null,
      failureReason:
        "Plan aborted: The phase requires arriving at the unfiltered results page first, then applying one filter. We filled the search box with 'laptop' but never submitted.",
      callCount: 6,
      tokensIn: 32703,
      tokensOut: 1666,
      latencyMs: 60583,
      costUsd: 0.0118101,
    },
    permutation: {
      transformFamily: 'permutation' as TransformFamily,
      explorationSuccess: false,
      status: 'exploration_failed',
      verdict: null as string | null,
      failureReason: 'page.evaluate: Execution context was destroyed, most likely because of a navigation',
      callCount: 20,
      tokensIn: 157570,
      tokensOut: 20494,
      latencyMs: 291581,
      costUsd: 0.0718638,
    },
    inverse: {
      transformFamily: 'inverse' as TransformFamily,
      explorationSuccess: true,
      status: 'approved',
      verdict: 'fail',
      failureReason: null as string | null,
      callCount: 13,
      tokensIn: 91146,
      tokensOut: 17803,
      latencyMs: 241691,
      costUsd: 0.0487074,
    },
  },
} as const;

const JEV_V1 = {
  label: 'Jev v1 questions',
  sessionId: '21cf6e8e-a417-427a-a346-219f52088839',
  wallMs: 210848,
  callCount: 38,
  tokensIn: 194567,
  tokensOut: 22314,
  latencyMs: 139581,
  costUsd: 0.030344028,
  families: {
    idempotence: {
      explorationSuccess: false,
      status: 'exploration_failed',
      verdict: null as string | null,
      failureReason: 'Low confidence on operation=fill (0.14)',
      callCount: 12,
      costUsd: 0.011768406,
      latencyMs: 33771,
    },
    subset: {
      explorationSuccess: false,
      status: 'exploration_failed',
      verdict: null as string | null,
      failureReason: 'Low confidence on operation=click (0.39)',
      callCount: 12,
      costUsd: 0.00818652,
      latencyMs: 48889,
    },
    permutation: {
      explorationSuccess: false,
      status: 'exploration_failed',
      verdict: null as string | null,
      failureReason: 'Low confidence on operation=fill (0.23)',
      callCount: 6,
      costUsd: 0.00371451,
      latencyMs: 16984,
    },
    inverse: {
      explorationSuccess: false,
      status: 'exploration_failed',
      verdict: null as string | null,
      failureReason: 'Low confidence on operation=fill (0.36)',
      callCount: 8,
      costUsd: 0.006674592,
      latencyMs: 39937,
    },
  },
} as const;

type CallRow = {
  id: string;
  mrVersionId: string | null;
  purpose: string;
  model: string;
  promptVersion: string;
  tokensIn: number | null;
  tokensOut: number | null;
  latencyMs: number | null;
  createdAt: string;
  completedAt: string | null;
  costUsd: number;
  jevTokensIn: number;
  fillTokensIn: number;
  fillTokensOut: number;
  action: string | null;
  rationale: string | null;
};

type FamilySnapshot = {
  transformFamily: TransformFamily;
  mrVersionId: string | null;
  status: string;
  explorationSuccess: boolean;
  explorationFailureReason: string | null;
  initialAutoRunId: string | null;
  initialAutoRunStatus: string | null;
  initialAutoVerdictStrict: string | null;
  sourceSteps: string;
  followUpSteps: string;
  observables: string;
  checkpointCount: number;
  callCount: number;
  tokensIn: number;
  tokensOut: number;
  latencyMs: number;
  costUsd: number;
  planExploreCount: number;
  planExploreLatencyMs: number[];
  samplePlans: Array<{
    action: string | null;
    rationale: string | null;
    latencyMs: number | null;
    model: string;
  }>;
};

type RunSnapshot = {
  generatedAt: string;
  gitSha: string;
  planExploreBackend: string;
  jevModel: string;
  fillModel: string;
  llmModel: string;
  promptVersions: string[];
  url: string;
  sessionId: string;
  allTerminal: boolean;
  startedAt: string;
  finishedAt: string;
  wallMs: number;
  families: FamilySnapshot[];
  calls: CallRow[];
  totals: {
    callCount: number;
    tokensIn: number;
    tokensOut: number;
    latencyMs: number;
    costUsd: number;
    byPurpose: Record<
      string,
      { callCount: number; tokensIn: number; tokensOut: number; latencyMs: number; costUsd: number }
    >;
    byModel: Record<
      string,
      { callCount: number; tokensIn: number; tokensOut: number; latencyMs: number; costUsd: number }
    >;
  };
};

async function waitForApi(url: string, timeoutMs = 180_000): Promise<void> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(`${url}/health`);
      if (response.ok) {
        return;
      }
    } catch {
      // API not up yet
    }
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
  throw new Error(`API at ${url} did not become healthy within ${timeoutMs}ms`);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function readNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function isJevPlanCall(call: { model: string; promptVersion: string }): boolean {
  return (
    call.promptVersion === 'plan-explore-jev-v1' ||
    call.promptVersion === 'plan-explore-jev-v2' ||
    call.model.toLowerCase().includes('jev')
  );
}

function extractFillUsage(responseJson: unknown): { tokensIn: number; tokensOut: number } {
  const fill = asRecord(asRecord(responseJson)?.jev)?.fill;
  const record = asRecord(fill);
  return {
    tokensIn: readNumber(record?.tokensIn) ?? 0,
    tokensOut: readNumber(record?.tokensOut) ?? 0,
  };
}

function costForCall(input: {
  model: string;
  promptVersion: string;
  tokensIn: number | null;
  tokensOut: number | null;
  responseJson: unknown;
}): {
  costUsd: number;
  jevTokensIn: number;
  fillTokensIn: number;
  fillTokensOut: number;
} {
  const tokensIn = input.tokensIn ?? 0;
  const tokensOut = input.tokensOut ?? 0;
  if (!isJevPlanCall(input)) {
    return {
      costUsd: computeTokenCostUsd(tokensIn, tokensOut),
      jevTokensIn: 0,
      fillTokensIn: 0,
      fillTokensOut: 0,
    };
  }

  const fill = extractFillUsage(input.responseJson);
  const jevTokensIn = Math.max(0, tokensIn - fill.tokensIn);
  const jevCost = (jevTokensIn / 1_000_000) * JEV_INPUT_USD_PER_MILLION
    + (Math.max(0, tokensOut - fill.tokensOut) / 1_000_000) * JEV_OUTPUT_USD_PER_MILLION;
  return {
    costUsd: jevCost + computeTokenCostUsd(fill.tokensIn, fill.tokensOut),
    jevTokensIn,
    fillTokensIn: fill.tokensIn,
    fillTokensOut: fill.tokensOut,
  };
}

function emptyBucket() {
  return { callCount: 0, tokensIn: 0, tokensOut: 0, latencyMs: 0, costUsd: 0 };
}

function addToBucket(
  buckets: Record<string, ReturnType<typeof emptyBucket>>,
  key: string,
  call: CallRow,
): void {
  const bucket = buckets[key] ?? emptyBucket();
  bucket.callCount += 1;
  bucket.tokensIn += call.tokensIn ?? 0;
  bucket.tokensOut += call.tokensOut ?? 0;
  bucket.latencyMs += call.latencyMs ?? 0;
  bucket.costUsd += call.costUsd;
  buckets[key] = bucket;
}

async function extractSnapshot(input: {
  sessionId: string;
  startedAt: string;
  finishedAt: string;
  allTerminal: boolean;
}): Promise<RunSnapshot> {
  const prisma = getPrisma();
  const session = await prisma.session.findUnique({
    where: { id: input.sessionId },
    include: {
      jobs: { orderBy: { createdAt: 'asc' } },
      mrVersions: {
        include: {
          mrDefinition: true,
          runs: { orderBy: { createdAt: 'asc' }, take: 1 },
          llmCalls: { orderBy: { createdAt: 'asc' } },
          explorationCheckpoints: { orderBy: { sequence: 'asc' } },
        },
      },
    },
  });

  if (!session) {
    throw new Error(`Session ${input.sessionId} not found`);
  }

  const sessionCalls = await prisma.llmCall.findMany({
    where: {
      OR: [
        { mrVersionId: { in: session.mrVersions.map((version) => version.id) } },
        { job: { sessionId: session.id } },
      ],
    },
    orderBy: { createdAt: 'asc' },
  });

  const calls: CallRow[] = sessionCalls.map((call) => {
    const priced = costForCall(call);
    const response = asRecord(call.responseJson);
    return {
      id: call.id,
      mrVersionId: call.mrVersionId,
      purpose: call.purpose,
      model: call.model,
      promptVersion: call.promptVersion,
      tokensIn: call.tokensIn,
      tokensOut: call.tokensOut,
      latencyMs: call.latencyMs,
      createdAt: call.createdAt.toISOString(),
      completedAt: call.completedAt?.toISOString() ?? null,
      costUsd: priced.costUsd,
      jevTokensIn: priced.jevTokensIn,
      fillTokensIn: priced.fillTokensIn,
      fillTokensOut: priced.fillTokensOut,
      action: typeof response?.action === 'string' ? response.action : null,
      rationale: typeof response?.rationale === 'string' ? response.rationale : null,
    };
  });

  const families: FamilySnapshot[] = TRANSFORM_FAMILIES.map((transformFamily) => {
    const mrVersion = session.mrVersions.find(
      (version) => version.mrDefinition.transformFamily === transformFamily,
    );
    const familyCalls = calls.filter((call) => call.mrVersionId === mrVersion?.id);
    const planCalls = familyCalls.filter((call) => call.purpose === 'plan_explore');
    const slots = asRecord(mrVersion?.generationSlots);
    const source = asRecord(slots?.source);
    const followUp = asRecord(slots?.follow_up);
    const observation = asRecord(slots?.observation);
    const sourceSteps = Array.isArray(source?.steps) ? source.steps : undefined;
    const followUpSteps = Array.isArray(followUp?.steps) ? followUp.steps : undefined;
    const observables = Array.isArray(observation?.observables)
      ? observation.observables
      : undefined;
    const initialRun = mrVersion?.runs[0] ?? null;

    return {
      transformFamily,
      mrVersionId: mrVersion?.id ?? null,
      status: mrVersion?.status ?? 'missing',
      explorationSuccess: mrVersion?.playbookBlobId != null,
      explorationFailureReason: mrVersion?.explorationFailureReason ?? null,
      initialAutoRunId: initialRun?.id ?? null,
      initialAutoRunStatus: initialRun?.status ?? null,
      initialAutoVerdictStrict: initialRun?.verdictStrict ?? null,
      sourceSteps: formatStepsSummary(sourceSteps as never),
      followUpSteps: formatStepsSummary(followUpSteps as never),
      observables: formatObservablesSummary(observables as never),
      checkpointCount: mrVersion?.explorationCheckpoints.length ?? 0,
      callCount: familyCalls.length,
      tokensIn: familyCalls.reduce((sum, call) => sum + (call.tokensIn ?? 0), 0),
      tokensOut: familyCalls.reduce((sum, call) => sum + (call.tokensOut ?? 0), 0),
      latencyMs: familyCalls.reduce((sum, call) => sum + (call.latencyMs ?? 0), 0),
      costUsd: familyCalls.reduce((sum, call) => sum + call.costUsd, 0),
      planExploreCount: planCalls.length,
      planExploreLatencyMs: planCalls
        .map((call) => call.latencyMs)
        .filter((value): value is number => value !== null),
      samplePlans: planCalls.slice(0, 4).map((call) => ({
        action: call.action,
        rationale: call.rationale,
        latencyMs: call.latencyMs,
        model: call.model,
      })),
    };
  });

  const byPurpose: RunSnapshot['totals']['byPurpose'] = {};
  const byModel: RunSnapshot['totals']['byModel'] = {};
  for (const call of calls) {
    addToBucket(byPurpose, call.purpose, call);
    addToBucket(byModel, call.model, call);
  }

  return {
    generatedAt: new Date().toISOString(),
    gitSha: getGitSha(),
    planExploreBackend: process.env.PLAN_EXPLORE_BACKEND ?? 'jev',
    jevModel: process.env.JEV_MODEL ?? 'typesafe/jev-1.13',
    fillModel: process.env.PLAN_EXPLORE_FILL_MODEL || process.env.OPENROUTER_MODEL || 'minimax/minimax-m3',
    llmModel: process.env.OPENROUTER_MODEL ?? 'minimax/minimax-m3',
    promptVersions: [...new Set(calls.map((call) => call.promptVersion))],
    url: AMAZON_URL,
    sessionId: session.id,
    allTerminal: input.allTerminal,
    startedAt: input.startedAt,
    finishedAt: input.finishedAt,
    wallMs: Date.parse(input.finishedAt) - Date.parse(input.startedAt),
    families,
    calls,
    totals: {
      callCount: calls.length,
      tokensIn: calls.reduce((sum, call) => sum + (call.tokensIn ?? 0), 0),
      tokensOut: calls.reduce((sum, call) => sum + (call.tokensOut ?? 0), 0),
      latencyMs: calls.reduce((sum, call) => sum + (call.latencyMs ?? 0), 0),
      costUsd: calls.reduce((sum, call) => sum + call.costUsd, 0),
      byPurpose,
      byModel,
    },
  };
}

function formatMs(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms)) {
    return 'n/a';
  }
  const sign = ms < 0 ? '-' : '';
  const abs = Math.abs(ms);
  if (abs < 1000) {
    return `${sign}${Math.round(abs)} ms`;
  }
  if (abs < 60_000) {
    return `${sign}${(abs / 1000).toFixed(1)} s`;
  }
  const minutes = Math.floor(abs / 60_000);
  const seconds = Math.round((abs % 60_000) / 1000);
  return `${sign}${minutes} min ${seconds} s`;
}

function isExpiredKeyFailure(reason: string | null | undefined): boolean {
  if (!reason) {
    return false;
  }
  return reason.includes('API key expired') || reason.includes('"code":401');
}

function shortenFailure(reason: string): string {
  if (isExpiredKeyFailure(reason)) {
    return 'OpenRouter 401. API key expired during mr_plan, before Jev ran.';
  }
  return reason.length > 700 ? `${reason.slice(0, 700)}…` : reason;
}

function formatInt(value: number): string {
  return value.toLocaleString('en-US');
}

function deltaText(current: number, baseline: number, kind: 'ms' | 'usd' | 'count' | 'tokens'): string {
  const diff = current - baseline;
  if (Math.abs(diff) < 1e-9) {
    return 'same';
  }
  const sign = diff > 0 ? '+' : '';
  if (kind === 'ms') {
    return `${sign}${formatMs(diff)}`;
  }
  if (kind === 'usd') {
    return `${sign}${formatUsd(diff)}`;
  }
  return `${sign}${formatInt(Math.round(diff))}`;
}

function esc(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function outcomeLabel(family: {
  explorationSuccess: boolean;
  verdict: string | null;
  status: string;
}): string {
  if (!family.explorationSuccess) {
    return 'exploration failed';
  }
  if (family.verdict) {
    return `compiled, replay ${family.verdict}`;
  }
  return family.status;
}

function renderReport(snapshot: RunSnapshot): string {
  const baselineSuccess = Object.values(BASELINE.families).filter((row) => row.explorationSuccess).length;
  const v1Success = Object.values(JEV_V1.families).filter((row) => row.explorationSuccess).length;
  const jevSuccess = snapshot.families.filter((row) => row.explorationSuccess).length;
  const planCalls = snapshot.calls.filter((call) => call.purpose === 'plan_explore');
  const jevPlanCalls = planCalls.filter((call) => isJevPlanCall(call));
  const planLatencies = jevPlanCalls
    .map((call) => call.latencyMs)
    .filter((value): value is number => value !== null);
  const fillCalls = jevPlanCalls.filter((call) => call.fillTokensIn > 0);
  const keyExpired = snapshot.families.every((family) =>
    isExpiredKeyFailure(family.explorationFailureReason),
  );
  const promptVersions = snapshot.promptVersions.join(', ') || 'unknown';

  const familyRows = TRANSFORM_FAMILIES.map((family) => {
    const current = snapshot.families.find((row) => row.transformFamily === family)!;
    const baseline = BASELINE.families[family];
    const v1 = JEV_V1.families[family];
    return `<tr>
      <td>${esc(family)}</td>
      <td>${esc(outcomeLabel({
        explorationSuccess: baseline.explorationSuccess,
        verdict: baseline.verdict,
        status: baseline.status,
      }))}</td>
      <td>${esc(outcomeLabel({
        explorationSuccess: v1.explorationSuccess,
        verdict: v1.verdict,
        status: v1.status,
      }))}</td>
      <td>${esc(outcomeLabel({
        explorationSuccess: current.explorationSuccess,
        verdict: current.initialAutoVerdictStrict,
        status: current.status,
      }))}</td>
      <td>${formatUsd(baseline.costUsd)}</td>
      <td>${formatUsd(v1.costUsd)}</td>
      <td>${formatUsd(current.costUsd)}</td>
    </tr>`;
  }).join('\n');

  const purposeRows = Object.entries(snapshot.totals.byPurpose)
    .sort((left, right) => right[1].callCount - left[1].callCount)
    .map(
      ([purpose, bucket]) => `<tr>
        <td>${esc(purpose)}</td>
        <td>${formatInt(bucket.callCount)}</td>
        <td>${formatInt(bucket.tokensIn)}</td>
        <td>${formatInt(bucket.tokensOut)}</td>
        <td>${formatMs(bucket.latencyMs)}</td>
        <td>${formatUsd(bucket.costUsd)}</td>
      </tr>`,
    )
    .join('\n');

  const modelRows = Object.entries(snapshot.totals.byModel)
    .sort((left, right) => right[1].callCount - left[1].callCount)
    .map(
      ([model, bucket]) => `<tr>
        <td>${esc(model)}</td>
        <td>${formatInt(bucket.callCount)}</td>
        <td>${formatInt(bucket.tokensIn)}</td>
        <td>${formatInt(bucket.tokensOut)}</td>
        <td>${formatMs(bucket.latencyMs)}</td>
        <td>${formatUsd(bucket.costUsd)}</td>
      </tr>`,
    )
    .join('\n');

  const familyDetail = snapshot.families
    .map((family) => {
      const plans = family.samplePlans
        .map(
          (plan) => `<li>
            <code>${esc(plan.action ?? 'unknown')}</code>
            ${plan.latencyMs != null ? `<span class="muted">${esc(formatMs(plan.latencyMs))}</span>` : ''}
            <div>${esc((plan.rationale ?? '').slice(0, 420))}</div>
          </li>`,
        )
        .join('\n');
      const failure = family.explorationFailureReason
        ? `<p class="fail">${esc(shortenFailure(family.explorationFailureReason))}</p>`
        : '';
      const steps = [family.sourceSteps, family.followUpSteps].filter(Boolean).join(' then ');
      return `<section class="family">
        <h3>${esc(family.transformFamily)}</h3>
        <p>${esc(outcomeLabel({
          explorationSuccess: family.explorationSuccess,
          verdict: family.initialAutoVerdictStrict,
          status: family.status,
        }))}.
        ${formatInt(family.planExploreCount)} plan_explore calls,
        ${formatInt(family.checkpointCount)} verify checkpoints.
        ${steps ? `Compiled steps: ${esc(steps)}.` : 'No compiled steps.'}</p>
        ${family.observables ? `<p class="muted">${esc(family.observables)}</p>` : ''}
        ${failure}
        ${plans ? `<ol class="plans">${plans}</ol>` : '<p class="muted">No plan_explore samples.</p>'}
      </section>`;
    })
    .join('\n');

  const headline = keyExpired
    ? 'The Amazon comparison did not finish. Discover reached amazon.es, then every explore job died on mr_plan with OpenRouter 401 because the API key is expired. Jev never chose a step.'
    : `Jev v2 compiled ${jevSuccess} of 4 families. Jev v1 compiled ${v1Success}. The LLM baseline compiled ${baselineSuccess}.`;

  const costLine = keyExpired
    ? `Replace OPENROUTER_API_KEY in .env, recreate the worker-llm container, and rerun. The thesis baseline below is the comparison we wanted, session ${BASELINE.sessionId}.`
    : `Session cost is ${formatUsd(snapshot.totals.costUsd)} against ${formatUsd(JEV_V1.costUsd)} on Jev v1 and ${formatUsd(BASELINE.costUsd)} on the LLM baseline.`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Jev plan_explore v2 on Amazon.es</title>
  <style>
    :root {
      --ink: #1c1917;
      --muted: #57534e;
      --line: #e7e5e4;
      --paper: #fafaf9;
      --accent: #1d4ed8;
      --fail: #9f1239;
      --ok: #166534;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      color: var(--ink);
      background: var(--paper);
      font: 16px/1.55 "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif;
    }
    main {
      max-width: 980px;
      margin: 0 auto;
      padding: 48px 24px 80px;
    }
    h1, h2, h3 { font-weight: 650; line-height: 1.25; }
    h1 { font-size: 2rem; margin: 0 0 8px; }
    h2 { font-size: 1.35rem; margin: 40px 0 12px; }
    h3 { font-size: 1.1rem; margin: 0 0 8px; }
    p { margin: 0 0 12px; }
    .lede { font-size: 1.05rem; }
    .muted { color: var(--muted); }
    .fail { color: var(--fail); }
    .ok { color: var(--ok); }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.92rem;
      margin: 12px 0 20px;
    }
    th, td {
      text-align: left;
      vertical-align: top;
      padding: 8px 10px;
      border-bottom: 1px solid var(--line);
    }
    th { font-weight: 650; background: #fff; }
    code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.86em; }
    .meta { display: grid; grid-template-columns: 180px 1fr; gap: 4px 16px; margin: 16px 0 24px; font-size: 0.95rem; }
    .family { padding: 16px 0; border-top: 1px solid var(--line); }
    .plans { margin: 8px 0 0; padding-left: 20px; }
    .plans li { margin: 0 0 10px; }
    .kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin: 20px 0; }
    .kpi { background: #fff; border: 1px solid var(--line); padding: 14px 16px; }
    .kpi b { display: block; font-size: 1.2rem; margin-top: 4px; }
    @media print { body { background: #fff; } main { padding: 0; } }
  </style>
</head>
<body>
  <main>
    <h1>Jev plan_explore v2 on Amazon.es</h1>
    <p class="lede">${esc(headline)} ${esc(costLine)}${keyExpired ? '' : ' One live session. Thesis Amazon generation 1 is the LLM baseline. Jev v1 is the same-day run that died on the old operation head.'}</p>

    <div class="kpis">
      <div class="kpi">Wall clock<div><b>${esc(formatMs(snapshot.wallMs))}</b></div><span class="muted">v1 ${esc(formatMs(JEV_V1.wallMs))} · LLM ${esc(formatMs(BASELINE.wallMs))}</span></div>
      <div class="kpi">Session cost<div><b>${esc(formatUsd(snapshot.totals.costUsd))}</b></div><span class="muted">v1 ${esc(formatUsd(JEV_V1.costUsd))} · LLM ${esc(formatUsd(BASELINE.costUsd))}</span></div>
      <div class="kpi">Model calls<div><b>${esc(formatInt(snapshot.totals.callCount))}</b></div><span class="muted">v1 ${esc(formatInt(JEV_V1.callCount))} · LLM ${esc(formatInt(BASELINE.callCount))}</span></div>
      <div class="kpi">Families compiled<div><b>${esc(`${jevSuccess} / 4`)}</b></div><span class="muted">v1 ${esc(`${v1Success} / 4`)} · LLM ${esc(`${baselineSuccess} / 4`)}</span></div>
    </div>

    <dl class="meta">
      <dt>Jev v2 session</dt><dd><code>${esc(snapshot.sessionId)}</code>${snapshot.allTerminal ? '' : ' (poll timed out)'}</dd>
      <dt>Jev v1 session</dt><dd><code>${esc(JEV_V1.sessionId)}</code></dd>
      <dt>LLM baseline</dt><dd><code>${esc(BASELINE.sessionId)}</code></dd>
      <dt>URL</dt><dd>${esc(snapshot.url)}</dd>
      <dt>Git SHA</dt><dd><code>${esc(snapshot.gitSha)}</code></dd>
      <dt>plan_explore</dt><dd>${esc(snapshot.planExploreBackend)} / ${esc(snapshot.jevModel)}</dd>
      <dt>Prompt versions</dt><dd>${esc(promptVersions)}</dd>
      <dt>Fill and remaining LLM</dt><dd>${esc(snapshot.fillModel)}</dd>
      <dt>Started</dt><dd>${esc(snapshot.startedAt)}</dd>
      <dt>Finished</dt><dd>${esc(snapshot.finishedAt)}</dd>
    </dl>

    <h2>What this run changes</h2>
    ${keyExpired ? `<p class="fail">This is an infrastructure abort, not a planner result. The four <code>mr_plan</code> rows have no tokens and no latency because OpenRouter rejected the key before a completion. <code>plan_explore</code> was never called, so there is nothing to compare on Jev latency or cost yet.</p>` : ''}
    <p>This session uses compact Jev state and independent questions (<code>plan-explore-jev-v2</code>). The assembler picks overlay, complete, next control, or scroll in code. Follow-up search fill reuses the source query. Graph sends the snapshot URL. Only the explore-loop planner is Jev. <code>mr_plan</code>, <code>explore_verify</code>, observe, and unconstrained fill still go through ${esc(snapshot.llmModel)}.</p>
    <p>The LLM baseline ran on 9 July 2026. Amazon.es has almost certainly shifted since then, so a family that fails here is not automatically a planner regression. Jev v1 ran the same day as v2, so that pair is the fairer outcome check. Cost and latency on <code>plan_explore</code> stay the cleanest comparison because those calls are the thing we swapped.</p>

    <h2>Family outcomes</h2>
    <table>
      <thead>
        <tr>
          <th>Family</th>
          <th>LLM baseline</th>
          <th>Jev v1</th>
          <th>Jev v2</th>
          <th>LLM cost</th>
          <th>Jev v1 cost</th>
          <th>Jev v2 cost</th>
        </tr>
      </thead>
      <tbody>
        ${familyRows}
      </tbody>
    </table>

    <h2>Call mix on the Jev session</h2>
    <p>${formatInt(jevPlanCalls.length)} of ${formatInt(planCalls.length)} <code>plan_explore</code> rows used ${esc(snapshot.jevModel)}.
    Median Jev plan latency is ${esc(formatMs(median(planLatencies)))} against a baseline session median of 7.9 s across all LLM calls.
    ${formatInt(fillCalls.length)} of those plans also paid for a fill completion.</p>
    <table>
      <thead>
        <tr><th>Purpose</th><th>Calls</th><th>Tokens in</th><th>Tokens out</th><th>Latency sum</th><th>Cost</th></tr>
      </thead>
      <tbody>${purposeRows}</tbody>
    </table>
    <table>
      <thead>
        <tr><th>Model</th><th>Calls</th><th>Tokens in</th><th>Tokens out</th><th>Latency sum</th><th>Cost</th></tr>
      </thead>
      <tbody>${modelRows}</tbody>
    </table>
    <p class="muted">Jev list price used here is $0.042 / M input and $0 output. Minimax remains $0.30 / $1.20 per M. Fill tokens stored inside a Jev <code>plan_explore</code> row are billed at the Minimax rate when the nested fill audit is present.</p>

    <h2>Session totals versus Jev v1 and LLM</h2>
    <table>
      <thead>
        <tr><th></th><th>LLM baseline</th><th>Jev v1</th><th>Jev v2</th></tr>
      </thead>
      <tbody>
        <tr><td>Wall clock</td><td>${esc(formatMs(BASELINE.wallMs))}</td><td>${esc(formatMs(JEV_V1.wallMs))}</td><td>${esc(formatMs(snapshot.wallMs))}</td></tr>
        <tr><td>Call count</td><td>${formatInt(BASELINE.callCount)}</td><td>${formatInt(JEV_V1.callCount)}</td><td>${formatInt(snapshot.totals.callCount)}</td></tr>
        <tr><td>Tokens in</td><td>${formatInt(BASELINE.tokensIn)}</td><td>${formatInt(JEV_V1.tokensIn)}</td><td>${formatInt(snapshot.totals.tokensIn)}</td></tr>
        <tr><td>Tokens out</td><td>${formatInt(BASELINE.tokensOut)}</td><td>${formatInt(JEV_V1.tokensOut)}</td><td>${formatInt(snapshot.totals.tokensOut)}</td></tr>
        <tr><td>Model time sum</td><td>${esc(formatMs(BASELINE.latencyMs))}</td><td>${esc(formatMs(JEV_V1.latencyMs))}</td><td>${esc(formatMs(snapshot.totals.latencyMs))}</td></tr>
        <tr><td>Estimated cost</td><td>${esc(formatUsd(BASELINE.costUsd))}</td><td>${esc(formatUsd(JEV_V1.costUsd))}</td><td>${esc(formatUsd(snapshot.totals.costUsd))}</td></tr>
        <tr><td>Families compiled</td><td>${baselineSuccess} / 4</td><td>${v1Success} / 4</td><td>${jevSuccess} / 4</td></tr>
      </tbody>
    </table>

    <h2>Plans and compiled steps</h2>
    ${familyDetail}

    <h2>How to read this</h2>
    <p>If the v2 questions are doing their job, families should stop dying on <code>Low confidence on operation=…</code>, follow-up fills should keep the source query, and <code>plan_explore</code> latency should stay in hundreds of milliseconds. Verify still dominates wall clock because it is vision plus Minimax.</p>
    <p>This file does not update <code>scripts/validation/out/batch-manifest.json</code>. The thesis Amazon generation 1 row stays ${esc(BASELINE.sessionId)}. Jev v1 stays in <code>report.html</code>.</p>
  </main>
</body>
</html>
`;
}

async function main(): Promise<void> {
  const apiUrl = process.env.API_URL ?? 'http://localhost:3001';
  await mkdir(OUT_DIR, { recursive: true });

  const existingId = process.env.JEV_AMAZON_SESSION_ID?.trim();
  const api = createValidationApiClient();
  let startedAt = new Date().toISOString();
  let sessionId = existingId ?? '';
  let allTerminal = true;

  if (!existingId) {
    console.log(`Waiting for API at ${apiUrl}`);
    await waitForApi(apiUrl);
    console.log(`Creating Amazon session at ${AMAZON_URL}`);
    startedAt = new Date().toISOString();
    const created = await api.createSession({
      url: AMAZON_URL,
      mode: 'auto',
      weakOracle: false,
      transformFamilies: [...TRANSFORM_FAMILIES],
    });
    sessionId = created.sessionId;
    console.log(`Session created: ${sessionId}`);
    const poll = await pollSessionUntilTerminal(api, sessionId, {
      maxIterations: 360,
      intervalMs: 10_000,
    });
    allTerminal = poll.allTerminal;
    if (!allTerminal) {
      console.warn(`Session ${sessionId} did not reach a terminal state before the poll limit`);
    }
  } else {
    console.log(`Reusing session ${existingId}`);
    try {
      const session = await api.getSession(existingId);
      console.log(`Loaded session status snapshot (${session.jobs.length} jobs)`);
    } catch (error) {
      console.warn(`API lookup failed, extracting from Prisma anyway: ${String(error)}`);
    }
  }

  const finishedAt = new Date().toISOString();
  const snapshot = await extractSnapshot({
    sessionId,
    startedAt: existingId ? startedAt : startedAt,
    finishedAt,
    allTerminal,
  });

  if (existingId) {
    const firstCall = snapshot.calls[0]?.createdAt;
    const lastCall = snapshot.calls.at(-1)?.completedAt ?? snapshot.calls.at(-1)?.createdAt;
    if (firstCall && lastCall) {
      snapshot.startedAt = firstCall;
      snapshot.finishedAt = lastCall;
      snapshot.wallMs = Date.parse(lastCall) - Date.parse(firstCall);
    }
  }

  const snapshotPath = join(OUT_DIR, 'snapshot_v2.json');
  const reportPath = join(OUT_DIR, 'report_v2.html');
  await writeFile(snapshotPath, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
  await writeFile(reportPath, renderReport(snapshot), 'utf8');
  console.log(`Wrote ${snapshotPath}`);
  console.log(`Wrote ${reportPath}`);
  console.log(`session=${sessionId} compiled=${snapshot.families.filter((row) => row.explorationSuccess).length}/4 cost=${formatUsd(snapshot.totals.costUsd)}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectPrisma();
  });
