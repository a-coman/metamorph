from __future__ import annotations

from copy import deepcopy

from rapidfuzz import fuzz

from slr.models import Record
from slr.normalize import normalize_eprint


def is_tier_a(record: Record) -> bool:
    return (
        record.screen_decision == "include"
        and record.screen_mt_relevance == "core"
        and record.screen_llm_relevance == "core"
    )


def is_human_included(record: Record) -> bool:
    return record.human.strip().lower() == "included"


def is_anchor(record: Record) -> bool:
    return record.source_db == "anchor" or "anchor" in record.sources


def _match_keys(record: Record) -> set[str]:
    keys: set[str] = set()
    if record.doi_normalized:
        keys.add(f"doi:{record.doi_normalized}")
    if record.eprint:
        keys.add(f"eprint:{normalize_eprint(record.eprint)}")
    if record.title_normalized:
        keys.add(f"title:{record.title_normalized}")
    return keys


def _is_duplicate_of(
    existing: Record,
    candidate: Record,
    *,
    title_threshold: int = 92,
    title_fuzzy: bool = True,
) -> bool:
    candidate_keys = _match_keys(candidate)
    existing_keys = _match_keys(existing)
    if candidate_keys & existing_keys:
        return True
    if not title_fuzzy:
        return False
    if not candidate.title_normalized or not existing.title_normalized:
        return False
    score = fuzz.token_set_ratio(candidate.title_normalized, existing.title_normalized)
    return score >= title_threshold


def _append_if_unique(
    results: list[Record],
    candidate: Record,
    *,
    added_key: str,
    merged_key: str,
    stats: dict[str, int],
) -> None:
    for existing in results:
        if _is_duplicate_of(existing, candidate, title_fuzzy=False):
            stats[merged_key] += 1
            return
    results.append(deepcopy(candidate))
    stats[added_key] += 1


def build_slr_results(records: list[Record]) -> tuple[list[Record], dict[str, int]]:
    """Build final corpus: Tier A, human includes, and anchor references, deduplicated."""
    tier_a = [deepcopy(record) for record in records if is_tier_a(record)]
    human_included = [record for record in records if is_human_included(record)]
    anchors = [record for record in records if is_anchor(record)]

    results: list[Record] = list(tier_a)
    stats = {
        "tier_a": len(tier_a),
        "tier_human_included": len(human_included),
        "tier_human_added": 0,
        "tier_human_merged": 0,
        "tier_anchor_candidates": len(anchors),
        "tier_anchor_added": 0,
        "tier_anchor_merged": 0,
    }

    for record in human_included:
        _append_if_unique(
            results,
            record,
            added_key="tier_human_added",
            merged_key="tier_human_merged",
            stats=stats,
        )

    for anchor in anchors:
        _append_if_unique(
            results,
            anchor,
            added_key="tier_anchor_added",
            merged_key="tier_anchor_merged",
            stats=stats,
        )

    stats["slr_results_total"] = len(results)
    return results, stats
