from __future__ import annotations

import json
import sys
from typing import Any

from .custody import CustodyError
from .policy import PolicyError
from .service import ConnectorError, ConnectorService, configure_process_safety

MAX_REQUEST_BYTES = 40 * 1024 * 1024


def _read_request() -> dict[str, Any]:
    raw = sys.stdin.buffer.read(MAX_REQUEST_BYTES + 1)
    if len(raw) > MAX_REQUEST_BYTES:
        raise ConnectorError("rpc-request-too-large")
    try:
        request = json.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise ConnectorError("rpc-request-invalid") from error
    if not isinstance(request, dict) or set(request) - {"method", "params"}:
        raise ConnectorError("rpc-request-invalid")
    if not isinstance(request.get("method"), str):
        raise ConnectorError("rpc-request-invalid")
    if not isinstance(request.get("params", {}), dict):
        raise ConnectorError("rpc-request-invalid")
    return request


def _dispatch(service: ConnectorService, request: dict[str, Any]) -> dict[str, Any]:
    method = request["method"]
    params = request.get("params", {})
    if method == "status" and not params:
        return service.status()
    if method == "connect" and set(params) == {"marketplace", "accountAlias"}:
        return service.connect(
            marketplace=params["marketplace"],
            account_alias=params["accountAlias"],
        )
    if method == "sync_library" and not params:
        return service.sync_library()
    if method == "disconnect" and not params:
        return service.disconnect()
    if method == "unseal_snapshot" and set(params) == {"sealedSnapshot"}:
        # Purpose-bound: opens a library snapshot only. A private-review
        # envelope is refused by the header check, not merely by inspection.
        return service.unseal(params["sealedSnapshot"])
    if method == "verify_custody" and not params:
        # Custody proof only: no provider access, no credential read, no state
        # write. Must succeed before any migration or rollback envelope write.
        return service.verify_custody()
    if method == "local_artifact_inventory" and not params:
        # Existence booleans for connector-owned artifacts, so a local
        # deletion report can disclose what it does not remove instead of
        # claiming it did. No credential is read or opened.
        return service.local_artifact_inventory()
    if method == "seal_snapshot" and set(params) == {"snapshot"}:
        # Local custody only; dispatched separately from every provider route.
        return service.seal(params["snapshot"])
    if method == "seal_local" and set(params) == {"payload"}:
        # Local user-owned record custody (private reviews). No provider access.
        return service.seal_local(params["payload"])
    if method == "unseal_local" and set(params) == {"sealedPayload"}:
        return service.unseal_local(params["sealedPayload"])
    raise ConnectorError("rpc-method-not-allowed")


#: Closed diagnostic vocabulary allowed to leave the connector alongside a code.
DIAGNOSTIC_CATEGORIES = frozenset(
    {
        "missing-required-field",
        "invalid-field-value",
        "unsupported-record-shape",
        "duplicate-record",
        "limit-exceeded",
        "unclassified",
    }
)


def _safe_detail(error: Exception) -> dict[str, Any] | None:
    """Reduce an error detail to a bounded position + closed category.

    A source value, message or field name can never reach this output.
    """

    detail = getattr(error, "detail", None)
    if not isinstance(detail, dict):
        return None
    category = detail.get("category")
    safe: dict[str, Any] = {
        "category": category if category in DIAGNOSTIC_CATEGORIES else "unclassified"
    }
    index = detail.get("recordIndex")
    if isinstance(index, int) and not isinstance(index, bool) and 0 <= index < 1_000_000:
        safe["recordIndex"] = index
    return safe


def main() -> int:
    configure_process_safety()
    try:
        result = _dispatch(ConnectorService(), _read_request())
        response = {"ok": True, "result": result}
    except (ConnectorError, CustodyError, PolicyError) as error:
        code = getattr(error, "code", str(error))
        failure: dict[str, Any] = {"code": code}
        detail = _safe_detail(error)
        if detail is not None:
            failure["detail"] = detail
        response = {"ok": False, "error": failure}
    except Exception:
        response = {"ok": False, "error": {"code": "connector-internal-error"}}
    sys.stdout.write(json.dumps(response, ensure_ascii=True, separators=(",", ":")))
    sys.stdout.flush()
    return 0 if response["ok"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
