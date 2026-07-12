from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Any
from uuid import uuid4


@dataclass
class Record:
    record_id: str
    bib_key: str
    source_db: str
    title: str
    authors: str = ""
    year: str = ""
    doi: str = ""
    venue: str = ""
    abstract: str = ""
    eprint: str = ""
    url: str = ""
    raw_entry_type: str = ""
    sources: list[str] = field(default_factory=list)
    title_normalized: str = ""
    doi_normalized: str = ""
    parse_error: str = ""
    screen_decision: str = "pending"
    screen_reason: str = ""
    screen_themes: str = ""
    screen_mt_relevance: str = ""
    screen_llm_relevance: str = ""
    human: str = ""

    @staticmethod
    def new_id() -> str:
        return uuid4().hex[:12]

    def to_row(self) -> dict[str, Any]:
        row = asdict(self)
        row["sources"] = "|".join(self.sources) if self.sources else self.source_db
        return row

    @classmethod
    def from_row(cls, row: dict[str, Any]) -> Record:
        sources_raw = row.get("sources") or row.get("source_db") or ""
        sources = [s for s in str(sources_raw).split("|") if s]
        return cls(
            record_id=str(row.get("record_id") or cls.new_id()),
            bib_key=str(row.get("bib_key") or ""),
            source_db=str(row.get("source_db") or ""),
            title=str(row.get("title") or ""),
            authors=str(row.get("authors") or ""),
            year=str(row.get("year") or ""),
            doi=str(row.get("doi") or ""),
            venue=str(row.get("venue") or ""),
            abstract=str(row.get("abstract") or ""),
            eprint=str(row.get("eprint") or ""),
            url=str(row.get("url") or ""),
            raw_entry_type=str(row.get("raw_entry_type") or ""),
            sources=sources,
            title_normalized=str(row.get("title_normalized") or ""),
            doi_normalized=str(row.get("doi_normalized") or ""),
            parse_error=str(row.get("parse_error") or ""),
            screen_decision=str(row.get("screen_decision") or "pending"),
            screen_reason=str(row.get("screen_reason") or ""),
            screen_themes=str(row.get("screen_themes") or ""),
            screen_mt_relevance=str(row.get("screen_mt_relevance") or ""),
            screen_llm_relevance=str(row.get("screen_llm_relevance") or ""),
            human=str(row.get("human") or ""),
        )


@dataclass
class DedupLogEntry:
    match_type: str
    score: float
    kept_id: str
    merged_id: str
    kept_title: str
    merged_title: str

    def to_row(self) -> dict[str, Any]:
        return asdict(self)
