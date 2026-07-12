# SLR toolkit

Python toolkit for the systematic mapping study: merge BibTeX exports, deduplicate, and run LLM assisted abstract screening.

## Setup

We recommend using astral uv to manage the environment.
```bash
pip install uv
```

```bash
cd docs/slr
uv sync
cp .env.example .env
```

Set `OPENROUTER_API_KEY` in `.env` for LLM screening and `SLR_LLM_MODEL` for the model to use.

## Inputs

Place exports in `bibs/`:

| File | Source |
|------|--------|
| `acm.bib` | ACM Digital Library |
| `ieeexplore.bib` | IEEE Xplore |
| `arxiv.bib` | arXiv (cs.SE) |
| `anchors.bib` | Anchor references (protocol seed list) |

## Commands

```bash
# Step 1: merge BibTeX into records_raw.csv
uv run slr merge

# Step 2: deduplicate into records_deduped.csv
uv run slr dedupe

# Step 3: LLM abstract screening
uv run slr screen
# uv run slr screen --dry-run --limit 5 -- for testing withjout llm call and limit
# uv run slr screen --limit 20 -- for testing with llm call limit

# PRISMA counts
uv run slr stats

# Normalize bib keys in existing CSV outputs
uv run slr normalize-keys

# Export final corpus to BibTeX for LaTeX
uv run slr export-bib

# Full pipeline
uv run slr run
uv run slr run --skip-screen
```

## Outputs (`data/`)

| File | Description |
|------|-------------|
| `records_raw.csv` | All parsed records before dedup |
| `records_deduped.csv` | Unique records after DOI/eprint/title merge |
| `dedup_log.csv` | Merge audit trail |
| `screening_results.csv` | LLM decisions |
| `slr_results.csv` | Final corpus: Tier A + human includes + anchors (`uv run slr stats`) |
| `slr_results.bib` | BibTeX export of the final corpus (`uv run slr export-bib`) |
| `prisma_counts.json` | Counts per source and screening outcome |
| `llm_cache/` | Cached LLM responses per record |

## Final corpus

After LLM abstract screening, review `screening_results.csv` and set the `human` column to `included` for papers that should enter the final corpus.

Then `uv run slr stats` applies deterministic rules:

- **Tier A**: `include` with `mt_relevance=core` and `llm_relevance=core`
- **Human includes**: records with `human=included`
- **Anchors**: records from `anchors.bib`

Output: `data/slr_results.csv` (deduplicated union of the three sets).

`slr_results.csv` is the full text reading list for Related Work.

## Screening decisions

- `include` / `exclude` / `uncertain`: LLM recommendation for full text review
- `review_manual`: missing abstract, needs human review (excluded as most of the records are from anchor references and or from proceedings)
- `human`: set to `included` after manual review to add the paper to `slr_results.csv`

## Notes

- IEEE exports are preprocessed when entries are concatenated (`}@TYPE{`).
- Dedup order: DOI, arXiv eprint, fuzzy title (>= 92).
- Re screening uses cache unless `--force` is passed.
