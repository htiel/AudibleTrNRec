"""Normalization of source library records into the closed snapshot contract.

Three rules govern this module (ATR-S021, ATR-S023, ATR-S026):

1. **Declared units only.** A source field's unit comes from
   `contracts/source-contract.json`. A 0.5 never becomes 50 because it "looks
   fractional"; completion status is never derived from a unit conversion.
2. **Complete or stop.** A malformed record aborts the whole capture with a
   bounded positional, category-only diagnostic. There is no partial promotion
   and no silent truncation.
3. **Identity is proven, not guessed.** Two contributors are the same person
   only when the provider gives the same identifier. Equal display names never
   merge, and a name-only record gets a per-occurrence surrogate that stays
   separate until an explicit reviewed mapping exists.
"""

from __future__ import annotations

import hashlib
import html
import math
import re
from datetime import UTC, datetime
from typing import Any

from . import SOURCE_NAME
from .contract import (
    CATEGORY_LADDER_LIMIT,
    CONTRACT_REVISION,
    CONTRIBUTOR_LIMIT,
    progress_scale,
)

MAX_TEXT = 4096
CONTROL_CHARACTERS = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")

#: Maximum prose length kept for a synopsis. Over-limit prose is **omitted**,
#: never truncated: a half sentence is a worse lie than an honest absence.
MAX_SYNOPSIS = 2000

#: Hard ceiling on the raw provider string the markup normalizer will even
#: look at. Bounds the work performed on untrusted input; an over-size value
#: is omitted, exactly like over-limit prose.
MAX_MARKUP_INPUT = 64 * 1024

#: Declared evidence for the series relationship of a title.
#:
#: ``unknown`` means the provider said nothing we can rely on. It is **not**
#: proof that the title is standalone: this connector has no authoritative
#: standalone signal, so it never emits ``confirmed-standalone``. The value
#: exists in the contract so a future authoritative source can supply it
#: without every downstream surface changing shape.
SERIES_EVIDENCE = ("provider-supplied", "unknown", "confirmed-standalone")

#: Closed diagnostic vocabulary. Mirrors the Node core categories so one
#: rejection reads the same on both sides of the boundary.
DIAGNOSTIC_CATEGORIES = (
    "missing-required-field",
    "invalid-field-value",
    "unsupported-record-shape",
    "duplicate-record",
    "limit-exceeded",
    "unclassified",
)

PROGRESS_FIELD = "percent_complete"

ZONE_QUALIFIED = re.compile(
    r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$"
)


class NormalizeError(RuntimeError):
    """A bounded, category-only normalization failure.

    Only the code, the closed category and the positional record index ever
    cross a boundary. Source values and field content never do.
    """

    def __init__(
        self,
        code: str,
        *,
        category: str = "unclassified",
        record_index: int | None = None,
    ) -> None:
        super().__init__(code)
        self.code = code
        self.category = category if category in DIAGNOSTIC_CATEGORIES else "unclassified"
        self.record_index = record_index

    def diagnostic(self) -> dict[str, Any]:
        detail: dict[str, Any] = {"code": self.code, "category": self.category}
        if self.record_index is not None:
            detail["recordIndex"] = self.record_index
        return detail


def _text(value: Any, *, required: bool = False, maximum: int = MAX_TEXT) -> str | None:
    if value is None:
        if required:
            raise NormalizeError("required-text-missing", category="missing-required-field")
        return None
    if not isinstance(value, str):
        if required:
            raise NormalizeError("required-text-invalid", category="invalid-field-value")
        return None
    cleaned = CONTROL_CHARACTERS.sub("", value).strip()
    if required and not cleaned:
        raise NormalizeError("required-text-missing", category="missing-required-field")
    if len(cleaned) > maximum:
        if required:
            raise NormalizeError("text-too-long", category="limit-exceeded")
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


#: Tags whose *content* is discarded along with the tag. These never carry
#: reader-facing prose, and their bodies are exactly where executable or
#: resource-bearing payloads live. The body is dropped without being parsed,
#: interpreted, or reproduced anywhere.
_DROP_CONTENT_TAGS = frozenset({
    "script", "style", "noscript", "template", "iframe", "frame", "frameset",
    "object", "embed", "applet", "svg", "math", "head", "title", "link", "meta", "base",
})

#: Tags that end a line of prose.
_LINE_BREAK_TAGS = frozenset({"br"})

#: Tags that end a paragraph of prose. A paragraph boundary is the only
#: structure this normalizer preserves; nothing else about the markup survives.
_PARAGRAPH_TAGS = frozenset({
    "p", "div", "section", "article", "aside", "header", "footer", "main", "nav",
    "address", "blockquote", "pre", "figure", "figcaption", "hr",
    "h1", "h2", "h3", "h4", "h5", "h6",
    "ul", "ol", "li", "dl", "dt", "dd",
    "table", "thead", "tbody", "tfoot", "tr", "td", "th", "caption", "col", "colgroup",
    "form", "fieldset", "legend", "details", "summary", "dialog", "hgroup", "search",
})

#: Inline tags that are removed while their text is kept.
_INLINE_TAGS = frozenset({
    "a", "abbr", "b", "bdi", "bdo", "cite", "code", "data", "del", "dfn", "em", "i",
    "ins", "kbd", "mark", "q", "rp", "rt", "ruby", "s", "samp", "small", "span",
    "strong", "sub", "sup", "time", "u", "var", "wbr", "font", "big", "strike", "tt",
    "center", "nobr", "img", "picture", "source", "audio", "video", "track", "map", "area",
    "button", "input", "label", "option", "select", "textarea", "optgroup", "output",
    "progress", "meter", "slot", "body", "html",
})

#: The closed vocabulary this normalizer recognizes as markup. An angle
#: bracket that does not open one of these names is *not* treated as a tag:
#: it stays literal text, so plain prose such as "5 < 6" survives untouched
#: instead of being silently eaten by a speculative parser.
_KNOWN_TAGS = _DROP_CONTENT_TAGS | _LINE_BREAK_TAGS | _PARAGRAPH_TAGS | _INLINE_TAGS

_TAG_RE = re.compile(r"<(?P<close>/?)(?P<name>[A-Za-z][A-Za-z0-9:-]{0,31})(?P<rest>[^>]*)>", re.S)
_DECLARATION_RE = re.compile(r"<[!?][^>]*>", re.S)
_INLINE_SPACE_RE = re.compile(r"[^\S\n]+")

#: Invisible characters removed from prose: zero-width and byte-order marks,
#: the replacement character produced by malformed escapes, and the bidi
#: overrides that can make rendered text read differently from its content.
#: None of them carry meaning for a reader; all of them can disguise one.
_INVISIBLE_RE = re.compile(r"[\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff\ufffd]")


def _close_tag_end(value: str, name: str, start: int) -> int:
    """Index just past ``</name...>``, or end-of-string when never closed.

    An unclosed drop-content tag consumes the remainder. That is deliberate:
    the alternative is emitting the inside of an unterminated ``<script>`` as
    prose.
    """

    lowered = value.lower()
    probe = start
    needle = f"</{name}"
    while True:
        found = lowered.find(needle, probe)
        if found == -1:
            return len(value)
        end = value.find(">", found)
        if end == -1:
            return len(value)
        after = lowered[found + len(needle):end]
        if after.strip() == "":
            return end + 1
        probe = end + 1


def _strip_markup(value: str) -> str:
    """Replace recognized markup with plain-text structure.

    The scanner never builds a DOM, never resolves a URL, never evaluates an
    attribute and never re-emits a tag. It performs a single left-to-right
    pass and emits only text plus newline structure, so the result cannot
    carry a script, an event handler or an embedded resource *as markup*.
    """

    out: list[str] = []
    index = 0
    length = len(value)
    while index < length:
        char = value[index]
        if char != "<":
            nxt = value.find("<", index)
            if nxt == -1:
                nxt = length
            out.append(value[index:nxt])
            index = nxt
            continue
        if value.startswith("<!--", index):
            end = value.find("-->", index + 4)
            index = length if end == -1 else end + 3
            continue
        declaration = _DECLARATION_RE.match(value, index)
        if declaration:
            index = declaration.end()
            continue
        match = _TAG_RE.match(value, index)
        name = (match.group("name").lower() if match else "")
        if not match or name not in _KNOWN_TAGS:
            # Not markup from the closed vocabulary: a literal angle bracket.
            out.append("<")
            index += 1
            continue
        index = match.end()
        closing = match.group("close") == "/"
        if name in _DROP_CONTENT_TAGS:
            if not closing:
                index = _close_tag_end(value, name, index)
            out.append("\n\n")
        elif name in _LINE_BREAK_TAGS:
            out.append("\n")
        elif name in _PARAGRAPH_TAGS:
            out.append("\n\n")
    return "".join(out)


def plain_text_from_markup(value: Any, *, maximum: int = MAX_SYNOPSIS) -> str | None:
    """Normalize possibly-marked-up provider prose into bounded plain text.

    Contract:

    * markup is **removed**, never interpreted and never re-emitted, so the
      result cannot execute a script, carry an event handler or reference an
      embedded resource;
    * character entities are decoded *after* tag removal, so an escaped
      ``&lt;p&gt;`` stays the literal text the publisher wrote rather than
      being promoted into structure;
    * paragraph boundaries survive as a blank line; nothing else does;
    * text that is already plain comes back unchanged apart from whitespace
      collapsing;
    * over-size input and over-length results are **omitted** (``None``),
      never truncated mid-sentence.

    Instruction-bearing prose ("ignore previous instructions...") is treated
    exactly like any other prose: it is text, it is bounded, and nothing here
    acts on it.
    """

    if not isinstance(value, str):
        return None
    if len(value) > MAX_MARKUP_INPUT:
        return None
    stripped = _strip_markup(value)
    decoded = html.unescape(stripped)
    # Entity decoding can reintroduce control characters; remove them after,
    # keeping only the newline structure the scanner produced.
    cleaned = CONTROL_CHARACTERS.sub("", decoded.replace("\r\n", "\n").replace("\r", "\n"))
    cleaned = _INVISIBLE_RE.sub("", cleaned)
    paragraphs = [
        collapsed
        for line in cleaned.split("\n")
        if (collapsed := _INLINE_SPACE_RE.sub(" ", line).strip())
    ]
    text = "\n\n".join(paragraphs)
    if not text or len(text) > maximum:
        return None
    return text


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


def _progress(value: Any) -> float | None:
    """Convert a source progress value using its **declared** scale only.

    Absent means unknown. Present-but-invalid is a malformed record, never a
    silent zero and never a completion signal.
    """

    declared = progress_scale(PROGRESS_FIELD)
    if declared is None:  # pragma: no cover - contract guarantees the field
        raise NormalizeError("progress-field-undeclared", category="unsupported-record-shape")
    if value is None:
        return None
    if declared["scale"] != "percent-0-100":
        raise NormalizeError("progress-scale-unsupported", category="unsupported-record-shape")
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise NormalizeError("progress-value-invalid", category="invalid-field-value")
    number = float(value)
    if not math.isfinite(number):
        raise NormalizeError("progress-value-invalid", category="invalid-field-value")
    if number < declared["minimum"] or number > declared["maximum"]:
        raise NormalizeError("progress-value-out-of-range", category="invalid-field-value")
    # The declared scale is already a percentage: the value is preserved, not
    # rescaled. Rounding only removes binary float noise.
    return round(number, 3)


def _person(
    raw: Any,
    *,
    role: str,
    occurrence: str,
    people: dict[str, dict[str, Any]],
) -> str | None:
    """Resolve one contributor to a stable person identity.

    Provider identifier -> one person shared across every role.
    No provider identifier -> a per-occurrence surrogate that never merges.
    """

    if not isinstance(raw, dict):
        raise NormalizeError("contributor-record-invalid", category="unsupported-record-shape")
    name = _text(raw.get("name"), required=True, maximum=200)
    provider_id = _text(raw.get("asin"), maximum=128)
    if provider_id:
        basis = "provider-id"
        person_id = _identifier("person", f"provider-id:{provider_id}")
    else:
        basis = "source-record-occurrence"
        person_id = _identifier("person", f"occurrence:{occurrence}")

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
            "identityBasis": basis,
        }
    return person_id


def _contributors(
    raw_list: Any,
    *,
    role: str,
    book_key: str,
    people: dict[str, dict[str, Any]],
    record_index: int,
) -> list[str]:
    if raw_list is None:
        return []
    if not isinstance(raw_list, list):
        raise NormalizeError(
            "contributor-list-invalid",
            category="unsupported-record-shape",
            record_index=record_index,
        )
    if len(raw_list) > CONTRIBUTOR_LIMIT:
        # Never truncate: an over-limit record is refused so the user is told
        # the library is incomplete instead of being shown a shortened one.
        raise NormalizeError(
            "contributor-limit-exceeded",
            category="limit-exceeded",
            record_index=record_index,
        )
    resolved: list[str] = []
    for index, raw in enumerate(raw_list):
        try:
            person_id = _person(
                raw,
                role=role,
                occurrence=f"{book_key}:{role}:{index}",
                people=people,
            )
        except NormalizeError as error:
            error.record_index = record_index
            raise
        if person_id:
            resolved.append(person_id)
    return resolved


def _series(
    raw_series: Any,
    *,
    book_key: str,
    facets: dict[str, dict[str, Any]],
) -> tuple[str | None, float | None, str]:
    """Resolve the series relationship **and the evidence behind it**.

    Absence is not proof. An omitted, empty or unusable series list means the
    provider told us nothing, so the evidence is ``unknown``. It is never
    promoted to ``confirmed-standalone``: this source publishes no
    authoritative standalone signal, and "no series field" is equally
    consistent with a response-group gap, a catalog gap, or a genuine
    standalone title.
    """

    if not isinstance(raw_series, list) or not raw_series:
        return None, None, "unknown"
    raw = raw_series[0]
    if not isinstance(raw, dict):
        return None, None, "unknown"
    name = _text(raw.get("title") or raw.get("name"), required=True, maximum=200)
    provider_id = _text(raw.get("asin"), maximum=128)
    if provider_id:
        facet_id = _identifier("series", f"provider-id:{provider_id}")
        basis = "provider-id"
    else:
        facet_id = _identifier("series", f"occurrence:{book_key}:series")
        basis = "source-record-occurrence"
    facets.setdefault(
        facet_id,
        {"facetId": facet_id, "type": "series", "name": name, "identityBasis": basis},
    )
    position = _number(raw.get("sequence"), minimum=0, maximum=999)
    return facet_id, position, "provider-supplied"


def _categories(
    ladders: Any,
    *,
    book_key: str,
    facets: dict[str, dict[str, Any]],
) -> list[str]:
    if not isinstance(ladders, list):
        return []
    result: list[str] = []
    for ladder_index, ladder in enumerate(ladders[:CATEGORY_LADDER_LIMIT]):
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
        provider_id = _text(leaf.get("id"), maximum=128)
        if provider_id:
            facet_id = _identifier("genre", f"provider-id:{provider_id}")
            basis = "provider-id"
        else:
            facet_id = _identifier("genre", f"occurrence:{book_key}:genre:{ladder_index}")
            basis = "source-record-occurrence"
        facets.setdefault(
            facet_id,
            {"facetId": facet_id, "type": "genre", "name": name, "identityBasis": basis},
        )
        if facet_id not in result:
            result.append(facet_id)
    return sorted(result)


def _status(item: dict[str, Any], percent: float | None) -> str:
    """Listening state. Deliberately independent of unit conversion."""

    if item.get("is_finished") is True:
        return "completed"
    raw = (_text(item.get("listening_status"), maximum=64) or "").lower()
    if raw in {"finished", "completed"}:
        return "completed"
    if raw in {"in_progress", "in-progress", "started"}:
        return "in-progress"
    if raw in {"not_started", "not-started"}:
        return "not-started"
    if percent is None:
        return "unknown"
    if percent > 0:
        return "in-progress"
    return "not-started"


def _assert_observed_at(observed_at: Any) -> str:
    if not isinstance(observed_at, str) or not ZONE_QUALIFIED.fullmatch(observed_at):
        raise NormalizeError("observed-at-invalid", category="invalid-field-value")
    try:
        parsed = datetime.fromisoformat(observed_at.replace("Z", "+00:00"))
    except ValueError as error:
        raise NormalizeError("observed-at-invalid", category="invalid-field-value") from error
    if parsed.tzinfo is None:
        raise NormalizeError("observed-at-invalid", category="invalid-field-value")
    return observed_at


def normalize_library(items: list[Any], *, marketplace: str, observed_at: str) -> dict[str, Any]:
    if marketplace != "us":
        raise NormalizeError("marketplace-not-allowed", category="invalid-field-value")
    observed_at = _assert_observed_at(observed_at)

    people: dict[str, dict[str, Any]] = {}
    facets: dict[str, dict[str, Any]] = {}
    books: list[dict[str, Any]] = []
    entries: list[dict[str, Any]] = []
    seen: set[str] = set()

    for record_index, raw in enumerate(items):
        if not isinstance(raw, dict):
            raise NormalizeError(
                "library-record-invalid",
                category="unsupported-record-shape",
                record_index=record_index,
            )
        try:
            asin = _text(raw.get("asin"), required=True, maximum=128)
            title = _text(raw.get("title"), required=True, maximum=200)
        except NormalizeError as error:
            error.record_index = record_index
            raise
        book_id = _identifier("book", f"{marketplace}:{asin}")
        if book_id in seen:
            raise NormalizeError(
                "library-record-duplicate",
                category="duplicate-record",
                record_index=record_index,
            )
        seen.add(book_id)
        book_key = f"{marketplace}:{asin}"

        author_ids = _contributors(
            raw.get("authors"),
            role="author",
            book_key=book_key,
            people=people,
            record_index=record_index,
        )
        narrator_ids = _contributors(
            raw.get("narrators"),
            role="narrator",
            book_key=book_key,
            people=people,
            record_index=record_index,
        )
        try:
            series_id, series_position, series_evidence = _series(
                raw.get("series"), book_key=book_key, facets=facets
            )
            genre_ids = _categories(
                raw.get("category_ladders"), book_key=book_key, facets=facets
            )
            percent = _progress(raw.get(PROGRESS_FIELD))
        except NormalizeError as error:
            error.record_index = record_index
            raise
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
                "seriesEvidence": series_evidence,
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
                "synopsis": plain_text_from_markup(
                    raw.get("publisher_summary")
                    or raw.get("merchandising_summary")
                    or raw.get("short_description"),
                    maximum=MAX_SYNOPSIS,
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

    # Referential integrity is asserted before the snapshot leaves this process:
    # an entry may never point at a book the catalog does not contain, and a
    # book may never point at a person or facet that was not emitted.
    book_ids = {book["bookId"] for book in books}
    for entry in entries:
        if entry["bookId"] not in book_ids:
            raise NormalizeError("entry-book-missing", category="unsupported-record-shape")
    for book in books:
        for person_id in book["authorIds"] + book["narratorIds"]:
            if person_id not in people:
                raise NormalizeError("book-person-missing", category="unsupported-record-shape")
        for facet_id in book["genreIds"] + ([book["seriesId"]] if book["seriesId"] else []):
            if facet_id not in facets:
                raise NormalizeError("book-facet-missing", category="unsupported-record-shape")

    return {
        "schemaVersion": 1,
        "source": SOURCE_NAME,
        "marketplace": marketplace,
        "observedAt": observed_at,
        "sourceContractRevision": CONTRACT_REVISION,
        "catalog": {
            "people": sorted(people.values(), key=lambda value: value["personId"]),
            "facets": sorted(facets.values(), key=lambda value: value["facetId"]),
            "books": books,
        },
        "entries": entries,
    }
