#!/usr/bin/env node
/**
 * E2E: session → discover → 4 explore jobs → draft_pending_hitl for each family.
 */
const API = process.env.API ?? 'http://localhost:3001';
const URL = process.env.E2E_URL ?? 'https://www.amazon.es/';
const EXPECTED_FAMILIES = ['idempotence', 'subset', 'permutation', 'inverse'];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function api(method, path, body, { expectJson = true } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`${method} ${path} → ${res.status}: ${text}`);
  }
  if (!expectJson) {
    return text;
  }
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`${method} ${path} → ${res.status}: ${text}`);
  }
}

function jobSummary(session) {
  return session.jobs.map((j) => `${j.type}:${j.status}`).join(', ');
}

function assertExplorationQuality(timeline, mrVersionId) {
  assert(
    timeline.validatedSteps.source.length >= 1,
    `source validated steps empty (mrVersion=${mrVersionId})`,
  );
  assert(
    timeline.validatedSteps.follow_up.length >= 1,
    `follow_up validated steps empty (mrVersion=${mrVersionId})`,
  );
  assert(
    timeline.checkpoints.some((c) => c.phase === 'source' && c.verdict === 'goal_reached'),
    'no source checkpoint with goal_reached',
  );
  assert(
    timeline.checkpoints.some((c) => c.phase === 'follow_up' && c.verdict === 'goal_reached'),
    'no follow_up checkpoint with goal_reached',
  );
}

async function assertPlaybookSmoke(mrVersionId, transformFamily) {
  const playbook = await api('GET', `/mr-versions/${mrVersionId}/playbook`, undefined, {
    expectJson: false,
  });
  assert(typeof playbook === 'string' && playbook.length > 0, 'playbook empty');
  assert(playbook.includes("test('source'"), "playbook missing source test");
  assert(playbook.includes("test('follow_up'"), "playbook missing follow_up test");
  assert(playbook.includes('extractObservation'), 'playbook missing observation extract');

  if (transformFamily === 'subset') {
    assert(playbook.includes('reported_total_results'), 'subset playbook missing reported_total_results');
  }

  return playbook;
}

async function waitForDraftMrs(sessionId) {
  for (let i = 1; i <= 180; i++) {
    const session = await api('GET', `/sessions/${sessionId}`);
    const mrVersions = session.mrVersions ?? [];
    const byFamily = new Map(mrVersions.map((mr) => [mr.transformFamily, mr]));
    const summary = EXPECTED_FAMILIES.map(
      (family) => `${family}:${byFamily.get(family)?.status ?? 'missing'}`,
    ).join(' | ');

    console.log(`[${i}/180] jobs=[${jobSummary(session)}] mrs=${summary}`);

    const failedJob = session.jobs.find(
      (j) =>
        j.status === 'failed' &&
        (j.type === 'discover' || j.type === 'explore'),
    );
    if (failedJob) {
      console.error('Job failed:', JSON.stringify(failedJob, null, 2));
      process.exit(1);
    }

    const allDraft =
      EXPECTED_FAMILIES.every((family) => byFamily.get(family)?.status === 'draft_pending_hitl');

    if (allDraft && mrVersions.length >= EXPECTED_FAMILIES.length) {
      return EXPECTED_FAMILIES.map((family) => byFamily.get(family));
    }

    await sleep(10_000);
  }

  throw new Error('Timeout waiting for 4 draft_pending_hitl MR versions');
}

async function main() {
  console.log('=== 1. Crear sesión', URL, '===');
  const created = await api('POST', '/sessions', { url: URL });
  console.log(JSON.stringify(created, null, 2));
  const sessionId = created.sessionId;

  console.log('\n=== 2. Esperar discover + 4 explore (draft_pending_hitl) ===');
  const mrVersions = await waitForDraftMrs(sessionId);

  for (const mr of mrVersions) {
    console.log(`\n=== 3. Quality gates for ${mr.transformFamily} (${mr.id}) ===`);
    const timeline = await api('GET', `/mr-versions/${mr.id}/exploration`);
    assertExplorationQuality(timeline, mr.id);
    await assertPlaybookSmoke(mr.id, mr.transformFamily);
    console.log('Quality gates passed');
  }

  const idempotenceMr = mrVersions.find((mr) => mr.transformFamily === 'idempotence');
  assert(idempotenceMr, 'idempotence MR missing');

  console.log('\n=== 4. Approve idempotence MR ===');
  await api('POST', `/mr-versions/${idempotenceMr.id}/approve`);

  console.log('\n=== 5. Execute idempotence MR ===');
  const exec = await api('POST', `/mr-versions/${idempotenceMr.id}/execute`);
  const runId = exec.runId;

  console.log('\n=== 6. Esperar run completado ===');
  for (let i = 1; i <= 60; i++) {
    const run = await api('GET', `/runs/${runId}`);
    console.log(`[${i}/60] run_status=${run.status} verdict_strict=${run.verdictStrict ?? 'null'}`);
    if (run.status === 'completed' || run.status === 'failed') {
      console.log('\n=== 7. Resultado final ===');
      console.log(JSON.stringify(run, null, 2));
      const passed = run.status === 'completed' && run.verdictStrict === 'pass';
      process.exit(passed ? 0 : 1);
    }
    await sleep(10_000);
  }

  console.error('Timeout esperando run');
  process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
