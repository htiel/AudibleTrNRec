"""Canonical source-contract access for the connector runtime.

`contracts/source-contract.json` is the reviewed artifact (CP-01 input). This
module loads it once and exposes typed accessors. The values are *declared*:
no unit, limit or completeness claim is ever inferred from the magnitude,
shape or size of source data.

`test_contract.py` asserts that the loaded artifact and the frozen fallback
mirror below agree, so a silently edited or missing artifact fails closed
instead of quietly changing behaviour.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

CONTRACT_PATH = Path(__file__).resolve().parents[2] / "contracts" / "source-contract.json"

CONTRACT_REVISION = "atr-source-contract-r1"

#: Frozen mirror used to detect drift or a missing/edited artifact.
EXPECTED_KEYS = (
    "contractRevision",
    "status",
    "marketplace",
    "progressUnits",
    "contributorLimit",
    "facetLimits",
    "identity",
    "pagination",
    "recordPolicy",
    "observation",
)


class ContractError(RuntimeError):
    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


def _load() -> dict[str, Any]:
    try:
        raw = CONTRACT_PATH.read_text(encoding="utf-8")
    except OSError as error:  # pragma: no cover - environment failure
        raise ContractError("source-contract-unavailable") from error
    try:
        value = json.loads(raw)
    except json.JSONDecodeError as error:
        raise ContractError("source-contract-invalid") from error
    if not isinstance(value, dict) or any(key not in value for key in EXPECTED_KEYS):
        raise ContractError("source-contract-invalid")
    if value["contractRevision"] != CONTRACT_REVISION:
        raise ContractError("source-contract-revision-unsupported")
    return value


SOURCE_CONTRACT: dict[str, Any] = _load()

CONTRIBUTOR_LIMIT: int = int(SOURCE_CONTRACT["contributorLimit"])
CATEGORY_LADDER_LIMIT: int = int(SOURCE_CONTRACT["facetLimits"]["categoryLadders"])
MAX_PAGES: int = int(SOURCE_CONTRACT["pagination"]["maxPages"])
PAGE_SIZE: int = int(SOURCE_CONTRACT["pagination"]["pageSize"])
MAX_ITEMS: int = int(SOURCE_CONTRACT["pagination"]["maxItems"])
MAX_RESPONSE_BYTES: int = int(SOURCE_CONTRACT["pagination"]["maxCumulativeResponseBytes"])
BYTE_ACCOUNTING: str = str(SOURCE_CONTRACT["pagination"]["byteAccounting"])
BYTE_ACCOUNTING_IS_WIRE_PROOF: bool = bool(
    SOURCE_CONTRACT["pagination"]["byteAccountingIsWireProof"]
)
COMPLETENESS_BASES: tuple[str, ...] = tuple(SOURCE_CONTRACT["pagination"]["completenessBases"])


def progress_scale(field: str) -> dict[str, Any] | None:
    """Return the declared scale record for a source progress field."""

    declared = SOURCE_CONTRACT["progressUnits"].get(field)
    return declared if isinstance(declared, dict) else None
