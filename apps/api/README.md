# @metamorph/api

NestJS API for Metamorph. It owns the session lifecycle, publishes jobs to the workers through RabbitMQ, streams progress to the web app with server-sent events, and signs artifact URLs for screenshots and traces. The Prisma schema and migrations for the whole system live here in [`prisma/`](prisma/).

## Running

Start the infrastructure and apply migrations as described in the [root README](../../README.md#running-locally), then run the API alone with

```bash
pnpm --filter @metamorph/api dev
```

It reads the root `.env` and listens on `PORT` (default `3001`). `pnpm dev` from the root starts it together with the web app.

## Endpoints

| Resource | Routes |
| --- | --- |
| Sessions | `POST /sessions`, `GET /sessions`, `GET /sessions/:id`, `POST /sessions/:id/discover`, `POST /sessions/:id/pause`, `POST /sessions/:id/resume` |
| Session events | `GET /sessions/:id/activity`, `GET /sessions/:id/events` (SSE) |
| MR versions | `GET /mr-versions/:id`, `GET /mr-versions/:id/exploration`, `GET /mr-versions/:id/playbook`, `POST /mr-versions/:id/approve`, `POST /mr-versions/:id/reject`, `POST /mr-versions/:id/execute`, `GET /mr-versions/:id/runs`, `GET /mr-versions/:id/events` (SSE) |
| Runs | `GET /runs/:id` |
| Page snapshots | `GET /page-snapshots/:id` |
| Artifacts | `GET /artifacts/:id/url` |
| Health | `GET /health` |

## Tests

```bash
pnpm --filter @metamorph/api test
```
