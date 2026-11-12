# @metamorph/web

Next.js interface for Metamorph. Testers create sessions, follow exploration live, review and edit compiled relations, and triage runs with their screenshots and Playwright traces.

## Running

With the API running, start the web app with

```bash
pnpm --filter @metamorph/web dev
```

and open [http://localhost:3000](http://localhost:3000). `pnpm dev` from the root starts it together with the API. The API address comes from `NEXT_PUBLIC_API_URL` in the root `.env`, and `API_INTERNAL_URL` can override it for server-side requests.

## Pages

| Route | Purpose |
| --- | --- |
| `/` | Session list and new session form. |
| `/sessions/:id` | Session hub with per-family progress and live activity. |
| `/sessions/:id/mr/:mrId` | Relation review with the exploration timeline, observables, and playbook editor. |
| `/sessions/:id/mr/:mrId/runs/:runId` | Run details with the verdict, observations, and evidence. |
| `/traces/:artifactId` | Embedded Playwright trace viewer. |

## Tests

```bash
pnpm --filter @metamorph/web test
```
