import { loadValidationEnv } from './env.js';
loadValidationEnv();
import { readFile } from 'node:fs/promises';
import { writeFile } from 'node:fs/promises';
import { formatUsd } from './llm-pricing.js';
import { loadManifest } from './manifest.js';
import { outPath, ensureOutDir } from './paths.js';
import {
  countColumnValues,
  formatMs,
  formatPercent,
  hasFilledColumn,
  mdTable,
  summarizeNumericBlock,
  yesNoRates,
} from './summary-format.js';

async function readJsonOptional<T>(filename: string): Promise<T | null> {
  try {
    const raw = await readFile(outPath(filename), 'utf8');
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function readCsvOptional(filename: string): Promise<Array<Record<string, string>>> {
  try {
    return await readCsv(outPath(filename));
  } catch {
    return [];
  }
}

function section(title: string, body: string): string {
  return `## ${title}\n\n${body}\n`;
}

async function main(): Promise<void> {
  const manifest = await loadManifest();
  const rq1 = await readJsonOptional<Record<string, unknown>>('metrics-rq1.json');
  const rq2 = await readJsonOptional<Record<string, unknown>>('metrics-rq2.json');
  const rq3 = await readJsonOptional<Record<string, unknown>>('metrics-rq3.json');
  const replay = await readJsonOptional<Record<string, unknown>>('replay-results.json');
  const failureReasons = await readCsvOptional('failure-reasons.csv');
  const triageRows = await readCsvOptional('rq3-verdict-triage.csv');
  const qualityRows = await readCsvOptional('rq3-mr-quality.csv');

  const lines: string[] = ['# Validation Summary\n'];

  if (manifest) {
    const dates = manifest.sessions.map((session) => session.finishedAt).sort();
    lines.push(
      section(
        'Batch metadata',
        [
          `- Batch ID: ${manifest.batchId}`,
          `- Git SHA: ${manifest.config.gitSha}`,
          `- Model: ${manifest.config.openrouterModel}`,
          `- Locale: ${manifest.config.playwrightLocale}`,
          `- Sessions recorded: ${manifest.sessions.length}`,
          `- Date range: ${dates[0] ?? 'n/a'} → ${dates[dates.length - 1] ?? 'n/a'}`,
        ].join('\n'),
      ),
    );

    lines.push(
      section(
        'Controlled variables',
        mdTable(
          ['Variable', 'Setting'],
          [
            ['Session mode', manifest.config.sessionMode],
            ['Transform families', manifest.config.transformFamilies.join(', ')],
            ['Browser locale', manifest.config.playwrightLocale],
            ['Weak oracle', String(manifest.config.weakOracle)],
            ['LLM model', manifest.config.openrouterModel],
          ],
        ),
      ),
    );
  }

  if (rq1) {
    const exploration = rq1.exploration as {
      totalAttempts: number;
      successes: number;
      failures: number;
      successRate: number | null;
      failureRate: number | null;
      byFamily: Record<string, { attempts: number; successes: number; successRate: number | null }>;
      byDomain: Record<string, { attempts: number; successes: number; successRate: number | null }>;
      domainFamilyCrossTab: Record<string, Record<string, { attempts: number; successes: number; successRate: number | null }>>;
    };

    lines.push(
      section(
        'RQ1: Exploration feasibility',
        [
          mdTable(
            ['Metric', 'Value'],
            [
              ['Total attempts', String(exploration.totalAttempts)],
              ['Successes', String(exploration.successes)],
              ['Failures', String(exploration.failures)],
              ['Success rate', formatPercent(exploration.successRate)],
              ['Failure rate', formatPercent(exploration.failureRate)],
            ],
          ),
          '### Per family\n',
          mdTable(
            ['Family', 'Attempts', 'Successes', 'Success rate'],
            Object.entries(exploration.byFamily).map(([family, row]) => [
              family,
              String(row.attempts),
              String(row.successes),
              formatPercent(row.successRate),
            ]),
          ),
          '### Per domain\n',
          mdTable(
            ['Domain', 'Attempts', 'Successes', 'Success rate'],
            Object.entries(exploration.byDomain).map(([domain, row]) => [
              domain,
              String(row.attempts),
              String(row.successes),
              formatPercent(row.successRate),
            ]),
          ),
          '### Domain × family\n',
          mdTable(
            ['Domain', 'Family', 'Attempts', 'Successes', 'Success rate'],
            Object.entries(exploration.domainFamilyCrossTab).flatMap(([domain, families]) =>
              Object.entries(families).map(([family, row]) => [
                domain,
                family,
                String(row.attempts),
                String(row.successes),
                formatPercent(row.successRate),
              ]),
            ),
          ),
        ].join('\n'),
      ),
    );

    const probes = rq1.probes as {
      sessionAggregate: { total: number; failed: number; failureRate: number | null };
      perSuccessfulMr: Array<{ total: number; failed: number; failureRate: number | null }>;
    };
    const mrProbeRates = probes.perSuccessfulMr
      .map((row) => row.failureRate)
      .filter((value): value is number => value !== null);

    lines.push(
      section(
        'RQ1: Probe failure rate',
        [
          mdTable(
            ['Scope', 'Total probes', 'Failed', 'Failure rate'],
            [
              [
                'Per session (aggregate)',
                String(probes.sessionAggregate.total),
                String(probes.sessionAggregate.failed),
                formatPercent(probes.sessionAggregate.failureRate),
              ],
              [
                'Per successful MR (aggregate of per-MR rates)',
                String(probes.perSuccessfulMr.length),
                String(probes.perSuccessfulMr.reduce((sum, row) => sum + row.failed, 0)),
                formatPercent(
                  probes.perSuccessfulMr.reduce((sum, row) => sum + row.failed, 0) /
                    Math.max(probes.perSuccessfulMr.reduce((sum, row) => sum + row.total, 0), 1),
                ),
              ],
            ],
          ),
          summarizeNumericBlock(
            'Per successful MR failure rate distribution',
            {
              count: mrProbeRates.length,
              median: median(mrProbeRates),
              q1: percentile(mrProbeRates, 0.25),
              q3: percentile(mrProbeRates, 0.75),
              min: mrProbeRates[0] ?? null,
              max: mrProbeRates[mrProbeRates.length - 1] ?? null,
            },
            formatPercent,
          ),
        ].join('\n'),
      ),
    );

    const validatedSteps = rq1.validatedSteps as {
      summary: {
        source: { count: number; median: number | null; q1: number | null; q3: number | null; min: number | null; max: number | null };
        followUp: { count: number; median: number | null; q1: number | null; q3: number | null; min: number | null; max: number | null };
      };
    };
    lines.push(
      section(
        'RQ1: Validated steps (successful MRs)',
        [
          summarizeNumericBlock('Source steps', validatedSteps.summary.source),
          summarizeNumericBlock('Follow-up steps', validatedSteps.summary.followUp),
        ].join('\n'),
      ),
    );

    const llmCost = rq1.llmCost as {
      pricing: { tokensIn: number; tokensOut: number };
      latencyNote: string;
      successfulMrs: {
        aggregate: {
          callCount: number;
          tokensIn: number;
          tokensOut: number;
          latencyMs: number;
          costUsd: number;
          latencyPerCall: {
            count: number;
            median: number | null;
          };
          latencyPerMr: {
            count: number;
            median: number | null;
          };
        };
      };
      perSession: Array<{
        domain: string;
        generation: number;
        callCount: number;
        tokensIn: number;
        tokensOut: number;
        latencyMs: number;
        costUsd: number;
        latencyPerCall: { median: number | null };
      }>;
      perSessionFamily: Array<{
        domain: string;
        generation: number;
        transformFamily: string;
        explorationSuccess: boolean;
        callCount: number;
        tokensIn: number;
        tokensOut: number;
        latencyMs: number;
        costUsd: number;
        latencyPerCall: { median: number | null };
      }>;
      perFamily: Array<{
        transformFamily: string;
        attempts: number;
        callCount: number;
        tokensIn: number;
        tokensOut: number;
        latencyMs: number;
        costUsd: number;
        latencyPerCall: { median: number | null };
      }>;
      total: {
        callCount: number;
        tokensIn: number;
        tokensOut: number;
        latencyMs: number;
        costUsd: number;
      };
    };
    const agg = llmCost.successfulMrs.aggregate;
    lines.push(
      section(
        'RQ1: LLM cost (successful MRs)',
        [
          `_${llmCost.latencyNote}._`,
          mdTable(
            ['Metric', 'Value'],
            [
              ['Price (in / out per 1M)', `$${llmCost.pricing.tokensIn} / $${llmCost.pricing.tokensOut}`],
              ['LLM calls', String(agg.callCount)],
              ['Tokens in', String(agg.tokensIn)],
              ['Tokens out', String(agg.tokensOut)],
              ['Latency sum (all calls)', formatMs(agg.latencyMs)],
              ['Latency median per call', formatMs(agg.latencyPerCall.median)],
              ['Latency median per MR', formatMs(agg.latencyPerMr.median)],
              ['Cost (successful MRs)', formatUsd(agg.costUsd)],
            ],
          ),
        ].join('\n\n'),
      ),
    );

    lines.push(
      section(
        'RQ1: LLM cost per session (all families)',
        [
          mdTable(
            ['Domain', 'Gen', 'Calls', 'Tokens in', 'Tokens out', 'Latency sum', 'Median/call', 'Cost USD'],
            llmCost.perSession.map((session) => [
              session.domain,
              String(session.generation),
              String(session.callCount),
              String(session.tokensIn),
              String(session.tokensOut),
              formatMs(session.latencyMs),
              formatMs(session.latencyPerCall.median),
              formatUsd(session.costUsd),
            ]),
          ),
          '### Per family (within sessions)\n',
          mdTable(
            [
              'Domain',
              'Gen',
              'Family',
              'Success',
              'Calls',
              'Tokens in',
              'Tokens out',
              'Latency sum',
              'Median/call',
              'Cost USD',
            ],
            llmCost.perSessionFamily.map((row) => [
              row.domain,
              String(row.generation),
              row.transformFamily,
              row.explorationSuccess ? 'yes' : 'no',
              String(row.callCount),
              String(row.tokensIn),
              String(row.tokensOut),
              formatMs(row.latencyMs),
              formatMs(row.latencyPerCall.median),
              formatUsd(row.costUsd),
            ]),
          ),
          '### Aggregate per family (all sessions)\n',
          mdTable(
            ['Family', 'Attempts', 'Calls', 'Tokens in', 'Tokens out', 'Latency sum', 'Median/call', 'Cost USD'],
            llmCost.perFamily.map((row) => [
              row.transformFamily,
              String(row.attempts),
              String(row.callCount),
              String(row.tokensIn),
              String(row.tokensOut),
              formatMs(row.latencyMs),
              formatMs(row.latencyPerCall.median),
              formatUsd(row.costUsd),
            ]),
          ),
          mdTable(
            ['Metric', 'Value'],
            [
              ['Total sessions', String(llmCost.perSession.length)],
              ['Total LLM calls', String(llmCost.total.callCount)],
              ['Total tokens in', String(llmCost.total.tokensIn)],
              ['Total tokens out', String(llmCost.total.tokensOut)],
              ['Total latency sum', formatMs(llmCost.total.latencyMs)],
              ['Total cost USD', formatUsd(llmCost.total.costUsd)],
            ],
          ),
        ].join('\n\n'),
      ),
    );

    const timeToDraft = rq1.timeToDraft as {
      count: number;
      median: number | null;
      q1: number | null;
      q3: number | null;
      min: number | null;
      max: number | null;
    };
    lines.push(
      section('RQ1: Time to draft', summarizeNumericBlock('Wall clock', timeToDraft, formatMs)),
    );

    const phase = rq1.phaseDecomposition as Record<string, unknown>;
    lines.push(
      section(
        'RQ1: Phase decomposition',
        mdTable(
          ['Phase', 'Detail'],
          [
            ['Plan', formatLlmPhase(phase.plan)],
            ['Explore loop', formatLlmPhase(phase.exploreLoop)],
            ['Probes wall time', formatNumericPhase(phase.probes)],
            ['Smoke wall time', formatNumericPhase(phase.smoke)],
            ['Observe', formatLlmPhase(phase.observe)],
            ['Compile', JSON.stringify(phase.compile)],
          ],
        ),
      ),
    );
  }

  if (rq2) {
    const executeCompletion = rq2.executeCompletion as {
      compiledMrs: number;
      completedRuns: number;
      completionRate: number | null;
      byDomain: Record<string, { compiled: number; completed: number; completionRate: number | null }>;
    };
    const replayDuration = rq2.replayDuration as {
      count: number;
      median: number | null;
      q1: number | null;
      q3: number | null;
      min: number | null;
      max: number | null;
    };

    lines.push(
      section(
        'RQ2: Execute completion',
        [
          mdTable(
            ['Metric', 'Value'],
            [
              ['Compiled MRs', String(executeCompletion.compiledMrs)],
              ['Completed initial runs', String(executeCompletion.completedRuns)],
              ['Completion rate', formatPercent(executeCompletion.completionRate)],
            ],
          ),
          '### By domain\n',
          mdTable(
            ['Domain', 'Compiled', 'Completed', 'Completion rate'],
            Object.entries(executeCompletion.byDomain).map(([domain, row]) => [
              domain,
              String(row.compiled),
              String(row.completed),
              formatPercent(row.completionRate),
            ]),
          ),
        ].join('\n'),
      ),
    );

    lines.push(
      section(
        'RQ2: Replay duration (initial auto runs)',
        summarizeNumericBlock('Execute pair wall time', replayDuration, formatMs),
      ),
    );
  }

  if (replay) {
    const overall = replay.overall as Record<string, number | null>;
    const byDomain = replay.byDomain as Record<string, Record<string, number | null>>;
    const byFamily = replay.byFamily as Record<string, Record<string, number | null>>;

    lines.push(
      section(
        'RQ2: Replay consistency',
        [
          mdTable(
            ['Class', 'Count', 'Rate'],
            [
              ['Stable', String(overall.stable ?? 0), formatPercent(overall.stableRate as number | null)],
              ['Verdict drift', String(overall.verdict_drift ?? 0), formatPercent(overall.verdictDriftRate as number | null)],
              ['Observation drift', String(overall.observation_drift ?? 0), formatPercent(overall.observationDriftRate as number | null)],
              ['Execute failure', String(overall.execute_failure ?? 0), formatPercent(overall.executeFailureRate as number | null)],
            ],
          ),
          '### By domain\n',
          mdTable(
            ['Domain', 'Stable', 'Verdict drift', 'Observation drift', 'Execute failure'],
            Object.entries(byDomain).map(([domain, row]) => [
              domain,
              String(row.stable ?? 0),
              String(row.verdict_drift ?? 0),
              String(row.observation_drift ?? 0),
              String(row.execute_failure ?? 0),
            ]),
          ),
          '### By family\n',
          mdTable(
            ['Family', 'Stable', 'Verdict drift', 'Observation drift', 'Execute failure'],
            Object.entries(byFamily).map(([family, row]) => [
              family,
              String(row.stable ?? 0),
              String(row.verdict_drift ?? 0),
              String(row.observation_drift ?? 0),
              String(row.execute_failure ?? 0),
            ]),
          ),
        ].join('\n'),
      ),
    );
  }

  if (rq3) {
    const strictVerdicts = rq3.strictVerdicts as {
      total: number;
      pass: number;
      fail: number;
      passRate: number | null;
      failRate: number | null;
      byFamily: Record<string, { total: number; pass: number; fail: number; passRate: number | null }>;
    };
    const observableItems = rq3.observableItems as {
      total: number;
      pass: number;
      fail: number;
      passRate: number | null;
      failRate: number | null;
      byFamily: Record<
        string,
        {
          total: number;
          pass: number;
          fail: number;
          passRate: number | null;
          failRate: number | null;
        }
      >;
    };

    lines.push(
      section(
        'RQ3: Strict verdicts',
        [
          mdTable(
            ['Metric', 'Value'],
            [
              ['Completed initial runs', String(strictVerdicts.total)],
              ['Pass', String(strictVerdicts.pass)],
              ['Fail', String(strictVerdicts.fail)],
              ['Pass rate', formatPercent(strictVerdicts.passRate)],
              ['Fail rate', formatPercent(strictVerdicts.failRate)],
            ],
          ),
          '### Per family\n',
          mdTable(
            ['Family', 'Total', 'Pass', 'Fail', 'Pass rate'],
            Object.entries(strictVerdicts.byFamily).map(([family, row]) => [
              family,
              String(row.total),
              String(row.pass),
              String(row.fail),
              formatPercent(row.passRate),
            ]),
          ),
          '### Observable-item outcomes (completed initial runs)\n',
          mdTable(
            ['Metric', 'Value'],
            [
              ['Evaluated observable items', String(observableItems.total)],
              ['Pass', String(observableItems.pass)],
              ['Fail', String(observableItems.fail)],
              ['Pass rate', formatPercent(observableItems.passRate)],
              ['Fail rate', formatPercent(observableItems.failRate)],
            ],
          ),
          '### Observable-item outcomes per family\n',
          mdTable(
            ['Family', 'Evaluated observable items', 'Pass', 'Fail', 'Pass rate', 'Fail rate'],
            Object.entries(observableItems.byFamily).map(([family, row]) => [
              family,
              String(row.total),
              String(row.pass),
              String(row.fail),
              formatPercent(row.passRate),
              formatPercent(row.failRate),
            ]),
          ),
        ].join('\n'),
      ),
    );
  }

  if (triageRows.length > 0) {
    if (hasFilledColumn(triageRows, 'triage')) {
      const counts = countColumnValues(triageRows, 'triage');
      const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
      lines.push(
        section(
          'RQ3: Verdict triage (manual)',
          mdTable(
            ['Label', 'Count', 'Rate'],
            Object.entries(counts).map(([label, count]) => [
              label,
              String(count),
              formatPercent(total ? count / total : null),
            ]),
          ),
        ),
      );
    } else {
      lines.push(
        section(
          'RQ3: Verdict triage (manual)',
          `_Pending manual triage for ${triageRows.length} failing run(s). Fill the \`triage\` column in \`rq3-verdict-triage.csv\` and re-run \`validation:summary\`._\n`,
        ),
      );
    }
  }

  const rubricColumns = [
    'meaningful_transformation',
    'observables_adequate',
    'observables_extracted_correctly',
  ];
  if (qualityRows.length > 0) {
    if (rubricColumns.some((column) => hasFilledColumn(qualityRows, column))) {
      const rates = yesNoRates(qualityRows, rubricColumns);
      lines.push(
        section(
          'RQ3: MR quality rubric (manual)',
          mdTable(
            ['Criterion', 'Yes', 'Answered', 'Yes rate'],
            rates.map((row) => [
              row.criterion,
              String(row.yes),
              String(row.total),
              formatPercent(row.yesRate),
            ]),
          ),
        ),
      );
    } else {
      lines.push(
        section(
          'RQ3: MR quality rubric (manual)',
          `_Pending manual review for ${qualityRows.length} compiled MR(s). Fill rubric columns in \`rq3-mr-quality.csv\` and re-run \`validation:summary\`._\n`,
        ),
      );
    }
  }

  if (failureReasons.length > 0) {
    const hasTaxonomy = hasFilledColumn(failureReasons, 'taxonomy');
    lines.push(
      section(
        'Exploration failure reasons',
        [
          '### Raw reasons\n',
          mdTable(
            ['Reason', 'Frequency'],
            failureReasons
              .slice()
              .sort((left, right) => Number(right.frequency) - Number(left.frequency))
              .map((row) => [row.reason ?? '', row.frequency ?? '0']),
          ),
          hasTaxonomy
            ? [
                '### Taxonomy\n',
                mdTable(
                  ['Category', 'Count'],
                  Object.entries(countColumnValues(failureReasons, 'taxonomy')).map(([category, count]) => [
                    category,
                    String(count),
                  ]),
                ),
              ].join('\n')
            : '_Taxonomy labeling pending. Fill `taxonomy` in `failure-reasons.csv` after the labeling script._\n',
        ].join('\n'),
      ),
    );
  }

  await ensureOutDir();
  await writeFile(outPath('summary.md'), lines.join('\n'), 'utf8');
  console.log(`Wrote ${outPath('summary.md')}`);
}

function formatLlmPhase(phase: unknown): string {
  if (!phase || typeof phase !== 'object') {
    return 'n/a';
  }
  const row = phase as {
    callCount?: number;
    tokensIn?: number;
    tokensOut?: number;
    latencyMs?: number;
    costUsd?: number;
    latencyPerCall?: { median?: number | null };
  };
  return [
    `calls=${row.callCount ?? 0}`,
    `tokensIn=${row.tokensIn ?? 0}`,
    `tokensOut=${row.tokensOut ?? 0}`,
    `latencySum=${formatMs(row.latencyMs ?? null)}`,
    `latencyMedian=${formatMs(row.latencyPerCall?.median ?? null)}`,
    `cost=${formatUsd(row.costUsd ?? 0)}`,
  ].join(', ');
}

function formatNumericPhase(phase: unknown): string {
  if (!phase || typeof phase !== 'object') {
    return 'n/a';
  }
  const row = phase as { count?: number; median?: number | null };
  return `n=${row.count ?? 0}, median=${formatMs(row.median ?? null)}`;
}

function median(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1]! + sorted[middle]!) / 2;
  }
  return sorted[middle]!;
}

function percentile(values: number[], p: number): number | null {
  if (values.length === 0) {
    return null;
  }
  const sorted = [...values].sort((left, right) => left - right);
  const index = (sorted.length - 1) * p;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) {
    return sorted[lower]!;
  }
  const weight = index - lower;
  return sorted[lower]! * (1 - weight) + sorted[upper]! * weight;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
