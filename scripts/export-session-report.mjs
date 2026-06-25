/**
 * Export session activity to a self-contained HTML report.
 * Usage: node scripts/export-session-report.mjs <sessionId> [apiBase]
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

const sessionId = process.argv[2];
const apiBase = process.argv[3] ?? 'http://localhost:3001';

if (!sessionId) {
  console.error('Usage: node scripts/export-session-report.mjs <sessionId> [apiBase]');
  process.exit(1);
}

async function fetchJson(path) {
  const res = await fetch(`${apiBase}${path}`);
  if (!res.ok) throw new Error(`${path}: ${res.status} ${await res.text()}`);
  return res.json();
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatJson(obj) {
  return escapeHtml(JSON.stringify(obj, null, 2));
}

function ts(d) {
  return new Date(d).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'medium' });
}

async function resolveSnapshotImage(snapshotId, cache) {
  if (!snapshotId) return null;
  if (cache[snapshotId]?.imageUrl) return cache[snapshotId].imageUrl;

  let snap = cache[snapshotId];
  if (!snap?.fetched) {
    try {
      const data = await fetchJson(`/page-snapshots/${snapshotId}`);
      snap = {
        fetched: true,
        url: data.url,
        artifactId:
          data.annotatedScreenshotArtifactId ?? data.rawScreenshotArtifactId ?? null,
        imageUrl: null,
      };
    } catch {
      snap = { fetched: true, url: null, artifactId: null, imageUrl: null };
    }
    cache[snapshotId] = snap;
  }

  if (snap.artifactId && !snap.imageUrl) {
    try {
      const { url } = await fetchJson(`/artifacts/${snap.artifactId}/url`);
      snap.imageUrl = url;
    } catch {
      /* ignore */
    }
  }

  return snap.imageUrl;
}

async function main() {
  const session = await fetchJson(`/sessions/${sessionId}`);
  const activity = await fetchJson(`/sessions/${sessionId}/activity`);

  const snapshotCache = {};

  // Pre-resolve all snapshot images
  const snapshotIds = new Set();
  for (const s of activity.screenshots) snapshotIds.add(s.snapshotId);
  for (const c of activity.checkpoints) snapshotIds.add(c.snapshotId);
  for (const p of activity.probes) {
    if (p.outputSnapshotId) snapshotIds.add(p.outputSnapshotId);
  }
  for (const llm of activity.llmCalls) {
    const inv = llm.responseJson?.inventorySnapshotId;
    if (inv) snapshotIds.add(inv);
  }

  for (const id of snapshotIds) {
    await resolveSnapshotImage(id, snapshotCache);
  }

  // Build unified timeline
  const events = [];

  for (const llm of activity.llmCalls) {
    events.push({
      at: new Date(llm.createdAt).getTime(),
      kind: 'llm',
      data: llm,
    });
  }

  for (const probe of activity.probes) {
    events.push({
      at: new Date(probe.createdAt).getTime(),
      kind: 'probe_start',
      data: probe,
    });
    if (probe.status !== 'running' && probe.status !== 'queued') {
      events.push({
        at: new Date(probe.updatedAt).getTime(),
        kind: 'probe_end',
        data: probe,
      });
    }
  }

  for (const cp of activity.checkpoints) {
    events.push({
      at: new Date(cp.createdAt).getTime(),
      kind: 'checkpoint',
      data: cp,
    });
  }

  events.sort((a, b) => a.at - b.at || (a.kind < b.kind ? -1 : 1));

  const failedProbes = activity.probes.filter((p) => p.status === 'failed');
  const permutationMr = session.mrVersions?.find((m) => m.transformFamily === 'permutation');
  const idempotenceMr = session.mrVersions?.find((m) => m.transformFamily === 'idempotence');

  let body = '';

  // Summary
  body += `<section class="summary">
<h2>Resumen</h2>
<ul>
<li><strong>Session:</strong> ${escapeHtml(sessionId)}</li>
<li><strong>URL:</strong> ${escapeHtml(session.url)}</li>
<li><strong>Modo:</strong> ${escapeHtml(session.mode)}</li>
<li><strong>Familias:</strong> ${escapeHtml(session.transformFamilies?.join(', ') ?? '')}</li>
<li><strong>MR idempotence:</strong> ${escapeHtml(idempotenceMr?.status ?? '—')} (${escapeHtml(idempotenceMr?.id ?? '')})</li>
<li><strong>MR permutation:</strong> ${escapeHtml(permutationMr?.status ?? '—')} (${escapeHtml(permutationMr?.id ?? '')})</li>
<li><strong>LLM calls:</strong> ${activity.llmCalls.length}</li>
<li><strong>Probes:</strong> ${activity.probes.length} (${failedProbes.length} failed)</li>
<li><strong>Checkpoints:</strong> ${activity.checkpoints.length}</li>
</ul>
`;

  if (failedProbes.length > 0) {
    const err = failedProbes[0].error ?? '';
    body += `<div class="alert">
<h3>Diagnóstico probable</h3>
<p>La exploración <strong>permutation</strong> está atascada: los probes fallan al re-ejecutar el prefijo validado.
El locator <code>getByRole('link', { name: 'De 0 a 15 EUR' })</code> (elemento E5 en un batch anterior) no se encuentra en la página tras 30s.</p>
<p><strong>Error:</strong> ${escapeHtml(err.slice(0, 500))}</p>
<p>El LLM sigue proponiendo scroll/click pero cada probe reintenta el click en E5 del historial y timeout.</p>
</div>`;
  }

  body += '</section>';

  // Timeline
  body += '<section><h2>Timeline</h2>';

  for (const ev of events) {
    if (ev.kind === 'llm') {
      const llm = ev.data;
      const invSnap = llm.responseJson?.inventorySnapshotId;
      const imgUrl = invSnap ? snapshotCache[invSnap]?.imageUrl : null;
      const family = llm.transformFamily ?? '—';
      const statusClass = llm.status === 'failed' ? 'failed' : llm.status === 'done' ? 'done' : 'running';

      body += `<article class="event llm ${statusClass}">
<header>
<span class="badge">${escapeHtml(llm.purpose)}</span>
<span class="family">${escapeHtml(family)}</span>
<span class="time">${ts(llm.createdAt)}</span>
<span class="status">${escapeHtml(llm.status)}</span>
</header>
<div class="meta">
<p><strong>Model:</strong> ${escapeHtml(llm.model)} · <strong>Prompt:</strong> ${escapeHtml(llm.promptVersion)}
 · <strong>Tokens:</strong> ${llm.tokensIn ?? '—'} in / ${llm.tokensOut ?? '—'} out
 · <strong>Latency:</strong> ${llm.latencyMs ?? '—'} ms</p>
<p><strong>LLM call ID:</strong> <code>${escapeHtml(llm.id)}</code></p>
${invSnap ? `<p><strong>Inventory snapshot:</strong> <code>${escapeHtml(invSnap)}</code></p>` : ''}
</div>
`;

      if (imgUrl) {
        body += `<figure><img src="${escapeHtml(imgUrl)}" alt="Screenshot at LLM call" loading="lazy"/><figcaption>Screenshot de inventario enviado al LLM (vía imagen en user prompt)</figcaption></figure>`;
      }

      if (llm.systemPrompt) {
        body += `<details open><summary>System prompt</summary><pre>${escapeHtml(llm.systemPrompt)}</pre></details>`;
      }
      if (llm.userPrompt) {
        const imgMeta = llm.userPromptImages
          ? ` (${llm.userPromptImages.count} image(s): ${(llm.userPromptImages.labels ?? []).join(', ')})`
          : '';
        body += `<details open><summary>User prompt${escapeHtml(imgMeta)}</summary><pre>${escapeHtml(llm.userPrompt)}</pre></details>`;
      }

      body += `<details>
<summary>Respuesta del LLM</summary>
<pre>${formatJson(llm.responseJson)}</pre>
</details>
</article>`;
    } else if (ev.kind === 'probe_end') {
      const probe = ev.data;
      const statusClass = probe.status === 'failed' ? 'failed' : probe.status === 'done' ? 'done' : '';
      const imgUrl = probe.outputSnapshotId
        ? snapshotCache[probe.outputSnapshotId]?.imageUrl
        : null;

      body += `<article class="event probe ${statusClass}">
<header>
<span class="badge">probe ${escapeHtml(probe.status)}</span>
<span class="family">${escapeHtml(probe.transformFamily ?? '—')}</span>
<span class="time">${ts(probe.updatedAt)}</span>
</header>
<div class="meta">
<p><strong>Job:</strong> <code>${escapeHtml(probe.jobId)}</code>
 · <strong>Phase:</strong> ${escapeHtml(probe.phase ?? '—')}
 · <strong>Plan LLM:</strong> <code>${escapeHtml(probe.planLlmCallId ?? '—')}</code></p>
${probe.error ? `<p class="error"><strong>Error:</strong> ${escapeHtml(probe.error)}</p>` : ''}
</div>
`;

      if (probe.executedSteps?.length) {
        body += `<details><summary>Steps ejecutados (${probe.executedSteps.length})</summary><pre>${formatJson(probe.executedSteps)}</pre></details>`;
      }

      if (imgUrl) {
        body += `<figure><img src="${escapeHtml(imgUrl)}" alt="Probe output" loading="lazy"/><figcaption>Estado tras probe</figcaption></figure>`;
      }
      body += '</article>';
    } else if (ev.kind === 'checkpoint') {
      const cp = ev.data;
      const imgUrl = snapshotCache[cp.snapshotId]?.imageUrl;

      body += `<article class="event checkpoint">
<header>
<span class="badge">checkpoint</span>
<span class="family">${escapeHtml(cp.phase)} seq ${cp.sequence}</span>
<span class="time">${ts(cp.createdAt)}</span>
<span class="verdict">${escapeHtml(cp.verdict)}</span>
</header>
${cp.rationale ? `<p>${escapeHtml(cp.rationale)}</p>` : ''}
<details><summary>Steps validados</summary><pre>${formatJson(cp.stepsJson)}</pre></details>
`;

      if (imgUrl) {
        body += `<figure><img src="${escapeHtml(imgUrl)}" alt="Checkpoint" loading="lazy"/></figure>`;
      }
      body += '</article>';
    }
  }

  body += '</section>';

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Session report ${escapeHtml(sessionId)}</title>
<style>
:root { --bg: #0f1117; --card: #1a1d27; --text: #e4e4e7; --muted: #9ca3af; --accent: #60a5fa; --ok: #34d399; --fail: #f87171; --border: #2d3348; }
* { box-sizing: border-box; }
body { font-family: system-ui, -apple-system, sans-serif; background: var(--bg); color: var(--text); margin: 0; padding: 1.5rem; line-height: 1.5; }
h1 { font-size: 1.25rem; margin: 0 0 1rem; }
h2 { font-size: 1.1rem; margin: 1.5rem 0 0.75rem; border-bottom: 1px solid var(--border); padding-bottom: 0.25rem; }
.summary ul { margin: 0; padding-left: 1.25rem; }
.alert { background: #3b1f1f; border: 1px solid var(--fail); border-radius: 8px; padding: 1rem; margin: 1rem 0; }
.event { background: var(--card); border: 1px solid var(--border); border-radius: 8px; padding: 1rem; margin: 0.75rem 0; }
.event.failed { border-color: var(--fail); }
.event.done.probe { border-color: var(--ok); }
header { display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center; margin-bottom: 0.5rem; }
.badge { background: #2d3348; padding: 0.15rem 0.5rem; border-radius: 4px; font-weight: 600; font-size: 0.85rem; }
.family { color: var(--accent); font-size: 0.85rem; }
.time { color: var(--muted); font-size: 0.8rem; }
.status, .verdict { font-size: 0.8rem; font-weight: 600; }
.failed .status { color: var(--fail); }
.done .status, .verdict { color: var(--ok); }
.meta { font-size: 0.9rem; color: var(--muted); }
.meta p { margin: 0.25rem 0; }
.error { color: var(--fail); }
pre { background: #0a0c10; border: 1px solid var(--border); border-radius: 6px; padding: 0.75rem; overflow-x: auto; font-size: 0.78rem; max-height: 400px; }
figure { margin: 0.75rem 0; }
img { max-width: 100%; border-radius: 6px; border: 1px solid var(--border); }
figcaption { font-size: 0.75rem; color: var(--muted); margin-top: 0.25rem; }
.note { font-size: 0.8rem; color: var(--muted); font-style: italic; }
code { font-size: 0.85em; }
details { margin-top: 0.5rem; }
summary { cursor: pointer; color: var(--accent); }
</style>
</head>
<body>
<h1>Session report — ${escapeHtml(session.url)}</h1>
<p class="meta">Generado: ${ts(new Date())} · API: ${escapeHtml(apiBase)}</p>
${body}
</body>
</html>`;

  const outPath = join(process.cwd(), `session-${sessionId.slice(0, 8)}-report.html`);
  writeFileSync(outPath, html, 'utf8');
  console.log(`Written: ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
