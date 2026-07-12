from __future__ import annotations

import re
import unicodedata

_ARTICLE_WORDS = frozenset({"a", "an", "the"})
_AUTHOR_DATE_KEY = re.compile(r"^[A-Z][A-Za-z]*\d{4}")


def is_author_date_key(key: str) -> bool:
    return bool(key and _AUTHOR_DATE_KEY.match(key))


def _strip_latex(text: str) -> str:
    value = text
    while True:
        updated = re.sub(r"\{([^{}]*)\}", r"\1", value)
        if updated == value:
            return value
        value = updated


def _author_surname(authors: str) -> str:
    if not authors:
        return "Unknown"

    first = re.split(r"\s+and\s+", authors, maxsplit=1)[0].strip()
    if "," in first:
        surname = first.split(",", 1)[0].strip()
    else:
        parts = first.split()
        surname = parts[-1] if parts else "Unknown"

    normalized = unicodedata.normalize("NFKD", surname)
    normalized = "".join(char for char in normalized if not unicodedata.combining(char))
    letters = re.sub(r"[^a-zA-Z]", "", normalized)
    if not letters:
        return "Unknown"
    return letters[0].upper() + letters[1:]


def _title_tokens(title: str) -> list[str]:
    clean = _strip_latex(title)
    tokens = re.findall(r"[A-Za-z][A-Za-z0-9]*", clean)
    return [token for token in tokens if token.lower() not in _ARTICLE_WORDS]


def _first_title_word(title: str) -> str:
    tokens = _title_tokens(title)
    return tokens[0] if tokens else ""


def make_bib_key(
    authors: str,
    year: str | int | None,
    title: str,
    *,
    existing: set[str] | None = None,
) -> str:
    author = _author_surname(authors)
    year_str = normalize_year(year) or "0000"
    tokens = _title_tokens(title)
    base = f"{author}{year_str}{tokens[0]}" if tokens else f"{author}{year_str}"

    if existing is None:
        return base

    if base not in existing:
        existing.add(base)
        return base

    if len(tokens) > 1:
        extended = f"{author}{year_str}{tokens[0]}{tokens[1]}"
        if extended not in existing:
            existing.add(extended)
            return extended

    suffix = ord("a")
    while f"{base}{chr(suffix)}" in existing:
        suffix += 1
    key = f"{base}{chr(suffix)}"
    existing.add(key)
    return key


from slr.models import Record


def assign_bib_keys(records: list[Record], *, preserve_existing: bool = True) -> None:
    """Assign unique AuthorDateFirstWordTitle keys in place."""
    seen: set[str] = set()
    for record in records:
        current = record.bib_key
        if preserve_existing and is_author_date_key(current):
            if current in seen:
                record.bib_key = make_bib_key(
                    record.authors,
                    record.year,
                    record.title,
                    existing=seen,
                )
            else:
                seen.add(current)
            continue

        record.bib_key = make_bib_key(
            record.authors,
            record.year,
            record.title,
            existing=seen,
        )


def normalize_doi(doi: str) -> str:
    if not doi:
        return ""
    value = doi.strip().lower()
    value = re.sub(r"^https?://(dx\.)?doi\.org/", "", value)
    value = value.rstrip(".")
    return value


def normalize_title(title: str) -> str:
    if not title:
        return ""
    value = unicodedata.normalize("NFKD", title)
    value = value.lower()
    value = re.sub(r"[^\w\s]", " ", value)
    value = re.sub(r"\s+", " ", value).strip()
    return value


def normalize_year(year: str | int | None) -> str:
    if year is None:
        return ""
    text = str(year).strip()
    match = re.search(r"\d{4}", text)
    return match.group(0) if match else ""


def normalize_eprint(eprint: str) -> str:
    if not eprint:
        return ""
    value = eprint.strip().lower()
    value = re.sub(r"^arxiv:", "", value)
    return value
