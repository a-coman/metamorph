from __future__ import annotations

import json
import os
import time
from pathlib import Path
from typing import Literal

import httpx
from dotenv import load_dotenv
from pydantic import BaseModel, Field, ValidationError, field_validator

from slr.export import read_records_csv, write_records_csv
from slr.models import Record

VALID_DECISIONS = frozenset({"include", "exclude", "uncertain"})
VALID_MT = frozenset({"core", "cited_only", "none"})
VALID_LLM = frozenset({"core", "peripheral", "none"})
VALID_THEMES = frozenset({"T1", "T2", "T3", "T4"})


class ScreeningResult(BaseModel):
    decision: Literal["include", "exclude", "uncertain"]
    reason: str
    themes: list[str] = Field(default_factory=list)
    mt_relevance: Literal["core", "cited_only", "none"]
    llm_relevance: Literal["core", "peripheral", "none"]

    @field_validator("themes")
    @classmethod
    def validate_themes(cls, value: list[str]) -> list[str]:
        return [theme for theme in value if theme in VALID_THEMES]


def normalize_screening_payload(data: dict) -> dict:
    """Coerce common LLM schema mistakes before pydantic validation."""
    decision = str(data.get("decision", "uncertain")).strip().lower()
    if decision not in VALID_DECISIONS:
        decision = "uncertain"

    mt = str(data.get("mt_relevance", "none")).strip().lower()
    if mt not in VALID_MT:
        if mt in {"peripheral", "secondary", "marginal"}:
            mt = "cited_only"
        else:
            mt = "none"

    llm = str(data.get("llm_relevance", "none")).strip().lower()
    if llm not in VALID_LLM:
        if llm in {"cited_only", "secondary", "marginal"}:
            llm = "peripheral"
        elif llm == "core":
            llm = "core"
        else:
            llm = "none"

    themes_raw = data.get("themes") or []
    if isinstance(themes_raw, str):
        themes_raw = [part.strip() for part in themes_raw.replace("|", ",").split(",")]
    themes = []
    for theme in themes_raw:
        normalized = str(theme).strip().upper()
        if normalized in VALID_THEMES and normalized not in themes:
            themes.append(normalized)

    reason = str(data.get("reason", "")).strip() or "No reason provided."

    return {
        "decision": decision,
        "reason": reason,
        "themes": themes,
        "mt_relevance": mt,
        "llm_relevance": llm,
    }


def parse_screening_result(data: dict) -> ScreeningResult:
    try:
        return ScreeningResult.model_validate(normalize_screening_payload(data))
    except ValidationError:
        return ScreeningResult(
            decision="uncertain",
            reason="LLM returned an invalid screening payload; requires manual review.",
            themes=[],
            mt_relevance="none",
            llm_relevance="none",
        )


def _load_settings() -> tuple[str, str, float]:
    load_dotenv()
    api_key = os.getenv("OPENROUTER_API_KEY", "").strip()
    model = os.getenv("SLR_LLM_MODEL", "openai/gpt-4o-mini").strip()
    sleep_seconds = float(os.getenv("SLR_LLM_SLEEP_SECONDS", "0.5"))
    return api_key, model, sleep_seconds


def _cache_path(cache_dir: Path, record_id: str) -> Path:
    return cache_dir / f"{record_id}.json"


def _read_cache(cache_dir: Path, record_id: str) -> ScreeningResult | None:
    path = _cache_path(cache_dir, record_id)
    if not path.exists():
        return None
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        return parse_screening_result(data)
    except json.JSONDecodeError:
        return None


def _write_cache(cache_dir: Path, record_id: str, result: ScreeningResult) -> None:
    cache_dir.mkdir(parents=True, exist_ok=True)
    path = _cache_path(cache_dir, record_id)
    path.write_text(result.model_dump_json(indent=2), encoding="utf-8")


def _extract_json(content: str) -> dict:
    text = content.strip()
    if text.startswith("```"):
        text = text.strip("`")
        if text.startswith("json"):
            text = text[4:].strip()
    return json.loads(text)


def _call_openrouter(
    *,
    api_key: str,
    model: str,
    system_prompt: str,
    title: str,
    abstract: str,
    timeout: float = 60.0,
) -> ScreeningResult:
    user_prompt = (
        "Screen this paper for the Metamorph systematic mapping study.\n\n"
        f"Title: {title}\n\n"
        f"Abstract: {abstract or '(no abstract available)'}"
    )
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "temperature": 0,
        "response_format": {"type": "json_object"},
    }
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://github.com/metamorph",
        "X-Title": "Metamorph SLR Screening",
    }

    last_error: Exception | None = None
    for attempt in range(3):
        try:
            with httpx.Client(timeout=timeout) as client:
                response = client.post(
                    "https://openrouter.ai/api/v1/chat/completions",
                    headers=headers,
                    json=payload,
                )
                response.raise_for_status()
            body = response.json()
            content = body["choices"][0]["message"]["content"]
            parsed = _extract_json(content)
            return parse_screening_result(parsed)
        except (httpx.HTTPError, httpx.TimeoutException) as exc:
            last_error = exc
            time.sleep(1.5 * (attempt + 1))
        except json.JSONDecodeError as exc:
            last_error = exc
            time.sleep(1.5 * (attempt + 1))
    raise RuntimeError(f"OpenRouter screening failed after retries: {last_error}")


def _apply_result(record: Record, result: ScreeningResult) -> None:
    record.screen_decision = result.decision
    record.screen_reason = result.reason
    record.screen_themes = "|".join(result.themes)
    record.screen_mt_relevance = result.mt_relevance
    record.screen_llm_relevance = result.llm_relevance


def screen_records(
    records: list[Record],
    *,
    prompts_dir: Path,
    cache_dir: Path,
    dry_run: bool = False,
    limit: int | None = None,
    force: bool = False,
) -> list[Record]:
    system_prompt = (prompts_dir / "screen_system.txt").read_text(encoding="utf-8")
    api_key, model, sleep_seconds = _load_settings()

    if not dry_run and not api_key:
        raise RuntimeError("OPENROUTER_API_KEY is required unless --dry-run is set")

    screened: list[Record] = []
    processed = 0

    for record in records:
        if limit is not None and processed >= limit:
            screened.append(record)
            continue

        if not record.abstract.strip():
            record.screen_decision = "review_manual"
            record.screen_reason = "Missing abstract; requires manual screening"
            screened.append(record)
            processed += 1
            continue

        if not force:
            cached = _read_cache(cache_dir, record.record_id)
            if cached is not None:
                _apply_result(record, cached)
                screened.append(record)
                continue

        if dry_run:
            record.screen_decision = "dry_run"
            record.screen_reason = "dry-run: no LLM call made"
            screened.append(record)
            processed += 1
            continue

        result = _call_openrouter(
            api_key=api_key,
            model=model,
            system_prompt=system_prompt,
            title=record.title,
            abstract=record.abstract,
        )
        _write_cache(cache_dir, record.record_id, result)
        _apply_result(record, result)
        screened.append(record)
        processed += 1
        time.sleep(sleep_seconds)

    return screened


def screen_csv(
    input_path: Path,
    output_path: Path,
    *,
    prompts_dir: Path,
    cache_dir: Path,
    dry_run: bool = False,
    limit: int | None = None,
    force: bool = False,
) -> list[Record]:
    human_by_id: dict[str, str] = {}
    if output_path.exists():
        for existing in read_records_csv(output_path):
            if existing.human.strip():
                human_by_id[existing.record_id] = existing.human

    records = read_records_csv(input_path)
    screened = screen_records(
        records,
        prompts_dir=prompts_dir,
        cache_dir=cache_dir,
        dry_run=dry_run,
        limit=limit,
        force=force,
    )
    for record in screened:
        record.human = human_by_id.get(record.record_id, "")

    write_records_csv(screened, output_path)
    return screened
