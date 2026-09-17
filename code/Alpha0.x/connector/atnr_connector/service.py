from __future__ import annotations

import copy
import hashlib
import hmac
import json
import logging
import os
import re
import secrets
import warnings
from datetime import UTC, datetime
from typing import Any
from urllib.parse import parse_qs, urlparse

from .custody import (
    CustodyError,
    SecureJsonStore,
    WindowsDpapiProtector,
    seal_snapshot,
    unseal_snapshot,
)
from .normalize import NormalizeError, normalize_library
from .policy import PrivateAlphaPolicy, load_policy

MAX_PAGES = 20
PAGE_SIZE = 1000
MAX_RESPONSE_BYTES = 25 * 1024 * 1024
RESPONSE_GROUPS = ",".join(
    [
        "contributors",
        "media",
        "product_attrs",
        "product_desc",
        "product_details",
        "product_extended_attrs",
        "series",
        "categories",
        "is_finished",
        "listening_status",
        "percent_complete",
    ]
)


class ConnectorError(RuntimeError):
    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


def _now() -> str:
    return datetime.now(UTC).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def _safe_external_browser_callback(url: str) -> str:
    from audible.login import build_init_cookies
    from playwright.sync_api import Error, TimeoutError as PlaywrightTimeoutError
    from playwright.sync_api import sync_playwright

    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(channel="msedge", headless=False)
            context = browser.new_context(**playwright.devices["iPhone 15 Pro"])
            try:
                cookies = [
                    {"name": name, "value": value, "url": url}
                    for name, value in build_init_cookies().items()
                ]
                context.add_cookies(cookies)
                page = context.new_page()
                with page.expect_request("**/ap/maplanding*", timeout=600_000) as request:
                    page.goto(url, wait_until="domcontentloaded", timeout=120_000)
                final_url = request.value.url
            finally:
                context.close()
                browser.close()
    except PlaywrightTimeoutError as error:
        raise ConnectorError("authorization-timeout") from error
    except Error as error:
        raise ConnectorError("authorization-browser-failed") from error

    parsed = urlparse(final_url)
    query = parse_qs(parsed.query)
    if (
        parsed.scheme != "https"
        or not (parsed.hostname == "amazon.com" or (parsed.hostname or "").endswith(".amazon.com"))
        or not parsed.path.endswith("/ap/maplanding")
        or not query.get("openid.oa2.authorization_code")
    ):
        raise ConnectorError("authorization-callback-invalid")
    return final_url


ALIAS_PATTERN = re.compile(r"^[A-Za-z0-9][A-Za-z0-9 ._-]{0,63}$")


def _account_key(customer_info: Any, identity_key: bytes) -> str:
    if not isinstance(customer_info, dict):
        raise ConnectorError("account-identity-unavailable")
    user_id = customer_info.get("user_id")
    if not isinstance(user_id, str) or not user_id or len(user_id) > 512:
        raise ConnectorError("account-identity-unavailable")
    return hmac.new(
        identity_key,
        b"ATnR-account-v1\x00" + user_id.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()


def _authenticator(envelope: dict[str, Any]) -> Any:
    try:
        import audible

        auth_data = envelope["auth"]
        if not isinstance(auth_data, dict):
            raise KeyError("auth")
        return audible.Authenticator.from_dict(copy.deepcopy(auth_data))
    except (ImportError, KeyError, TypeError, ValueError) as error:
        raise ConnectorError("stored-authorization-invalid") from error


class ConnectorService:
    def __init__(
        self,
        *,
        policy: PrivateAlphaPolicy | None = None,
        store: SecureJsonStore | None = None,
        identity_store: SecureJsonStore | None = None,
        protector: WindowsDpapiProtector | None = None,
    ) -> None:
        self.policy = policy or load_policy()
        self.protector = protector or WindowsDpapiProtector()
        self.store = store or SecureJsonStore.credentials(self.protector)
        self.identity_store = identity_store or SecureJsonStore.identity(self.protector)

    def status(self) -> dict[str, Any]:
        if not self.store.exists():
            return self._public_status(None)
        envelope = self.store.read()
        return self._public_status(envelope)

    def connect(self, *, marketplace: str, account_alias: str) -> dict[str, Any]:
        if self.store.exists():
            raise ConnectorError("connection-already-exists")
        if marketplace not in self.policy.allowed_marketplaces:
            raise ConnectorError("marketplace-not-allowed")
        alias = account_alias.strip()
        if not ALIAS_PATTERN.fullmatch(alias):
            raise ConnectorError("account-alias-invalid")

        try:
            import audible
        except ImportError as error:
            raise ConnectorError("connector-dependency-unavailable") from error

        auth = None
        try:
            identity_key = self._identity_key()
            auth = audible.Authenticator.from_login_external(
                locale=marketplace,
                login_url_callback=_safe_external_browser_callback,
            )
            envelope = {
                "schemaVersion": 1,
                "appAbbreviation": self.policy.app_abbreviation,
                "providerDeviceDisplayName": self.policy.provider_device_display_name,
                "marketplace": marketplace,
                "accountAlias": alias,
                "accountKey": _account_key(auth.customer_info, identity_key),
                "registeredAt": _now(),
                "auth": auth.to_dict(),
            }
            self.store.write(envelope)
            return self._public_status(envelope)
        except ConnectorError:
            if auth is not None:
                self._cleanup_failed_registration(auth)
            raise
        except Exception as error:
            if auth is not None:
                self._cleanup_failed_registration(auth)
            raise ConnectorError("authorization-failed") from error

    def sync_library(self) -> dict[str, Any]:
        envelope = self.store.read()
        auth = _authenticator(envelope)
        try:
            import audible

            items: list[Any] = []
            response_bytes = 0
            with audible.Client(auth=auth) as client:
                for page in range(1, MAX_PAGES + 1):
                    response = client.get(
                        "library",
                        num_results=PAGE_SIZE,
                        page=page,
                        response_groups=RESPONSE_GROUPS,
                    )
                    if not isinstance(response, dict):
                        raise ConnectorError("library-response-invalid")
                    page_items = response.get("items")
                    if not isinstance(page_items, list):
                        raise ConnectorError("library-response-invalid")
                    response_bytes += len(
                        json.dumps(response, ensure_ascii=True, separators=(",", ":")).encode("utf-8")
                    )
                    if response_bytes > MAX_RESPONSE_BYTES:
                        raise ConnectorError("library-response-too-large")
                    items.extend(page_items)
                    if len(page_items) < PAGE_SIZE:
                        break
                else:
                    raise ConnectorError("library-page-limit")

            observed_at = _now()
            snapshot = normalize_library(
                items,
                marketplace=str(envelope["marketplace"]),
                observed_at=observed_at,
            )
            envelope["auth"] = auth.to_dict()
            envelope["lastSuccessfulSyncAt"] = observed_at
            self.store.write(envelope)
            return {
                "status": self._public_status(envelope),
                "itemCount": len(items),
                "snapshot": snapshot,
                "sealedSnapshot": seal_snapshot(snapshot, self.protector),
            }
        except ConnectorError:
            raise
        except NormalizeError as error:
            raise ConnectorError("library-normalization-failed") from error
        except Exception as error:
            raise ConnectorError("library-sync-failed") from error

    def disconnect(self) -> dict[str, Any]:
        envelope = self.store.read()
        auth = _authenticator(envelope)
        try:
            auth.deregister_device()
        except Exception as error:
            raise ConnectorError("deregistration-unconfirmed") from error
        self.store.delete()
        return self._public_status(None)

    def unseal(self, encoded: str) -> dict[str, Any]:
        return unseal_snapshot(encoded, self.protector)

    def _cleanup_failed_registration(self, auth: Any) -> None:
        try:
            auth.deregister_device()
        except Exception as error:
            raise ConnectorError("registration-cleanup-unconfirmed") from error

    def _identity_key(self) -> bytes:
        if self.identity_store.exists():
            value = self.identity_store.read()
            encoded = value.get("key")
            if not isinstance(encoded, str) or not re.fullmatch(r"[a-f0-9]{64}", encoded):
                raise ConnectorError("identity-key-invalid")
            return bytes.fromhex(encoded)
        key = secrets.token_bytes(32)
        self.identity_store.write({"schemaVersion": 1, "key": key.hex()})
        return key

    def _public_status(self, envelope: dict[str, Any] | None) -> dict[str, Any]:
        base = {
            "available": True,
            "connected": envelope is not None,
            "appAbbreviation": self.policy.app_abbreviation,
            "distribution": self.policy.distribution,
            "commercialShippingBlocked": True,
            "providerDeviceDisplayName": self.policy.provider_device_display_name,
            "automaticSyncIntervalMinutes": self.policy.automatic_sync_interval_minutes,
        }
        if envelope is None:
            return base
        return {
            **base,
            "marketplace": envelope["marketplace"],
            "accountAlias": envelope["accountAlias"],
            "accountKey": envelope["accountKey"],
            "registeredAt": envelope["registeredAt"],
            "lastSuccessfulSyncAt": envelope.get("lastSuccessfulSyncAt"),
        }


def configure_process_safety() -> None:
    logging.disable(logging.CRITICAL)
    warnings.filterwarnings("ignore")
    for name in ("HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY", "http_proxy", "https_proxy", "all_proxy"):
        os.environ.pop(name, None)
