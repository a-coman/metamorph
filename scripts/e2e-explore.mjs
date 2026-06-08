const API = process.env.API ?? 'http://localhost:3001';
const URL = process.env.E2E_URL ?? 'https://www.amazon.es/';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(method, path, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`${method} ${path} → ${res.status}: ${text}`);
  }
  if (!res.ok) {
    throw new Error(`${method} ${path} → ${res.status}: ${JSON.stringify(json)}`);
  }
  return json;
}

function jobSummary(session) {
  return session.jobs.map((j) => `${j.type}:${j.status}`).join(', ');
}

async function main() {
  console.log('=== 1. Crear sesión', URL, '===');
  const created = await api('POST', '/sessions', { url: URL });
  console.log(JSON.stringify(created, null, 2));
  const sessionId = created.sessionId;

  console.log('\n=== 2. Esperar discover + explore (draft_pending_hitl) ===');
  console.log('Requisito: workers Up — docker compose --profile workers ps');
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
        console.log(
          `  checkpoints=${timeline.checkpoints.length} validated_source=${timeline.validatedSteps.source.length} validated_follow_up=${timeline.validatedSteps.follow_up.length}`,
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
      console.error('Exploration failed:', JSON.stringify(mr, null, 2));
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

  console.log('\n=== 3. Timeline exploración ===');
  console.log(JSON.stringify(await api('GET', `/mr-versions/${mrVersionId}/exploration`), null, 2));

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
      process.exit(run.status === 'completed' ? 0 : 1);
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
