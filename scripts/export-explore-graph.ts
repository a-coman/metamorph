#!/usr/bin/env tsx
/**
 * Export the explore LangGraph structure as Mermaid (.mmd).
 *
 * Usage:
 *   pnpm --filter @metamorph/worker-llm exec tsx ../../scripts/export-explore-graph.ts [outputPath]
 *
 * Default output: docs/TFM_LLM_Metamorphic/Figures/explore-graph-langgraph.mmd
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildExploreGraph,
  type ExploreGraphDeps,
} from '../apps/worker-llm/src/explore/infrastructure/graph/explore-graph.js';

const repoRoot = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');

const defaultOutput = join(
  repoRoot,
  'docs/TFM_LLM_Metamorphic/Figures/explore-graph-langgraph.mmd',
);

const outputPath = resolve(process.argv[2] ?? defaultOutput);

const stubDeps = {} as ExploreGraphDeps;

const app = buildExploreGraph(stubDeps).compile();
const drawable = await app.getGraphAsync();
const mermaid = drawable.drawMermaid();

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, mermaid, 'utf8');

console.log(`Wrote ${outputPath}`);
