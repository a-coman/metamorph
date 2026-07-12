from __future__ import annotations

from slr.models import DedupLogEntry, Record
from slr.normalize import normalize_eprint
from rapidfuzz import fuzz


def _record_richness(record: Record) -> int:
    return len(record.abstract) + len(record.doi) + len(record.venue) + len(record.authors)


def _pick_keeper(current: Record, candidate: Record) -> Record:
    if _record_richness(candidate) > _record_richness(current):
        return _merge_into(candidate, current)
    return _merge_into(current, candidate)


def _merge_into(keeper: Record, other: Record) -> Record:
    for source in other.sources:
        if source not in keeper.sources:
            keeper.sources.append(source)
    if not keeper.abstract and other.abstract:
        keeper.abstract = other.abstract
    if not keeper.doi and other.doi:
        keeper.doi = other.doi
        keeper.doi_normalized = other.doi_normalized
    if not keeper.eprint and other.eprint:
        keeper.eprint = other.eprint
    if not keeper.venue and other.venue:
        keeper.venue = other.venue
    if not keeper.authors and other.authors:
        keeper.authors = other.authors
    if not keeper.url and other.url:
        keeper.url = other.url
    return keeper


def _years_compatible(a: str, b: str) -> bool:
    if not a or not b:
        return True
    try:
        return abs(int(a) - int(b)) <= 1
    except ValueError:
        return a == b


def _merge_log_entry(keeper: Record, other: Record, match_type: str, score: float) -> DedupLogEntry:
    return DedupLogEntry(
        match_type=match_type,
        score=score,
        kept_id=keeper.record_id,
        merged_id=other.record_id,
        kept_title=keeper.title,
        merged_title=other.title,
    )


def _title_merge_candidate(record: Record, existing: Record, title_threshold: int) -> float | None:
    if len(record.title_normalized) < 30 or len(existing.title_normalized) < 30:
        return None
    if not _years_compatible(record.year, existing.year):
        return None
    score = fuzz.token_set_ratio(record.title_normalized, existing.title_normalized)
    if score >= title_threshold and record.record_id != existing.record_id:
        return float(score)
    return None


def dedupe_records(
    records: list[Record],
    title_threshold: int = 92,
) -> tuple[list[Record], list[DedupLogEntry]]:
    deduped: list[Record] = []
    logs: list[DedupLogEntry] = []
    doi_index: dict[str, int] = {}
    eprint_index: dict[str, int] = {}

    for record in records:
        merged = False

        if record.doi_normalized:
            existing_idx = doi_index.get(record.doi_normalized)
            if existing_idx is not None:
                kept = _pick_keeper(deduped[existing_idx], record)
                logs.append(_merge_log_entry(kept, record, "doi", 100.0))
                deduped[existing_idx] = kept
                merged = True

        if not merged and record.eprint:
            eprint_key = normalize_eprint(record.eprint)
            existing_idx = eprint_index.get(eprint_key)
            if existing_idx is not None:
                kept = _pick_keeper(deduped[existing_idx], record)
                logs.append(_merge_log_entry(kept, record, "eprint", 100.0))
                deduped[existing_idx] = kept
                merged = True

        if not merged:
            for idx, existing in enumerate(deduped):
                score = _title_merge_candidate(record, existing, title_threshold)
                if score is not None:
                    kept = _pick_keeper(existing, record)
                    logs.append(_merge_log_entry(kept, record, "title", score))
                    deduped[idx] = kept
                    if kept.doi_normalized:
                        doi_index[kept.doi_normalized] = idx
                    if kept.eprint:
                        eprint_index[normalize_eprint(kept.eprint)] = idx
                    merged = True
                    break

        if merged:
            continue

        deduped.append(record)
        idx = len(deduped) - 1
        if record.doi_normalized:
            doi_index[record.doi_normalized] = idx
        if record.eprint:
            eprint_index[normalize_eprint(record.eprint)] = idx

    return deduped, logs
