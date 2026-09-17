import copy
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
            self.assertEqual(result["snapshot"]["entries"][0]["percentComplete"], 50)
            unsealed = self.service.unseal(result["sealedSnapshot"])
            self.assertEqual(unsealed, result["snapshot"])
            self.assertEqual(FakeAuth.deregistrations, 0)


if __name__ == "__main__":
    unittest.main()
