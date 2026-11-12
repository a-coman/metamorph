# @metamorph/worker-playwright

Browser worker for Metamorph. It consumes jobs from the `q.playwright` RabbitMQ queue and is the only part of the system that drives a browser.

| Job | What it does |
| --- | --- |
| `discover` | Loads the session URL, captures the Set of Marks inventory and screenshot, and starts one exploration job per selected family. |
| `probe` | Replays the validated prefix plus the new batch of steps proposed by the LLM worker, captures a fresh inventory and trace, and hands the result back to it. Smoke replays of a full path also run as probes. |
| `execute_pair` | Runs the source and follow-up scenarios of an approved relation with tracing enabled, extracts the observations, and stores the run and its verdict. |

Screenshots and traces are uploaded to object storage and linked to the session in PostgreSQL.

## Running

The worker runs in Docker and starts with the rest of the stack.

```bash
docker compose up -d --build worker-playwright
docker compose logs -f worker-playwright
```

To run it on the host instead, stop the container, make sure the Playwright browsers are installed, and run

```bash
pnpm --filter @metamorph/worker-playwright db:generate
pnpm --filter @metamorph/worker-playwright consume
```

A single job can also be run directly with `discover --job-id <uuid>` or `execute-pair --job-id <uuid>`.

## Configuration

It reads the root `.env`.

| Variable | Default | Purpose |
| --- | --- | --- |
| `MAX_CONCURRENT_BROWSERS` | `4` | Browser jobs run in parallel, one per family by default. |
| `PLAYWRIGHT_LOCALE` | `es-ES` | Browser locale, which affects the language and number format of observed pages. |
| `PLAYWRIGHT_HEADLESS` | `true` | Set to `false` to watch the browser when running on the host. |

## Tests

```bash
pnpm --filter @metamorph/worker-playwright test
```
