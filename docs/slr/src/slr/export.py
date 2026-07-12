from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import bibtexparser
import pandas as pd
from bibtexparser.bwriter import BibTexWriter

from slr.models import DedupLogEntry, Record
from slr.normalize import assign_bib_keys


RECORD_COLUMNS = [
    "record_id",
    "bib_key",
    "source_db",
    "sources",
    "title",
    "authors",
    "year",
    "doi",
    "venue",
    "abstract",
    "eprint",
    "url",
    "raw_entry_type",
    "title_normalized",
    "doi_normalized",
    "parse_error",
    "screen_decision",
    "screen_reason",
    "screen_themes",
    "screen_mt_relevance",
    "screen_llm_relevance",
    "human",
]


def records_to_dataframe(records: list[Record]) -> pd.DataFrame:
    rows = [record.to_row() for record in records]
    return pd.DataFrame(rows, columns=RECORD_COLUMNS)


def dataframe_to_records(df: pd.DataFrame) -> list[Record]:
    return [Record.from_row(row) for row in df.to_dict(orient="records")]


def write_records_csv(records: list[Record], path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    records_to_dataframe(records).to_csv(path, index=False)


def read_records_csv(path: Path) -> list[Record]:
    df = pd.read_csv(path, dtype=str).fillna("")
    return dataframe_to_records(df)


def write_dedup_log(entries: list[DedupLogEntry], path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    rows = [entry.to_row() for entry in entries]
    pd.DataFrame(rows).to_csv(path, index=False)


def write_json(data: dict[str, Any], path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2), encoding="utf-8")


def resolve_bib_entry(record: Record, bib_index: dict[str, dict]) -> dict | None:
    for candidate in (
        record.bib_key,
        f"doi:{record.doi_normalized}",
        f"title:{record.title_normalized}",
    ):
        if candidate and candidate in bib_index:
            return bib_index[candidate]
    return None


def sanitize_bib_entry(entry: dict[str, str]) -> dict[str, str]:
    """Prepare a BibTeX entry for LaTeX export (drop fields that break compilation)."""
    cleaned = dict(entry)
    cleaned.pop("abstract", None)
    cleaned.pop("Abstract", None)
    return cleaned


def record_to_bib_entry(record: Record) -> dict[str, str]:
    """Build a BibTeX entry from CSV fields when the source export is unavailable."""
    entry_type = record.raw_entry_type or "article"
    entry: dict[str, str] = {
        "ENTRYTYPE": entry_type,
        "ID": record.bib_key or record.record_id,
        "title": record.title,
    }
    if record.authors:
        entry["author"] = record.authors
    if record.year:
        entry["year"] = record.year
    if record.doi:
        entry["doi"] = record.doi
    if record.url:
        entry["url"] = record.url
    if record.eprint:
        entry["eprint"] = record.eprint
        entry["archiveprefix"] = "arXiv"
    if record.venue:
        if entry_type in {"inproceedings", "proceedings", "conference"}:
            entry["booktitle"] = record.venue
        elif entry_type == "phdthesis":
            entry["school"] = record.venue
        else:
            entry["journal"] = record.venue
    return entry


def write_records_bib(
    records: list[Record],
    path: Path,
    *,
    bib_index: dict[str, dict] | None = None,
) -> tuple[int, int]:
    """Write BibTeX for records. Returns (matched_from_source, synthesized)."""
    path.parent.mkdir(parents=True, exist_ok=True)
    bib_index = bib_index or {}

    entries: list[dict[str, str]] = []
    matched = 0
    synthesized = 0

    for record in records:
        source_entry = resolve_bib_entry(record, bib_index)
        if source_entry is not None:
            entry = sanitize_bib_entry(source_entry)
            entry["ID"] = record.bib_key or record.record_id
            entries.append(entry)
            matched += 1
        else:
            entries.append(sanitize_bib_entry(record_to_bib_entry(record)))
            synthesized += 1

    database = bibtexparser.bibdatabase.BibDatabase()
    database.entries = entries

    writer = BibTexWriter()
    writer.indent = "  "
    writer.order_entries_by = None

    path.write_text(bibtexparser.dumps(database, writer=writer), encoding="utf-8")
    return matched, synthesized
