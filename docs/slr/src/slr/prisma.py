from __future__ import annotations

from collections import Counter
from pathlib import Path
from typing import Any

from slr.export import read_records_csv, write_json, write_records_csv
from slr.normalize import assign_bib_keys
from slr.triage import build_slr_results


def compute_prisma_counts(
  *,
  identified_by_source: dict[str, int],
  after_dedup: int,
  screening_path: Path | None = None,
) -> dict[str, Any]:
    counts: dict[str, Any] = {
        "identified": identified_by_source,
        "after_dedup": after_dedup,
        "screen_include": 0,
        "screen_exclude": 0,
        "screen_uncertain": 0,
        "screen_manual": 0,
        "screen_pending": 0,
        "screen_dry_run": 0,
        "tier_a": 0,
        "tier_human_included": 0,
        "tier_human_added": 0,
        "tier_human_merged": 0,
        "tier_anchor_candidates": 0,
        "tier_anchor_added": 0,
        "tier_anchor_merged": 0,
        "after_second_triage": 0,
    }

    if screening_path is None or not screening_path.exists():
        return counts

    records = read_records_csv(screening_path)
    decision_counts = Counter(record.screen_decision for record in records)
    counts["screen_include"] = decision_counts.get("include", 0)
    counts["screen_exclude"] = decision_counts.get("exclude", 0)
    counts["screen_uncertain"] = decision_counts.get("uncertain", 0)
    counts["screen_manual"] = decision_counts.get("review_manual", 0)
    counts["screen_pending"] = decision_counts.get("pending", 0)
    counts["screen_dry_run"] = decision_counts.get("dry_run", 0)
    return counts


def build_slr_results_report(screening_path: Path) -> tuple[list, dict[str, Any]]:
    records = read_records_csv(screening_path)
    results, triage_stats = build_slr_results(records)
    return results, triage_stats


def write_slr_results(screening_path: Path, output_path: Path) -> dict[str, Any]:
    results, triage_stats = build_slr_results_report(screening_path)
    assign_bib_keys(results)
    write_records_csv(results, output_path)
    return triage_stats


def write_prisma_counts(path: Path, counts: dict[str, Any]) -> None:
    write_json(counts, path)
