# @metamorph/worker-llm

LLM worker for Metamorph. It consumes exploration jobs from the `q.llm` RabbitMQ queue and runs one LangGraph state machine per transformation family. It never touches a browser. Every action it proposes is sent to the Playwright worker as a probe.

## Exploration graph

The graph lives in [`src/explore/infrastructure/graph/explore-graph.ts`](src/explore/infrastructure/graph/explore-graph.ts).

1. `mr_plan` proposes a candidate relation for the family and splits it into a source goal and a follow-up goal.
2. `plan_next` plans one to three steps that reference inventory identifiers, with at most one state-changing action per batch.
3. `dispatch_probe` and `await_probe` send the batch to the Playwright worker and pause until the new screenshot and inventory arrive.
4. `assess_checkpoint` checks whether the goal was reached, and `commit_or_backtrack` keeps or drops the batch before planning again.
5. `dispatch_smoke` and `assess_smoke` replay the whole path from the start page once a goal is reached. `switch_phase` then moves from the source to the follow-up path.
6. `observe_spec` binds observables to the final snapshot and picks the comparisons allowed by the family.
7. `compile_draft` compiles the result into a Playwright playbook. In auto mode the draft is promoted and its paired execution is enqueued.

An attempt ends in `fail` when it runs out of iterations or the model declares the goal unreachable. The prompts are in [`src/explore/prompts/`](src/explore/prompts/), and every model call is stored in PostgreSQL with its prompt, response, tokens, and latency.

## Running

The worker runs in Docker and starts with the rest of the stack.

```bash
docker compose up -d --build worker-llm
docker compose logs -f worker-llm
```

To run it on the host instead, stop the container and run

```bash
pnpm --filter @metamorph/worker-llm db:generate
pnpm --filter @metamorph/worker-llm consume
```

A single job can also be run directly with `explore --job-id <uuid>`.

## Configuration

It reads the root `.env`.

| Variable | Default | Purpose |
| --- | --- | --- |
| `OPENROUTER_API_KEY` | | OpenRouter API key. |
| `OPENROUTER_MODEL` | `minimax/minimax-m3` | Vision-language model used for exploration. |
| `OPENROUTER_USE_JSON_SCHEMA` | `false` | Enables strict structured outputs for models that support them. |
| `OPENROUTER_TIMEOUT_MS` | `30000` | Timeout for each model call. |
| `WORKER_LLM_CONCURRENCY` | `4` | Exploration graphs run in parallel, one per family by default. |

## Tests

```bash
pnpm --filter @metamorph/worker-llm test
```
