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
        return service.unseal(params["sealedSnapshot"])
    raise ConnectorError("rpc-method-not-allowed")


def main() -> int:
    configure_process_safety()
    try:
        result = _dispatch(ConnectorService(), _read_request())
        response = {"ok": True, "result": result}
    except (ConnectorError, CustodyError, PolicyError) as error:
        code = getattr(error, "code", str(error))
        response = {"ok": False, "error": {"code": code}}
    except Exception:
        response = {"ok": False, "error": {"code": "connector-internal-error"}}
    sys.stdout.write(json.dumps(response, ensure_ascii=True, separators=(",", ":")))
    sys.stdout.flush()
    return 0 if response["ok"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
