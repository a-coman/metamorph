import { loadValidationEnv } from './env.js';
loadValidationEnv();
import { writeFile } from 'node:fs/promises';
import { createValidationApiClient } from './api.js';
import { loadManifest } from './manifest.js';
import { ensureOutDir, outPath } from './paths.js';
import { pollRunUntilTerminal } from './poll.js';
import {
  aggregateReplayResults,
  classifyReplayConsistency,
  selectReplaySample,
  type ReplayMrResult,
  type ReplayRunRecord,
} from './replay-consistency.js';

async function fetchRunRecord(
  api: ReturnType<typeof createValidationApiClient>,
  runId: string,
  kind: ReplayRunRecord['kind'],
): Promise<ReplayRunRecord> {
  const run = await api.getRun(runId);
  const source = run.observations.find((observation) => observation.role === 'source');
  const followUp = run.observations.find((observation) => observation.role === 'follow_up');

  return {
    kind,
    runId,
    status: run.status,
    verdictStrict: run.verdictStrict,
    sourcePayloadHash: source?.payloadHash ?? null,
    followUpPayloadHash: followUp?.payloadHash ?? null,
  };
}

async function main(): Promise<void> {
  const manifest = await loadManifest();
  if (!manifest) {
    throw new Error(`Manifest not found at ${outPath('batch-manifest.json')}. Run validation:batch first.`);
  }

  await ensureOutDir();
  const api = createValidationApiClient();
  const sample = selectReplaySample(manifest);

  console.log(`Replay sample size: ${sample.length}`);

  const results: ReplayMrResult[] = [];

  for (const item of sample) {
    console.log(`\n=== Replay MR ${item.mrVersionId} (${item.domain}/${item.transformFamily}) ===`);
    const runs: ReplayRunRecord[] = [];

    if (item.initialAutoRunId) {
      runs.push(await fetchRunRecord(api, item.initialAutoRunId, 'initial_auto'));
    }

    for (let attempt = 1; attempt <= 2; attempt += 1) {
      console.log(`Enqueue replay execute ${attempt}/2`);
      const executed = await api.executeMrVersion(item.mrVersionId);
      await pollRunUntilTerminal(api, executed.runId);
      runs.push(await fetchRunRecord(api, executed.runId, 'replay'));
    }

    const consistencyClass = classifyReplayConsistency(runs);
    results.push({
      domain: item.domain,
      transformFamily: item.transformFamily,
      mrVersionId: item.mrVersionId,
      runs,
      consistencyClass,
    });

    console.log(`Consistency: ${consistencyClass}`);
  }

  const aggregate = aggregateReplayResults(results);
  const replayManifest = {
    createdAt: new Date().toISOString(),
    batchId: manifest.batchId,
    sample: results.map((result) => ({
      domain: result.domain,
      transformFamily: result.transformFamily,
      mrVersionId: result.mrVersionId,
      runIds: result.runs.map((run) => ({ kind: run.kind, runId: run.runId })),
      consistencyClass: result.consistencyClass,
    })),
  };

  await writeFile(outPath('replay-manifest.json'), `${JSON.stringify(replayManifest, null, 2)}\n`, 'utf8');
  await writeFile(outPath('replay-results.json'), `${JSON.stringify(aggregate, null, 2)}\n`, 'utf8');

  console.log(`\nWrote ${outPath('replay-manifest.json')}`);
  console.log(`Wrote ${outPath('replay-results.json')}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
