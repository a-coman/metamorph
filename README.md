# Metamorph

Metamorph is a research prototype for discovering and replaying metamorphic tests on arbitrary web interfaces. Given a user-supplied URL, it explores the rendered page, proposes candidate relations with bounded LLM assistance, compiles them into Playwright playbooks, and evaluates their source and follow-up executions with a strict deterministic verdict.

## The problem

End-to-end web tests often face the oracle problem: the expected result of one execution is difficult to define in advance. Dynamic content, asynchronous rendering, and changing layouts make fixed assertions costly and brittle.

Metamorphic testing addresses this problem by checking a relation between two executions instead of checking one absolute output. A metamorphic relation defines a source interaction, a transformed follow-up interaction, and an expected relation between their observations. For example, adding a restrictive filter should not increase the reported number of results.

Metamorph applies four relation families during discovery:

| Family | Expected relation |
| --- | --- |
| Idempotence | Repeating an action preserves the observable outcome. |
| Subset | Adding a restriction does not increase the result set. |
| Permutation | Reordering independent actions preserves the final state. |
| Inverse | Applying an action and undoing it restores the previous state. |

The LLM is used only during bounded exploration. Once a relation has been compiled and approved, replay executes fixed Playwright steps and evaluates predefined observations without further LLM inference.

## Workflow

```mermaid
flowchart LR
    A[URL] --> B[Page inventory]
    B --> C[LLM-guided exploration]
    C --> D[Compiled draft]
    D --> E{Review or auto-promotion}
    E --> F[Paired Playwright execution]
    F --> G[Strict verdict]
```

The browser worker builds a Set of Marks inventory that labels interactable page elements as `E1`, `E2`, and so on. The exploration worker uses that grounded inventory to propose and validate actions. Drafts can be reviewed in the web interface before promotion, while auto mode executes successful drafts immediately. Screenshots, Playwright traces, observations, and verdicts remain linked to the session for later triage.

## Workspace

The monorepo separates deployable applications from shared packages so that browser automation, LLM exploration, and deterministic replay use the same contracts and metamorphic semantics.

| Module | Kind | Responsibility |
| --- | --- | --- |
| `@metamorph/web` | App | Human-in-the-loop interface for sessions, live activity, review, and run triage. |
| `@metamorph/api` | App | REST API, job orchestration, artifact URLs, and server-sent events. |
| `@metamorph/worker-playwright` | App | Page inventory capture, exploration probes, and paired browser execution. |
| `@metamorph/worker-llm` | App | LangGraph-based exploration and draft-compilation orchestration. |
| `@metamorph/core` | Package | Shared MR schemas, relation engine, compiler, and Playwright playbook templates. |
| `@metamorph/inventory` | Package | Set of Marks inventory capture over Playwright. |
| `@metamorph/mr-promotion` | Package | Approval, auto-promotion, and execution-enqueueing use cases. |
| `@metamorph/contracts` | Package | Validated RabbitMQ messages and routing keys. |
| `@metamorph/api-client` | Package | Typed HTTP client and SSE helpers shared with the web app. |
| `@metamorph/session-control` | Package | Cooperative pause and resume signals across workers. |
| `@metamorph/utils` | Package | Shared domain and infrastructure utilities. |

PostgreSQL stores lifecycle state, Garage stores screenshots and traces through its S3 API, and RabbitMQ connects the API with both worker types.

## Run locally
### Prerequisites

- Node.js 22.13 or newer
- pnpm 11.5 or newer
- Docker Compose v2
- An OpenRouter API key for LLM-assisted exploration

Create a local environment file, install dependencies, and start the infrastructure:

```bash
cp .env.example .env
pnpm install
```
Set `OPENROUTER_API_KEY` in `.env`. Replace the example storage credentials with generated values:

```bash
printf 'S3_ACCESS_KEY=GK%s\n' "$(openssl rand -hex 16)"
printf 'S3_SECRET_KEY=%s\n' "$(openssl rand -hex 32)"
printf 'GARAGE_RPC_SECRET=%s\n' "$(openssl rand -hex 32)"
```

Copy the output into the corresponding `.env` entries, then start the infrastructure and workers in Docker:

```bash
docker compose up -d --build
```

Generate the database schema:

```bash
pnpm db:migrate
pnpm db:generate
```

Run the API and web application:

```bash
pnpm dev
```


Open [http://localhost:3000](http://localhost:3000), create a session with a public URL, choose the relation families and either review mode or auto mode. The API health endpoint is available at [http://localhost:3001/health](http://localhost:3001/health).

### Artifact storage

The Compose stack runs Garage `v2.4.1` as a single development node, with persistent `garage_meta` and `garage_data` volumes. Garage creates the `S3_BUCKET` bucket and its access key at startup. The `garage-init` service applies read-only browser CORS for signed artifact links; workers wait for initialization to complete. Garage's RPC port is kept inside the container.

The API and workers use provider-neutral `S3_*` variables:

- `S3_ENDPOINT`: address used for uploads, downloads, and bucket health checks. Host processes default to `http://localhost:3900`; Compose workers use `http://garage:3900`.
- `S3_PUBLIC_ENDPOINT`: address reachable by the browser, used directly when signing artifact URLs. Defaults to `S3_ENDPOINT` when omitted. Set this before generating links; changing the host of an already signed URL invalidates its signature.
- `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_BUCKET`, and `S3_REGION`: credentials, bucket, and signing region. Local Garage uses region `garage`, matching `infra/garage/garage.toml`.
- `S3_BIND_HOST`: host interface for Garage's published port, defaulting to `127.0.0.1`.

For a remote preview over Tailscale, set `S3_BIND_HOST` to your server's Tailscale IP and both S3 endpoints to `http://<tailscale-ip>:3900`. Also set `NEXT_PUBLIC_API_URL=http://<tailscale-ip>:3001` and `CORS_ORIGIN=http://<tailscale-ip>:3000`, and launch the web app with those settings:

```bash
pnpm --filter @metamorph/api dev
# In another terminal; substitute your server's Tailscale IP:
NEXT_PUBLIC_API_URL=http://<tailscale-ip>:3001 pnpm --filter @metamorph/web dev --hostname <tailscale-ip>
```

Validate uploads from the browser worker, reads from the LLM worker, public URL signatures, CORS, byte ranges, and private access with:

```bash
docker compose up -d garage garage-init
pnpm storage:test
```

This test needs `.env` and removes only the objects it creates. A single Garage node has no redundancy; keep backups of both volumes for any artifacts you need to retain. For cloud storage, configure an S3-compatible endpoint, region, credentials, and bucket instead of running Garage, and apply the bucket's browser CORS rules through that provider.

### Upgrading from MinIO

Rename existing `MINIO_*` environment variables to their `S3_*` equivalents, update the endpoints to port `3900`, and use region `garage`. Generate a Garage access key (`GK` followed by 32 hexadecimal characters), a secret, and an RPC secret as above. The `/health` response now reports object storage under `storage` instead of `minio`.

Garage uses a different on-disk format. If an existing installation contains artifacts, keep its MinIO container and volume intact and copy the bucket's objects through S3 using a tool such as `rclone copy`, preserving their object keys. Pause writers while copying, verify the copied objects and `pnpm storage:test`, then switch the API and workers to Garage. Existing database artifact paths remain valid because they store object keys. Retain the original volume until the migration has been verified; this Compose change does not copy or delete existing data.

## Validation

The thesis validation protocol defines a case study on Amazon, Booking, Airbnb, MediaMarkt, and GitHub. It uses 25 sessions across the five domains and explores all four relation families, yielding 100 discovery attempts. The evaluation measures:

| Research question | Evidence |
| --- | --- |
| RQ1 | Exploration and compilation success, failure causes, cost, and time to draft. |
| RQ2 | LLM-free replay completion, execution time, and stable verdict and observation extraction. |
| RQ3 | Strict verdicts, observable failures, manual triage, and relation quality. |

With the stack, API, and workers running, execute a single validation session and then extract its results:

```bash
pnpm validation:batch -- --domain github --generation 1
pnpm validation:metrics
pnpm validation:replay
pnpm validation:summary
```

Use `pnpm validation:batch -- --all` for the complete study. The scripts write their manifest, metric exports, review CSV files, and Markdown summary to `scripts/validation/out/`.

## Notes

This project was carried out as part of the Master's Thesis at the University of Murcia, within the Master's program in Software Engineering.
