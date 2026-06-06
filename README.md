# Metamorph

Phase 1: API creates sessions and discover jobs in PostgreSQL; the Playwright worker captures page inventory and persists JSON to Postgres plus annotated PNG to MinIO.

**Playwright runs in Docker** — no need to install Chromium on the host.

## Prerequisites

- Node.js 22.13+ (API only)
- pnpm 11.5+
- Docker (Postgres, MinIO, worker)

## Quick start (phase 1)

```bash
# 1. Infra
docker compose up -d postgres minio minio-init

# 2. Database
cp .env.example .env   # if needed
pnpm db:push         # or pnpm db:migrate
pnpm db:generate

# 3. API (on host)
pnpm --filter @metamorph/api dev

# 4. Create session + discover job
curl -s -X POST localhost:3001/sessions \
  -H 'Content-Type: application/json' \
  -d '{"url":"https://example.com"}'
# → note sessionId and jobId

# 5. Run discover worker (Docker — builds image on first run)
pnpm discover <JOB_ID>

# 6. Verify
curl -s localhost:3001/health
curl -s localhost:3001/sessions/<SESSION_ID>
```

Equivalent without the helper script:

```bash
docker compose --profile workers build worker-playwright
docker compose --profile workers run --rm worker-playwright discover --job-id <JOB_ID>
```

## Services

| Service            | Port  | Where        | Notes                    |
|--------------------|-------|--------------|--------------------------|
| API                | 3001  | host         | Sessions, health         |
| Postgres           | 5432  | Docker       | `metamorph` / `metamorph`|
| MinIO              | 9000  | Docker       | Console: :9001           |
| worker-playwright  | —     | Docker       | `pnpm discover <jobId>`  |

## Dev utilities

| Command | Description |
|---------|-------------|
| `pnpm discover <job-id>` | Phase 1 worker in Docker |
| `pnpm inventory:capture -- <url>` | Capture to `packages/inventory/tmp/` (no DB) |

## Job lifecycle (no RabbitMQ yet)

| Status    | Meaning                    |
|-----------|----------------------------|
| `queued`  | Waiting for worker         |
| `running` | Worker processing          |
| `done`    | Snapshot persisted         |
| `failed`  | See `error_message` on job |

After a failed job, create a new one:

```bash
curl -s -X POST localhost:3001/sessions/<SESSION_ID>/discover
```
