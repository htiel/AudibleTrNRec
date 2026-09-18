import copy
import json
import sys
import types
import unittest
from unittest.mock import patch

from atnr_connector.policy import PrivateAlphaPolicy
from atnr_connector.service import ConnectorService


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


if __name__ == "__main__":
    unittest.main()
