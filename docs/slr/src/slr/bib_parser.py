from __future__ import annotations

import re
from pathlib import Path

import bibtexparser
from bibtexparser.bparser import BibTexParser

from slr.models import Record
from slr.normalize import (
    is_author_date_key,
    make_bib_key,
    normalize_doi,
    normalize_eprint,
    normalize_title,
    normalize_year,
)


def preprocess_bib_text(text: str) -> str:
    """Fix IEEE exports where entries are concatenated without newlines."""
    return re.sub(r"\}\s*@", "}\n@", text)


def _field(entry: dict, *names: str) -> str:
    for name in names:
        value = entry.get(name)
        if value is None:
            continue
        text = str(value).strip()
        if text:
            return text
    return ""


def _authors(entry: dict) -> str:
    author = _field(entry, "author", "Author")
    if author:
        return author
    return ""


def _venue(entry: dict) -> str:
    return _field(entry, "journal", "Journal", "booktitle", "Booktitle", "howpublished", "Howpublished")


def _eprint(entry: dict) -> str:
    raw = _field(entry, "eprint", "Eprint", "eprinttype")
    if raw:
        return normalize_eprint(raw)
    url = _field(entry, "url", "Url")
    match = re.search(r"arxiv\.org/abs/([\d.]+)", url, re.I)
    if match:
        return normalize_eprint(match.group(1))
    return ""


def entry_to_record(
    entry: dict,
    source_db: str,
    *,
    seen_bib_keys: set[str] | None = None,
) -> Record | None:
    title = _field(entry, "title", "Title")
    if not title:
        return None

    doi = _field(entry, "doi", "Doi")
    year = normalize_year(_field(entry, "year", "Year"))
    eprint = _eprint(entry)
    authors = _authors(entry)
    raw_id = _field(entry, "ID")

    if raw_id and is_author_date_key(raw_id):
        bib_key = raw_id
        if seen_bib_keys is not None:
            if bib_key in seen_bib_keys:
                bib_key = make_bib_key(authors, year, title, existing=seen_bib_keys)
            else:
                seen_bib_keys.add(bib_key)
    else:
        bib_key = make_bib_key(authors, year, title, existing=seen_bib_keys)

    record = Record(
        record_id=Record.new_id(),
        bib_key=bib_key,
        source_db=source_db,
        title=title,
        authors=authors,
        year=year,
        doi=doi,
        venue=_venue(entry),
        abstract=_field(entry, "abstract", "Abstract"),
        eprint=eprint,
        url=_field(entry, "url", "Url"),
        raw_entry_type=_field(entry, "ENTRYTYPE"),
        sources=[source_db],
        title_normalized=normalize_title(title),
        doi_normalized=normalize_doi(doi),
    )
    return record


def parse_bib_file(
    path: Path,
    source_db: str,
    *,
    seen_bib_keys: set[str] | None = None,
) -> tuple[list[Record], list[str]]:
    text = path.read_text(encoding="utf-8", errors="replace")
    if source_db == "ieee":
        text = preprocess_bib_text(text)

    parser = BibTexParser()
    parser.ignore_nonstandard_types = False
    parser.homogenise_fields = True

    try:
        library = bibtexparser.loads(text, parser=parser)
    except Exception as exc:
        return [], [f"{path.name}: parse error: {exc}"]

    records: list[Record] = []
    warnings: list[str] = []
    local_seen = seen_bib_keys if seen_bib_keys is not None else set()
    for entry in library.entries:
        record = entry_to_record(entry, source_db, seen_bib_keys=local_seen)
        if record is None:
            warnings.append(f"{path.name}: skipped entry without title ({entry.get('ID', '?')})")
            continue
        records.append(record)
    return records, warnings


SOURCE_FILE_MAP = {
    "acm.bib": "acm",
    "ieeexplore.bib": "ieee",
    "arxiv.bib": "arxiv",
    "anchors.bib": "anchor",
}


def load_bib_entry_index(bibs_dir: Path, include_anchors: bool = True) -> dict[str, dict]:
    """Map BibTeX entry IDs to raw parsed entries across all source files."""
    index: dict[str, dict] = {}

    for filename, source_db in SOURCE_FILE_MAP.items():
        if not include_anchors and source_db == "anchor":
            continue
        path = bibs_dir / filename
        if not path.exists():
            continue

        text = path.read_text(encoding="utf-8", errors="replace")
        if source_db == "ieee":
            text = preprocess_bib_text(text)

        parser = BibTexParser()
        parser.ignore_nonstandard_types = False
        parser.homogenise_fields = True

        try:
            library = bibtexparser.loads(text, parser=parser)
        except Exception:
            continue

        for entry in library.entries:
            entry_id = entry.get("ID")
            if entry_id:
                index[str(entry_id)] = entry

            doi = normalize_doi(_field(entry, "doi", "Doi"))
            if doi:
                index[f"doi:{doi}"] = entry

            title = normalize_title(_field(entry, "title", "Title"))
            if title:
                index[f"title:{title}"] = entry

            authors = _authors(entry)
            year = normalize_year(_field(entry, "year", "Year"))
            title_raw = _field(entry, "title", "Title")
            if authors and title_raw:
                bib_key = (
                    str(entry_id)
                    if entry_id and is_author_date_key(str(entry_id))
                    else make_bib_key(authors, year, title_raw)
                )
                index[bib_key] = entry

    return index


def load_all_bibs(bibs_dir: Path, include_anchors: bool = True) -> tuple[list[Record], list[str], dict[str, int]]:
    records: list[Record] = []
    warnings: list[str] = []
    counts: dict[str, int] = {}
    seen_bib_keys: set[str] = set()

    for filename, source_db in SOURCE_FILE_MAP.items():
        if not include_anchors and source_db == "anchor":
            continue
        path = bibs_dir / filename
        if not path.exists():
            if source_db != "anchor":
                warnings.append(f"missing file: {path}")
            continue
        parsed, file_warnings = parse_bib_file(path, source_db, seen_bib_keys=seen_bib_keys)
        records.extend(parsed)
        warnings.extend(file_warnings)
        counts[source_db] = len(parsed)

    return records, warnings, counts
