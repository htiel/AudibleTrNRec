from __future__ import annotations

import hashlib
import math
import re
from datetime import UTC, datetime
from typing import Any

from . import SOURCE_NAME

MAX_TEXT = 4096
CONTROL_CHARACTERS = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")


class NormalizeError(RuntimeError):
    pass


def _text(value: Any, *, required: bool = False, maximum: int = MAX_TEXT) -> str | None:
    if value is None:
        if required:
            raise NormalizeError("required-text-missing")
        return None
    if not isinstance(value, str):
        if required:
            raise NormalizeError("required-text-invalid")
        return None
    cleaned = CONTROL_CHARACTERS.sub("", value).strip()
    if required and not cleaned:
        raise NormalizeError("required-text-missing")
    if len(cleaned) > maximum:
        if required:
            raise NormalizeError("text-too-long")
        return None
    return cleaned or None


def _number(value: Any, *, minimum: float = 0, maximum: float = 1_000_000) -> float | None:
    if isinstance(value, str) and re.fullmatch(r"\d+(?:\.\d+)?", value):
        value = float(value)
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return None
    result = float(value)
    if not math.isfinite(result) or not minimum <= result <= maximum:
        return None
    return result


def _identifier(kind: str, value: str) -> str:
    digest = hashlib.sha256(value.encode("utf-8")).hexdigest()[:32]
    return f"aud-us-{kind}-{digest}"


def _date(value: Any) -> str | None:
    text = _text(value, maximum=64)
    if not text:
        return None
    try:
        parsed = datetime.fromisoformat(text.replace("Z", "+00:00"))
    except ValueError:
        return None
    if parsed.tzinfo is None:
        return None
    return parsed.astimezone(UTC).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def _contributor(
    raw: Any,
    *,
    role: str,
    people: dict[str, dict[str, Any]],
) -> str | None:
    if not isinstance(raw, dict):
        return None
    name = _text(raw.get("name"), required=True, maximum=200)
    source_id = _text(raw.get("asin"), maximum=128) or f"name:{name}"
    person_id = _identifier("person", f"{role}:{source_id}")
    existing = people.get(person_id)
    if existing:
        if role not in existing["roles"]:
            existing["roles"].append(role)
            existing["roles"].sort()
    else:
        people[person_id] = {
            "personId": person_id,
            "displayName": name,
            "sortName": name,
            "roles": [role],
        }
    return person_id


def _series(
    raw_series: Any,
    facets: dict[str, dict[str, Any]],
) -> tuple[str | None, float | None]:
    if not isinstance(raw_series, list) or not raw_series:
        return None, None
    raw = raw_series[0]
    if not isinstance(raw, dict):
        return None, None
    name = _text(raw.get("title") or raw.get("name"), required=True, maximum=200)
    source_id = _text(raw.get("asin"), maximum=128) or f"name:{name}"
    facet_id = _identifier("series", source_id)
    facets[facet_id] = {"facetId": facet_id, "type": "series", "name": name}
    position = _number(raw.get("sequence"), minimum=0, maximum=999)
    return facet_id, position


def _categories(
    ladders: Any,
    facets: dict[str, dict[str, Any]],
) -> list[str]:
    if not isinstance(ladders, list):
        return []
    result: list[str] = []
    for ladder in ladders[:20]:
        if not isinstance(ladder, dict):
            continue
        nodes = ladder.get("ladder")
        if not isinstance(nodes, list) or not nodes:
            continue
        leaf = nodes[-1]
        if not isinstance(leaf, dict):
            continue
        name = _text(leaf.get("name"), maximum=200)
        if not name:
            continue
        source_id = _text(leaf.get("id"), maximum=128) or f"name:{name}"
        facet_id = _identifier("genre", source_id)
        facets[facet_id] = {"facetId": facet_id, "type": "genre", "name": name}
        if facet_id not in result:
            result.append(facet_id)
    return sorted(result)


def _progress(value: Any) -> float | None:
    number = _number(value, minimum=0, maximum=100)
    if number is None:
        return None
    return round(number * 100 if number <= 1 else number, 3)


def _status(item: dict[str, Any], percent: float | None) -> str:
    if item.get("is_finished") is True:
        return "completed"
    raw = (_text(item.get("listening_status"), maximum=64) or "").lower()
    if raw in {"finished", "completed"}:
        return "completed"
    if raw in {"in_progress", "in-progress", "started"} or (percent is not None and percent > 0):
        return "in-progress"
    if raw in {"not_started", "not-started"} or percent == 0:
        return "not-started"
    return "unknown"


def normalize_library(items: list[Any], *, marketplace: str, observed_at: str) -> dict[str, Any]:
    if marketplace != "us":
        raise NormalizeError("marketplace-not-allowed")

    people: dict[str, dict[str, Any]] = {}
    facets: dict[str, dict[str, Any]] = {}
    books: list[dict[str, Any]] = []
    entries: list[dict[str, Any]] = []
    seen: set[str] = set()

    for raw in items:
        if not isinstance(raw, dict):
            raise NormalizeError("library-record-invalid")
        asin = _text(raw.get("asin"), required=True, maximum=128)
        title = _text(raw.get("title"), required=True, maximum=200)
        book_id = _identifier("book", f"{marketplace}:{asin}")
        if book_id in seen:
            raise NormalizeError("library-record-duplicate")
        seen.add(book_id)

        author_ids = [
            person_id
            for contributor in (raw.get("authors") if isinstance(raw.get("authors"), list) else [])[:100]
            if (person_id := _contributor(contributor, role="author", people=people))
        ]
        narrator_ids = [
            person_id
            for contributor in (raw.get("narrators") if isinstance(raw.get("narrators"), list) else [])[:100]
            if (person_id := _contributor(contributor, role="narrator", people=people))
        ]
        series_id, series_position = _series(raw.get("series"), facets)
        genre_ids = _categories(raw.get("category_ladders"), facets)
        percent = _progress(raw.get("percent_complete"))
        origin_asin = _text(raw.get("origin_asin"), maximum=128)

        books.append(
            {
                "bookId": book_id,
                "workId": _identifier("work", f"{marketplace}:{origin_asin or asin}"),
                "title": title,
                "subtitle": _text(raw.get("subtitle"), maximum=200),
                "authorIds": sorted(set(author_ids)),
                "narratorIds": sorted(set(narrator_ids)),
                "seriesId": series_id,
                "seriesPosition": series_position,
                "genreIds": genre_ids,
                "themeIds": [],
                "topicId": None,
                "language": _text(raw.get("language"), maximum=16) or "unknown",
                "durationMinutes": _number(
                    raw.get("runtime_length_min"), minimum=0, maximum=100_000
                ),
                "releaseDate": _date(
                    raw.get("release_date") or raw.get("publication_datetime")
                ),
                "coverRef": None,
                "synopsis": _text(
                    raw.get("publisher_summary")
                    or raw.get("merchandising_summary")
                    or raw.get("short_description"),
                    maximum=2000,
                ),
                "contentFlags": [],
                "qualityScore": None,
                "credibilityScore": None,
                "viewpoint": None,
                "available": raw.get("is_playable") is True
                or raw.get("is_listenable") is True,
            }
        )
        entries.append(
            {
                "bookId": book_id,
                "status": _status(raw, percent),
                "percentComplete": percent,
                "positionSeconds": None,
                "acquiredAt": _date(raw.get("purchase_date")),
                "lastListenedAt": None,
                "completedAt": None,
            }
        )

    books.sort(key=lambda value: value["bookId"])
    entries.sort(key=lambda value: value["bookId"])
    return {
        "schemaVersion": 1,
        "source": SOURCE_NAME,
        "marketplace": marketplace,
        "observedAt": observed_at,
        "catalog": {
            "people": sorted(people.values(), key=lambda value: value["personId"]),
            "facets": sorted(facets.values(), key=lambda value: value["facetId"]),
            "books": books,
        },
        "entries": entries,
    }
