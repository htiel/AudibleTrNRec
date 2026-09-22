import copy
import json
import sys
import types
import unittest
from unittest.mock import patch

from atnr_connector.policy import PrivateAlphaPolicy
from atnr_connector.service import CONNECTION_STATES, ConnectorService


class ReversibleProtector:
    def protect(self, plaintext: bytes) -> bytes:
        return b"sealed:" + plaintext[::-1]

    def unprotect(self, ciphertext: bytes) -> bytes:
        return ciphertext[len(b"sealed:") :][::-1]


class MemoryStore:
    def __init__(self) -> None:
        self.value = None

    def exists(self) -> bool:
        return self.value is not None

    def read(self):
        if self.value is None:
            raise RuntimeError("missing")
        return copy.deepcopy(self.value)

    def write(self, value) -> None:
        self.value = copy.deepcopy(value)

    def delete(self) -> None:
        self.value = None


class FakeAuth:
    deregistrations = 0

    def __init__(self) -> None:
        self.customer_info = {"user_id": "synthetic-customer"}
        self.data = {
            "locale_code": "us",
            "customer_info": self.customer_info,
            "device_info": {"name": "synthetic-device"},
        }

    def to_dict(self):
        return copy.deepcopy(self.data)

    def deregister_device(self):
        type(self).deregistrations += 1
        return {"ok": True}


class FakeAuthenticator:
    @classmethod
    def from_login_external(cls, **_kwargs):
        return FakeAuth()

    @classmethod
    def from_dict(cls, data):
        auth = FakeAuth()
        auth.data = copy.deepcopy(data)
        auth.customer_info = copy.deepcopy(data["customer_info"])
        return auth


class FakeClient:
    def __init__(self, *, auth):
        self.auth = auth

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return None

    def get(self, path, **params):
        if path != "library" or params["num_results"] != 1000:
            raise AssertionError("unexpected request")
        if params["page"] > 1:
            raise AssertionError("no page is requested after terminal evidence")
        return {
            "items": [
                {
                    "asin": "SYNTHETIC-ASIN",
                    "title": "Synthetic Book",
                    "authors": [],
                    "narrators": [],
                    "percent_complete": 0.5,
                }
            ]
        }


class ServiceTests(unittest.TestCase):
    def setUp(self) -> None:
        FakeAuth.deregistrations = 0
        self.store = MemoryStore()
        self.service = ConnectorService(
            policy=PrivateAlphaPolicy(
                app_name="Audible Track and Recommend",
                app_abbreviation="ATnR",
                distribution="private-alpha",
                maximum_named_testers=10,
                allowed_marketplaces=("us",),
                provider_device_display_name="Audible for iPhone",
                automatic_sync_interval_minutes=15,
            ),
            store=self.store,
            identity_store=MemoryStore(),
            protector=ReversibleProtector(),
        )
        self.audible = types.SimpleNamespace(
            Authenticator=FakeAuthenticator,
            Client=FakeClient,
        )

    def test_artifact_inventory_reports_existence_without_exposing_anything(self) -> None:
        empty = self.service.local_artifact_inventory()
        self.assertEqual(empty["credentialsRetained"], False)
        self.assertEqual(empty["identitySeedRetained"], False)
        self.assertEqual(empty["removedBy"], "confirmed-disconnect-only")

        with patch.dict(sys.modules, {"audible": self.audible}):
            self.service.connect(marketplace="us", account_alias="Synthetic account")
        held = self.service.local_artifact_inventory()
        self.assertEqual(held["credentialsRetained"], True)
        self.assertEqual(held["identitySeedRetained"], True)
        self.assertEqual(held["protector"], "windows-dpapi")

        # Booleans and closed labels only: no path, account identifier or
        # credential material may leave this route.
        self.assertEqual(
            set(held),
            {"credentialsRetained", "identitySeedRetained", "protector", "removedBy"},
        )
        serialized = json.dumps(held)
        for forbidden in ("key", "token", "cookie", "customer", "\\", "/"):
            self.assertNotIn(forbidden, serialized)

        # A local deletion in the application cannot change this answer; only a
        # confirmed disconnect does.
        with patch.dict(sys.modules, {"audible": self.audible}):
            self.service.disconnect()
        self.assertEqual(
            self.service.local_artifact_inventory()["credentialsRetained"], False
        )

    def test_connection_persists_until_explicit_disconnect(self) -> None:
        with patch.dict(sys.modules, {"audible": self.audible}):
            status = self.service.connect(
                marketplace="us", account_alias="Synthetic account"
            )
            self.assertTrue(status["connected"])
            self.assertEqual(FakeAuth.deregistrations, 0)
            self.assertTrue(self.service.status()["connected"])
            self.service.disconnect()
            self.assertEqual(FakeAuth.deregistrations, 1)
            self.assertFalse(self.service.status()["connected"])

    def test_sync_returns_validated_shape_and_sealed_copy(self) -> None:
        with patch.dict(sys.modules, {"audible": self.audible}):
            self.service.connect(
                marketplace="us", account_alias="Synthetic account"
            )
            result = self.service.sync_library()
            self.assertEqual(result["itemCount"], 1)
            # The declared scale is a percentage: 0.5 stays 0.5. It is not
            # rescaled to 50 because it "looks fractional".
            self.assertEqual(result["snapshot"]["entries"][0]["percentComplete"], 0.5)
            unsealed = self.service.unseal(result["sealedSnapshot"])
            self.assertEqual(unsealed, result["snapshot"])
            self.assertEqual(FakeAuth.deregistrations, 0)

    def test_sync_reports_declared_completeness_evidence(self) -> None:
        with patch.dict(sys.modules, {"audible": self.audible}):
            self.service.connect(marketplace="us", account_alias="Synthetic account")
            evidence = self.service.sync_library()["completeness"]
            self.assertEqual(evidence["complete"], True)
            self.assertEqual(evidence["basis"], "short-final-page")
            self.assertEqual(evidence["pagesRead"], 1)
            self.assertEqual(evidence["itemCount"], 1)
            self.assertFalse(evidence["byteAccountingIsWireProof"])
            self.assertTrue(evidence["contractRevision"].startswith("atr-source-contract-"))

    def test_a_reconciled_snapshot_can_be_sealed_without_provider_access(self) -> None:
        with patch.dict(sys.modules, {"audible": self.audible}):
            self.service.connect(marketplace="us", account_alias="Synthetic account")
            snapshot = self.service.sync_library()["snapshot"]

        reconciled = copy.deepcopy(snapshot)
        reconciled["entries"][0]["missingFromSource"] = True
        # No `audible` module is patched in: sealing must not touch the provider.
        sealed = self.service.seal(reconciled)["sealedSnapshot"]
        self.assertEqual(self.service.unseal(sealed), reconciled)

    def test_seal_refuses_anything_that_is_not_a_bound_snapshot(self) -> None:
        for payload in (None, [], "text", {}, {"schemaVersion": 1}):
            with self.subTest(payload=repr(payload)):
                with self.assertRaisesRegex(RuntimeError, "seal-payload-invalid"):
                    self.service.seal(payload)

        foreign = {
            "schemaVersion": 1,
            "source": "some-other-source",
            "marketplace": "us",
            "observedAt": "2026-09-17T12:00:00.000Z",
            "catalog": {"people": [], "facets": [], "books": []},
            "entries": [],
        }
        with self.assertRaisesRegex(RuntimeError, "seal-payload-invalid"):
            self.service.seal(foreign)

        other_market = dict(foreign, source="audible-community-private-api", marketplace="uk")
        with self.assertRaisesRegex(RuntimeError, "marketplace-not-allowed"):
            self.service.seal(other_market)

    def test_local_record_custody_is_purpose_bound_and_round_trips(self) -> None:
        record = {"purpose": "private-review", "accountKey": "a" * 64, "record": {"overallRating": 4.5}}
        sealed = self.service.seal_local(record)["sealedPayload"]
        self.assertEqual(self.service.unseal_local(sealed), record)

    def test_local_custody_refuses_any_other_purpose_or_oversize_payload(self) -> None:
        for payload in (None, [], "text", {}, {"purpose": "snapshot"}):
            with self.subTest(payload=repr(payload)):
                with self.assertRaisesRegex(RuntimeError, "local-payload-invalid"):
                    self.service.seal_local(payload)

        oversize = {"purpose": "private-review", "record": {"comment": "x" * (256 * 1024)}}
        with self.assertRaisesRegex(RuntimeError, "local-payload-too-large"):
            self.service.seal_local(oversize)

        snapshot_sealed = self.service.seal_local({"purpose": "private-review"})["sealedPayload"]
        self.assertEqual(self.service.unseal_local(snapshot_sealed), {"purpose": "private-review"})
        other = self.service.seal({
            "schemaVersion": 1,
            "source": "audible-community-private-api",
            "marketplace": "us",
            "observedAt": "2026-09-17T12:00:00.000Z",
            "catalog": {"people": [], "facets": [], "books": []},
            "entries": [],
        })["sealedSnapshot"]
        with self.assertRaisesRegex(RuntimeError, "envelope-purpose-mismatch"):
            # Refused by the purpose-bound header, before any decryption: the
            # snapshot route can no longer act as an oracle for private
            # reviews, and vice versa.
            self.service.unseal_local(other)


class Unauthorized(Exception):
    """Stands in for the provider's authorization refusal (401)."""

    status_code = 401


class RefusingClient(FakeClient):
    def get(self, path, **params):
        raise Unauthorized("refused")


class TransientlyFailingClient(FakeClient):
    def get(self, path, **params):
        raise TimeoutError("network")


class ConnectionStateTests(unittest.TestCase):
    """Connection state comes from verified interactions, never from custody."""

    def setUp(self) -> None:
        FakeAuth.deregistrations = 0
        self.store = MemoryStore()
        self.service = ConnectorService(
            policy=PrivateAlphaPolicy(
                app_name="Audible Track and Recommend",
                app_abbreviation="ATnR",
                distribution="private-alpha",
                maximum_named_testers=10,
                allowed_marketplaces=("us",),
                provider_device_display_name="Audible for iPhone",
                automatic_sync_interval_minutes=15,
            ),
            store=self.store,
            identity_store=MemoryStore(),
            protector=ReversibleProtector(),
        )
        self.audible = types.SimpleNamespace(Authenticator=FakeAuthenticator, Client=FakeClient)

    def connect(self) -> None:
        with patch.dict(sys.modules, {"audible": self.audible}):
            self.service.connect(marketplace="us", account_alias="Synthetic account")

    def test_no_envelope_reports_disconnected(self) -> None:
        status = self.service.status()
        self.assertEqual(status["connectionState"], "disconnected")
        self.assertEqual(status["credentialsPresent"], False)
        self.assertIsNone(status["lastVerifiedAt"])

    def test_registration_is_a_verified_provider_interaction(self) -> None:
        self.connect()
        status = self.service.status()
        self.assertEqual(status["connectionState"], "verified")
        self.assertEqual(status["lastVerificationBasis"], "device-registration")
        self.assertIsInstance(status["lastVerifiedAt"], str)

    def test_a_successful_sync_reverifies_the_connection(self) -> None:
        self.connect()
        with patch.dict(sys.modules, {"audible": self.audible}):
            result = self.service.sync_library()
        self.assertEqual(result["status"]["connectionState"], "verified")
        self.assertEqual(result["status"]["lastVerificationBasis"], "library-sync")
        self.assertEqual(
            result["status"]["lastVerifiedAt"], result["status"]["lastSuccessfulSyncAt"]
        )

    def test_stale_credential_presence_alone_never_reports_verified(self) -> None:
        self.connect()
        envelope = self.store.read()
        envelope["lastVerifiedAt"] = "2020-01-01T00:00:00.000Z"
        self.store.write(envelope)
        status = self.service.status()
        self.assertEqual(status["connected"], True, "the envelope is still held")
        self.assertEqual(status["connectionState"], "unverified")
        self.assertEqual(status["lastVerifiedAt"], "2020-01-01T00:00:00.000Z")

    def test_an_envelope_without_any_verification_evidence_is_unverified(self) -> None:
        self.connect()
        envelope = self.store.read()
        for key in ("lastVerifiedAt", "lastVerificationBasis", "lastAuthorizationFailureAt"):
            envelope.pop(key, None)
        self.store.write(envelope)
        status = self.service.status()
        self.assertEqual(status["connectionState"], "unverified")
        self.assertIsNone(status["lastVerifiedAt"])

    def test_a_future_dated_verification_is_not_accepted_as_fresh(self) -> None:
        self.connect()
        envelope = self.store.read()
        envelope["lastVerifiedAt"] = "2099-01-01T00:00:00.000Z"
        self.store.write(envelope)
        self.assertEqual(self.service.status()["connectionState"], "unverified")

    def test_a_provider_refusal_moves_the_connection_to_authorization_failed(self) -> None:
        self.connect()
        refusing = types.SimpleNamespace(Authenticator=FakeAuthenticator, Client=RefusingClient)
        with patch.dict(sys.modules, {"audible": refusing}):
            with self.assertRaisesRegex(RuntimeError, "library-sync-failed"):
                self.service.sync_library()
        status = self.service.status()
        self.assertEqual(status["connectionState"], "authorization-failed")
        self.assertIsInstance(status["lastAuthorizationFailureAt"], str)
        self.assertEqual(status["connected"], True, "custody is unchanged by a refusal")

    def test_a_transient_failure_is_not_reported_as_an_authorization_problem(self) -> None:
        self.connect()
        flaky = types.SimpleNamespace(Authenticator=FakeAuthenticator, Client=TransientlyFailingClient)
        with patch.dict(sys.modules, {"audible": flaky}):
            with self.assertRaisesRegex(RuntimeError, "library-sync-failed"):
                self.service.sync_library()
        status = self.service.status()
        self.assertEqual(status["connectionState"], "verified")
        self.assertIsNone(status["lastAuthorizationFailureAt"])

    def test_a_later_success_clears_an_earlier_authorization_failure(self) -> None:
        self.connect()
        refusing = types.SimpleNamespace(Authenticator=FakeAuthenticator, Client=RefusingClient)
        with patch.dict(sys.modules, {"audible": refusing}):
            with self.assertRaises(RuntimeError):
                self.service.sync_library()
        self.assertEqual(self.service.status()["connectionState"], "authorization-failed")
        with patch.dict(sys.modules, {"audible": self.audible}):
            self.service.sync_library()
        status = self.service.status()
        self.assertEqual(status["connectionState"], "verified")
        self.assertIsNone(status["lastAuthorizationFailureAt"])

    def test_a_refusal_is_reported_even_when_the_evidence_cannot_be_persisted(self) -> None:
        """An unwritable store must not leave a refused session reading verified."""

        self.connect()
        self.assertEqual(self.service.status()["connectionState"], "verified")

        original_write = self.store.write

        def refuse_write(_payload: dict[str, object]) -> None:
            raise OSError("evidence store unavailable")

        self.store.write = refuse_write  # type: ignore[method-assign]
        refusing = types.SimpleNamespace(Authenticator=FakeAuthenticator, Client=RefusingClient)
        try:
            with patch.dict(sys.modules, {"audible": refusing}):
                with self.assertRaisesRegex(RuntimeError, "library-sync-failed"):
                    self.service.sync_library()
            status = self.service.status()
            # The durable record could not be written, but the refusal was
            # still observed, so it is still reported.
            self.assertEqual(status["connectionState"], "authorization-failed")
            self.assertIsInstance(status["lastAuthorizationFailureAt"], str)
        finally:
            self.store.write = original_write  # type: ignore[method-assign]

    def test_a_later_success_clears_an_unpersisted_refusal_too(self) -> None:
        self.connect()
        original_write = self.store.write
        self.store.write = lambda _payload: (_ for _ in ()).throw(OSError("unavailable"))  # type: ignore[method-assign]
        refusing = types.SimpleNamespace(Authenticator=FakeAuthenticator, Client=RefusingClient)
        with patch.dict(sys.modules, {"audible": refusing}):
            with self.assertRaises(RuntimeError):
                self.service.sync_library()
        self.store.write = original_write  # type: ignore[method-assign]
        self.assertEqual(self.service.status()["connectionState"], "authorization-failed")

        with patch.dict(sys.modules, {"audible": self.audible}):
            self.service.sync_library()
        self.assertEqual(self.service.status()["connectionState"], "verified")

    def test_disconnect_returns_to_disconnected_with_no_residual_evidence(self) -> None:
        self.connect()
        with patch.dict(sys.modules, {"audible": self.audible}):
            status = self.service.disconnect()
        self.assertEqual(status["connectionState"], "disconnected")
        self.assertEqual(status["credentialsPresent"], False)
        self.assertIsNone(status["lastVerifiedAt"])

    def test_status_never_contacts_the_provider(self) -> None:
        self.connect()
        # No `audible` module is patched in for these reads: a status report
        # that needed the provider would fail here instead of answering.
        for _ in range(3):
            self.assertIn(self.service.status()["connectionState"], CONNECTION_STATES)

    def test_every_reported_state_is_in_the_closed_vocabulary(self) -> None:
        self.assertEqual(
            CONNECTION_STATES,
            ("disconnected", "unverified", "verified", "authorization-failed"),
        )


if __name__ == "__main__":
    unittest.main()
