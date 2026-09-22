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

from . import SOURCE_NAME
from .custody import (
    CustodyError,
    SecureJsonStore,
    WindowsDpapiProtector,
    seal_local_record,
    seal_snapshot,
    unseal_local_record,
    unseal_snapshot,
    verify_custody_boundary,
)
from .contract import (
    BYTE_ACCOUNTING,
    BYTE_ACCOUNTING_IS_WIRE_PROOF,
    CONTRACT_REVISION,
    MAX_ITEMS,
    MAX_PAGES,
    MAX_RESPONSE_BYTES,
    PAGE_SIZE,
)
from .normalize import NormalizeError, normalize_library
from .policy import PrivateAlphaPolicy, load_policy
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
    def __init__(self, code: str, detail: dict[str, Any] | None = None) -> None:
        super().__init__(code)
        self.code = code
        #: Bounded, category-only diagnostic. Never contains a source value.
        self.detail = detail


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

#: Closed vocabulary for the reported provider connection state.
#:
#: ``disconnected``        no authorization envelope is held at all.
#: ``unverified``          an envelope is held, but no provider interaction
#:                         within the freshness horizon has proven it still
#:                         works. Credential presence is never proof.
#: ``verified``            a real provider interaction succeeded recently.
#: ``authorization-failed`` the provider refused the held authorization.
CONNECTION_STATES = ("disconnected", "unverified", "verified", "authorization-failed")

#: How long a successful provider interaction keeps backing a ``verified``
#: report. Chosen well above the 15-minute automatic sync interval, so a
#: working installation stays verified without any extra provider call, and a
#: revoked or abandoned one decays to ``unverified`` rather than lying.
VERIFICATION_FRESHNESS_SECONDS = 24 * 60 * 60

#: Closed vocabulary for the *basis* of the last verification. Both values
#: come from interactions the user already asked for; neither is a probe.
VERIFICATION_BASES = ("device-registration", "library-sync")

#: Exception class names that mean "the provider refused this authorization".
#: Matched by class name only - no exception message, URL, header or body is
#: read, so no provider content can leak into local state.
_AUTHORIZATION_ERROR_NAMES = frozenset({"Unauthorized", "Forbidden", "NotAuthenticated"})
_AUTHORIZATION_STATUS_CODES = frozenset({401, 403})


def _is_authorization_failure(error: BaseException) -> bool:
    """Classify a provider failure as an authorization refusal, or not.

    Deliberately narrow: only an explicit 401/403 status or a named
    authorization exception counts. A network blip, a timeout or a parse
    failure must never be reported as "your authorization was revoked" -
    that would send the owner to re-authorize for no reason.
    """

    for candidate in (error, getattr(error, "__cause__", None), getattr(error, "__context__", None)):
        if candidate is None:
            continue
        if type(candidate).__name__ in _AUTHORIZATION_ERROR_NAMES:
            return True
        status = getattr(candidate, "status_code", None)
        if not isinstance(status, int):
            response = getattr(candidate, "response", None)
            status = getattr(response, "status_code", None)
        if isinstance(status, int) and status in _AUTHORIZATION_STATUS_CODES:
            return True
    return False


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


def collect_library_pages(fetch_page: Any) -> dict[str, Any]:
    """Accumulate bounded library pages into a provably complete capture.

    `fetch_page(page)` returns the decoded page response. The accumulator is
    deliberately conservative:

    * a duplicate source identifier - within a page or across pages - is a
      classified stop, not a silent de-duplication. Dedupe alone proves
      nothing about completeness;
    * an over-size page, an over-size cumulative response or an over-size item
      total stops;
    * reaching the page cap without terminal evidence stops. There is no
      page 21 probe and no automatic retry;
    * completeness is only ever claimed from a declared basis.

    Byte accounting re-serializes the decoded page. That is an *estimate* and
    is reported as such: it is not wire-byte proof (see the source contract's
    ``byteAccountingIsWireProof: false``).
    """

    items: list[Any] = []
    seen: set[str] = set()
    response_bytes = 0
    pages_read = 0
    completeness_basis: str | None = None

    for page in range(1, MAX_PAGES + 1):
        response = fetch_page(page)
        if not isinstance(response, dict):
            raise ConnectorError("library-response-invalid")
        page_items = response.get("items")
        if not isinstance(page_items, list):
            raise ConnectorError("library-response-invalid")
        if len(page_items) > PAGE_SIZE:
            raise ConnectorError("library-page-oversized")
        pages_read = page
        response_bytes += len(
            json.dumps(response, ensure_ascii=True, separators=(",", ":")).encode("utf-8")
        )
        if response_bytes > MAX_RESPONSE_BYTES:
            raise ConnectorError("library-response-too-large")

        for raw in page_items:
            if not isinstance(raw, dict):
                raise ConnectorError("library-response-invalid")
            asin = raw.get("asin")
            if not isinstance(asin, str) or not asin.strip():
                raise ConnectorError("library-response-invalid")
            key = asin.strip()
            if key in seen:
                # Overlapping or mutating pages: the prior complete snapshot is
                # retained rather than guessing which copy is authoritative.
                raise ConnectorError("library-pagination-duplicate")
            seen.add(key)

        items.extend(page_items)
        if len(items) > MAX_ITEMS:
            raise ConnectorError("library-item-limit")

        if len(page_items) < PAGE_SIZE:
            completeness_basis = "empty-first-page" if page == 1 and not page_items else "short-final-page"
            break

    if completeness_basis is None:
        raise ConnectorError("library-page-limit")

    return {
        "items": items,
        "evidence": {
            "complete": True,
            "basis": completeness_basis,
            "pagesRead": pages_read,
            "itemCount": len(items),
            "estimatedResponseBytes": response_bytes,
            "byteAccounting": BYTE_ACCOUNTING,
            "byteAccountingIsWireProof": BYTE_ACCOUNTING_IS_WIRE_PROOF,
            "maxPages": MAX_PAGES,
            "pageSize": PAGE_SIZE,
            "contractRevision": CONTRACT_REVISION,
        },
    }


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
        #: In-process record of a provider refusal, used only when the durable
        #: envelope write fails. Without it, an unwritable store would let a
        #: refused session keep reporting ``verified`` for the life of the
        #: process - the one direction it is unsafe to be wrong in.
        self._authorization_refused_at: str | None = None

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
                # Registration is itself a completed provider interaction: the
                # provider issued this authorization and returned the customer
                # record used for `accountKey`. It is recorded as verification
                # evidence rather than re-proven with an extra call.
                "lastVerifiedAt": _now(),
                "lastVerificationBasis": "device-registration",
                "lastAuthorizationFailureAt": None,
                "auth": auth.to_dict(),
            }
            self.store.write(envelope)
            # A freshly registered authorization carries no prior refusal.
            self._authorization_refused_at = None
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

            with audible.Client(auth=auth) as client:
                def fetch_page(page: int) -> Any:
                    return client.get(
                        "library",
                        num_results=PAGE_SIZE,
                        page=page,
                        response_groups=RESPONSE_GROUPS,
                    )

                capture = collect_library_pages(fetch_page)

            items = capture["items"]
            observed_at = _now()
            snapshot = normalize_library(
                items,
                marketplace=str(envelope["marketplace"]),
                observed_at=observed_at,
            )
            envelope["auth"] = auth.to_dict()
            envelope["lastSuccessfulSyncAt"] = observed_at
            # A completed library read is the strongest evidence this process
            # can hold that the stored authorization still works.
            envelope["lastVerifiedAt"] = observed_at
            envelope["lastVerificationBasis"] = "library-sync"
            envelope["lastAuthorizationFailureAt"] = None
            self.store.write(envelope)
            # A completed read supersedes any earlier refusal this process saw.
            self._authorization_refused_at = None
            return {
                "status": self._public_status(envelope),
                "itemCount": len(items),
                "completeness": capture["evidence"],
                "snapshot": snapshot,
                "sealedSnapshot": seal_snapshot(snapshot, self.protector),
            }
        except ConnectorError:
            raise
        except NormalizeError as error:
            # A local normalization stop says nothing about the provider
            # authorization, so verification evidence is left untouched.
            raise ConnectorError(
                "library-normalization-failed", error.diagnostic()
            ) from error
        except Exception as error:
            if _is_authorization_failure(error):
                self._record_authorization_failure()
            raise ConnectorError("library-sync-failed") from error

    def _record_authorization_failure(self) -> None:
        """Persist "the provider refused this authorization" as local evidence.

        The in-process marker is set **first** and unconditionally, so the
        refusal is reported by this process even if the durable write fails.
        The durable write is best-effort and silent on failure: a status that
        cannot be updated must not convert a sync failure into a custody
        error. Nothing from the provider response is stored - only the fact
        and the local timestamp.
        """

        self._authorization_refused_at = _now()
        try:
            envelope = self.store.read()
            envelope["lastAuthorizationFailureAt"] = self._authorization_refused_at
            self.store.write(envelope)
        except (CustodyError, ConnectorError, OSError, KeyError, TypeError, ValueError):
            return

    def disconnect(self) -> dict[str, Any]:
        envelope = self.store.read()
        auth = _authenticator(envelope)
        try:
            auth.deregister_device()
        except Exception as error:
            raise ConnectorError("deregistration-unconfirmed") from error
        self.store.delete()
        self._authorization_refused_at = None
        return self._public_status(None)

    def unseal(self, encoded: str) -> dict[str, Any]:
        return unseal_snapshot(encoded, self.protector)

    def seal(self, snapshot: Any) -> dict[str, Any]:
        """Seal a **reconciled** snapshot produced by the local service.

        This is a local custody operation only: it performs no provider access
        and accepts no arbitrary payload. The value must already be a closed
        snapshot envelope for the bound marketplace, so this dispatch path can
        never be used to seal or exfiltrate unrelated data.
        """

        if not isinstance(snapshot, dict):
            raise ConnectorError("seal-payload-invalid")
        required = {"schemaVersion", "source", "marketplace", "observedAt", "catalog", "entries"}
        if not required.issubset(snapshot):
            raise ConnectorError("seal-payload-invalid")
        if snapshot.get("source") != SOURCE_NAME:
            raise ConnectorError("seal-payload-invalid")
        if snapshot.get("marketplace") not in self.policy.allowed_marketplaces:
            raise ConnectorError("marketplace-not-allowed")
        if not isinstance(snapshot.get("entries"), list) or not isinstance(
            snapshot.get("catalog"), dict
        ):
            raise ConnectorError("seal-payload-invalid")
        return {"sealedSnapshot": seal_snapshot(snapshot, self.protector)}

    #: Purpose tag required on every locally owned sealed record.
    LOCAL_RECORD_PURPOSE = "private-review"

    def seal_local(self, payload: Any) -> dict[str, Any]:
        """Seal a locally owned record (a private review) at rest.

        This route performs no provider access and reads no provider state. It
        accepts only a purpose-tagged local record, so it cannot be used as a
        generic encryption oracle for unrelated data.
        """

        if not isinstance(payload, dict):
            raise ConnectorError("local-payload-invalid")
        if payload.get("purpose") != self.LOCAL_RECORD_PURPOSE:
            raise ConnectorError("local-payload-invalid")
        if len(json.dumps(payload, ensure_ascii=True)) > 256 * 1024:
            raise ConnectorError("local-payload-too-large")
        return {"sealedPayload": seal_local_record(payload, self.protector)}

    def unseal_local(self, encoded: str) -> dict[str, Any]:
        """Open a locally owned sealed record, refusing any other purpose.

        The envelope header is purpose-bound, so a sealed library snapshot is
        refused before decryption rather than being opened and then inspected.
        """

        payload = unseal_local_record(encoded, self.protector)
        if not isinstance(payload, dict) or payload.get("purpose") != self.LOCAL_RECORD_PURPOSE:
            raise ConnectorError("local-payload-invalid")
        return payload

    def verify_custody(self) -> dict[str, Any]:
        """Prove the OS custody boundary (ACL re-read) before any state write.

        This route performs no provider access, reads no credential and opens
        no library state. It exists so the runtime can establish the custody
        proof *before* a rollback envelope or migration writes personal bytes.
        """

        return verify_custody_boundary()

    def local_artifact_inventory(self) -> dict[str, Any]:
        """Report whether connector-owned artifacts still exist.

        A local deletion in the application cannot remove these, and the
        application cannot see them either. This route answers the only honest
        question it can - existence - with booleans and a closed protector
        name. No path, no account identifier, no credential material and no
        file content ever leaves this method.
        """

        return {
            "credentialsRetained": bool(self.store.exists()),
            "identitySeedRetained": bool(self.identity_store.exists()),
            "protector": "windows-dpapi",
            "removedBy": "confirmed-disconnect-only",
        }

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

    def _connection_state(self, envelope: dict[str, Any] | None) -> dict[str, Any]:
        """Derive the reported connection state from recorded evidence only.

        This method performs **no provider access**. It reads nothing but the
        outcomes of interactions the owner already initiated - registration,
        synchronization - so asking for status can never create traffic, and
        holding a credential can never, on its own, produce ``verified``.
        """

        if envelope is None:
            return {
                "connectionState": "disconnected",
                "credentialsPresent": False,
                "lastVerifiedAt": None,
                "lastVerificationBasis": None,
                "lastAuthorizationFailureAt": None,
                "verificationFreshnessSeconds": VERIFICATION_FRESHNESS_SECONDS,
            }

        verified_at = envelope.get("lastVerifiedAt")
        basis = envelope.get("lastVerificationBasis")
        failed_at = envelope.get("lastAuthorizationFailureAt")
        if not isinstance(verified_at, str):
            verified_at = None
        if basis not in VERIFICATION_BASES:
            basis = None
        if not isinstance(failed_at, str):
            failed_at = None
        # A refusal this process observed but could not persist is still
        # evidence. The most recent of the two wins.
        if self._authorization_refused_at is not None and (
            failed_at is None or self._authorization_refused_at > failed_at
        ):
            failed_at = self._authorization_refused_at

        state = "unverified"
        if failed_at is not None and (verified_at is None or failed_at >= verified_at):
            # A refusal that is at least as recent as the last success wins:
            # the safe direction to be wrong in is "re-authorize", not
            # "everything is fine".
            state = "authorization-failed"
        elif verified_at is not None and self._within_freshness(verified_at):
            state = "verified"

        return {
            "connectionState": state,
            "credentialsPresent": True,
            "lastVerifiedAt": verified_at,
            "lastVerificationBasis": basis,
            "lastAuthorizationFailureAt": failed_at,
            "verificationFreshnessSeconds": VERIFICATION_FRESHNESS_SECONDS,
        }

    @staticmethod
    def _within_freshness(verified_at: str) -> bool:
        try:
            parsed = datetime.fromisoformat(verified_at.replace("Z", "+00:00"))
        except ValueError:
            return False
        if parsed.tzinfo is None:
            return False
        age = (datetime.now(UTC) - parsed.astimezone(UTC)).total_seconds()
        # A future-dated stamp is treated as unusable rather than as a very
        # fresh one: a clock change must not manufacture verification.
        return 0 <= age <= VERIFICATION_FRESHNESS_SECONDS

    def _public_status(self, envelope: dict[str, Any] | None) -> dict[str, Any]:
        base = {
            "available": True,
            # `connected` answers "is an authorization envelope held?" and is
            # what the lifecycle controls key off. It is deliberately *not*
            # the connection health report - `connectionState` is. Credential
            # presence is custody, not proof (issue #8).
            "connected": envelope is not None,
            "appAbbreviation": self.policy.app_abbreviation,
            "distribution": self.policy.distribution,
            "commercialShippingBlocked": True,
            "providerDeviceDisplayName": self.policy.provider_device_display_name,
            "automaticSyncIntervalMinutes": self.policy.automatic_sync_interval_minutes,
            **self._connection_state(envelope),
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
