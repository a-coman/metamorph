from __future__ import annotations

import json
from pathlib import Path

import typer

from slr.bib_parser import load_all_bibs, load_bib_entry_index
from slr.dedupe import dedupe_records
from slr.export import (
    read_records_csv,
    write_dedup_log,
    write_json,
    write_records_bib,
    write_records_csv,
)
from slr.normalize import assign_bib_keys
from slr.llm_screen import screen_csv
from slr.prisma import compute_prisma_counts, write_prisma_counts, write_slr_results

app = typer.Typer(help="Metamorph systematic mapping study toolkit")

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_BIBS = ROOT / "bibs"
DEFAULT_DATA = ROOT / "data"
DEFAULT_PROMPTS = ROOT / "prompts"


def _resolve(path: Path) -> Path:
    return path if path.is_absolute() else ROOT / path


@app.command("merge")
def merge(
    bibs_dir: Path = typer.Option(DEFAULT_BIBS, "--bibs-dir"),
    data_dir: Path = typer.Option(DEFAULT_DATA, "--data-dir"),
    anchors: bool = typer.Option(True, "--anchors/--no-anchors"),
) -> None:
    """Parse BibTeX exports and write records_raw.csv."""
    bibs_dir = _resolve(bibs_dir)
    data_dir = _resolve(data_dir)

    records, warnings, counts = load_all_bibs(bibs_dir, include_anchors=anchors)
    write_records_csv(records, data_dir / "records_raw.csv")
    write_json({"identified": counts, "total": len(records), "warnings": warnings}, data_dir / "merge_meta.json")

    typer.echo(f"Merged {len(records)} records from {bibs_dir}")
    for source, count in sorted(counts.items()):
        typer.echo(f"  {source}: {count}")
    if warnings:
        typer.echo(f"Warnings: {len(warnings)}")
        for warning in warnings[:10]:
            typer.echo(f"  - {warning}")


@app.command("dedupe")
def dedupe(
    data_dir: Path = typer.Option(DEFAULT_DATA, "--data-dir"),
) -> None:
    """Deduplicate records_raw.csv into records_deduped.csv."""
    from slr.export import read_records_csv

    data_dir = _resolve(data_dir)
    raw_path = data_dir / "records_raw.csv"
    records = read_records_csv(raw_path)
    deduped, logs = dedupe_records(records)

    write_records_csv(deduped, data_dir / "records_deduped.csv")
    write_dedup_log(logs, data_dir / "dedup_log.csv")

    typer.echo(f"Deduped {len(records)} -> {len(deduped)} records ({len(logs)} merges)")


@app.command("screen")
def screen(
    data_dir: Path = typer.Option(DEFAULT_DATA, "--data-dir"),
    prompts_dir: Path = typer.Option(DEFAULT_PROMPTS, "--prompts-dir"),
    dry_run: bool = typer.Option(False, "--dry-run"),
    limit: int | None = typer.Option(None, "--limit"),
    force: bool = typer.Option(False, "--force", help="Ignore LLM cache"),
) -> None:
    """LLM assisted abstract screening."""
    data_dir = _resolve(data_dir)
    prompts_dir = _resolve(prompts_dir)

    screened = screen_csv(
        data_dir / "records_deduped.csv",
        data_dir / "screening_results.csv",
        prompts_dir=prompts_dir,
        cache_dir=data_dir / "llm_cache",
        dry_run=dry_run,
        limit=limit,
        force=force,
    )

    decisions = {}
    for record in screened:
        decisions[record.screen_decision] = decisions.get(record.screen_decision, 0) + 1

    typer.echo(f"Screened {len(screened)} records")
    typer.echo(json.dumps(decisions, indent=2))


@app.command("normalize-keys")
def normalize_keys(
    data_dir: Path = typer.Option(DEFAULT_DATA, "--data-dir"),
) -> None:
    """Rewrite bib_key columns to AuthorDateFirstWordTitle in CSV outputs."""
    data_dir = _resolve(data_dir)
    csv_names = (
        "records_raw.csv",
        "records_deduped.csv",
        "screening_results.csv",
        "slr_results.csv",
    )

    updated = 0
    for name in csv_names:
        path = data_dir / name
        if not path.exists():
            continue
        records = read_records_csv(path)
        assign_bib_keys(records)
        write_records_csv(records, path)
        updated += 1
        typer.echo(f"Updated {path.name} ({len(records)} records)")

    if updated == 0:
        typer.echo("No CSV files found to update.")
    else:
        typer.echo(f"Normalized bib keys in {updated} file(s).")


@app.command("export-bib")
def export_bib(
    data_dir: Path = typer.Option(DEFAULT_DATA, "--data-dir"),
    bibs_dir: Path = typer.Option(DEFAULT_BIBS, "--bibs-dir"),
    input_csv: Path = typer.Option(Path("data/slr_results.csv"), "--input"),
    output_bib: Path = typer.Option(Path("data/slr_results.bib"), "--output"),
    anchors: bool = typer.Option(True, "--anchors/--no-anchors"),
) -> None:
    """Export slr_results.csv to BibTeX for LaTeX citations."""
    data_dir = _resolve(data_dir)
    bibs_dir = _resolve(bibs_dir)
    input_path = _resolve(input_csv)
    output_path = _resolve(output_bib)

    if not input_path.exists():
        raise typer.BadParameter(f"input file not found: {input_path}")

    records = read_records_csv(input_path)
    assign_bib_keys(records)
    bib_index = load_bib_entry_index(bibs_dir, include_anchors=anchors)
    matched, synthesized = write_records_bib(records, output_path, bib_index=bib_index)

    typer.echo(f"Wrote {len(records)} entries to {output_path}")
    typer.echo(f"  from source BibTeX: {matched}")
    if synthesized:
        typer.echo(f"  synthesized from CSV: {synthesized}")


@app.command("stats")
def stats(
    data_dir: Path = typer.Option(DEFAULT_DATA, "--data-dir"),
) -> None:
    """Write prisma_counts.json from pipeline outputs."""
    data_dir = _resolve(data_dir)
    merge_meta_path = data_dir / "merge_meta.json"
    deduped_path = data_dir / "records_deduped.csv"
    screening_path = data_dir / "screening_results.csv"

    identified = {}
    if merge_meta_path.exists():
        merge_meta = json.loads(merge_meta_path.read_text(encoding="utf-8"))
        identified = merge_meta.get("identified", {})

    after_dedup = 0
    if deduped_path.exists():
        from slr.export import read_records_csv

        after_dedup = len(read_records_csv(deduped_path))

    counts = compute_prisma_counts(
        identified_by_source=identified,
        after_dedup=after_dedup,
        screening_path=screening_path if screening_path.exists() else None,
    )

    if screening_path.exists():
        triage_stats = write_slr_results(screening_path, data_dir / "slr_results.csv")
        counts.update(triage_stats)
        counts["after_second_triage"] = triage_stats["slr_results_total"]

    write_prisma_counts(data_dir / "prisma_counts.json", counts)
    typer.echo(json.dumps(counts, indent=2))
    if screening_path.exists():
        typer.echo(f"Wrote {data_dir / 'slr_results.csv'} ({counts.get('after_second_triage', 0)} records)")


@app.command("run")
def run_pipeline(
    bibs_dir: Path = typer.Option(DEFAULT_BIBS, "--bibs-dir"),
    data_dir: Path = typer.Option(DEFAULT_DATA, "--data-dir"),
    prompts_dir: Path = typer.Option(DEFAULT_PROMPTS, "--prompts-dir"),
    anchors: bool = typer.Option(True, "--anchors/--no-anchors"),
    dry_run: bool = typer.Option(False, "--dry-run"),
    limit: int | None = typer.Option(None, "--limit"),
    force: bool = typer.Option(False, "--force"),
    skip_screen: bool = typer.Option(False, "--skip-screen"),
) -> None:
    """Run merge, dedupe, screen, and stats."""
    merge(bibs_dir=bibs_dir, data_dir=data_dir, anchors=anchors)
    dedupe(data_dir=data_dir)
    if not skip_screen:
        screen(data_dir=data_dir, prompts_dir=prompts_dir, dry_run=dry_run, limit=limit, force=force)
    stats(data_dir=data_dir)


if __name__ == "__main__":
    app()
