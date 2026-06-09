const API = process.env.API ?? 'http://localhost:3001';
const URL = process.env.E2E_URL ?? 'https://www.amazon.es/';

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

  if (timeline.checkpointStats) {
    const sourceFails = timeline.checkpointStats.source?.fail ?? 0;
    const sourceTotal =
      (timeline.checkpointStats.source?.ok ?? 0) +
      sourceFails +
      (timeline.checkpointStats.source?.goal_reached ?? 0);
    if (sourceTotal > 0 && sourceFails / sourceTotal > 0.5) {
      console.warn(
        `  warn: source checkpoint fail ratio high (${sourceFails}/${sourceTotal})`,
      );
    }
  }
}

async function assertPlaybookSmoke(mrVersionId) {
  const playbook = await api('GET', `/mr-versions/${mrVersionId}/playbook`, undefined, {
    expectJson: false,
  });
  assert(typeof playbook === 'string' && playbook.length > 0, 'playbook empty');
  assert(playbook.includes("test('source'"), "playbook missing source test");
  assert(playbook.includes("test('follow_up'"), "playbook missing follow_up test");
  assert(playbook.includes('extractObservation'), 'playbook missing observation extract');
  return playbook;
}

async function main() {
  console.log('=== 1. Crear sesión', URL, '===');
  const created = await api('POST', '/sessions', { url: URL });
  console.log(JSON.stringify(created, null, 2));
  const sessionId = created.sessionId;

  console.log('\n=== 2. Esperar discover + explore (draft_pending_hitl) ===');
  console.log(
    'Requisito: API en host + docker compose up -d worker-playwright worker-llm',
  );
  let mrVersionId = null;
  let mrStatus = 'none';
  for (let i = 1; i <= 120; i++) {
    const session = await api('GET', `/sessions/${sessionId}`);
    const mr = session.mrVersions?.[0];
    const status = mr?.status ?? 'none';
    mrStatus = status;
    mrVersionId = mr?.id ?? null;
    console.log(`[${i}/120] jobs=[${jobSummary(session)}] mr_version_status=${status}`);

    if (mrVersionId && (status === 'exploring' || status === 'draft_pending_hitl')) {
      try {
        const timeline = await api('GET', `/mr-versions/${mrVersionId}/exploration`);
        const stats = timeline.checkpointStats;
        const statsLine = stats
          ? ` source=${JSON.stringify(stats.source)} follow_up=${JSON.stringify(stats.follow_up)}`
          : '';
        console.log(
          `  checkpoints=${timeline.checkpoints.length} validated_source=${timeline.validatedSteps.source.length} validated_follow_up=${timeline.validatedSteps.follow_up.length}${statsLine}`,
        );
      } catch {
        // exploration endpoint may not be ready yet
      }
    }

    const failed = session.jobs.find(
      (j) =>
        j.status === 'failed' &&
        (j.type === 'discover' || j.type === 'explore'),
    );
    if (failed) {
      console.error('Job failed:', JSON.stringify(failed, null, 2));
      process.exit(1);
    }

    if (status === 'exploration_failed') {
      let failureDetail = '';
      if (mrVersionId) {
        try {
          const timeline = await api('GET', `/mr-versions/${mrVersionId}/exploration`);
          failureDetail = timeline.failureReason
            ? `\nfailureReason: ${timeline.failureReason}`
            : '';
          console.error('Exploration timeline:', JSON.stringify(timeline, null, 2));
        } catch {
          // ignore
        }
      }
      console.error('Exploration failed:', JSON.stringify(mr, null, 2), failureDetail);
      process.exit(1);
    }

    if (status === 'draft_pending_hitl' && mrVersionId) break;
    await sleep(10_000);
  }

  if (!mrVersionId || mrStatus !== 'draft_pending_hitl') {
    const session = await api('GET', `/sessions/${sessionId}`);
    console.error(
      `Timeout esperando draft_pending_hitl (status=${mrStatus}):`,
      JSON.stringify(session, null, 2),
    );
    process.exit(1);
  }
  console.log('MR_VERSION_ID=', mrVersionId);

  console.log('\n=== 3. Timeline exploración + quality gates ===');
  const timeline = await api('GET', `/mr-versions/${mrVersionId}/exploration`);
  console.log(JSON.stringify(timeline, null, 2));
  assertExplorationQuality(timeline, mrVersionId);
  await assertPlaybookSmoke(mrVersionId);
  console.log('Quality gates passed');

  console.log('\n=== 4. Approve ===');
  console.log(JSON.stringify(await api('POST', `/mr-versions/${mrVersionId}/approve`), null, 2));

  console.log('\n=== 5. Execute ===');
  const exec = await api('POST', `/mr-versions/${mrVersionId}/execute`);
  console.log(JSON.stringify(exec, null, 2));
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
  console.log(JSON.stringify(await api('GET', `/runs/${runId}`), null, 2));
  process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
