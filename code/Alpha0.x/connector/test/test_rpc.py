"""RPC dispatch and diagnostic-boundary tests.

The dispatch table is closed and the error detail that may cross the process
boundary is bounded to a position and a closed category.
"""

import unittest

from atnr_connector.normalize import NormalizeError
from atnr_connector.rpc import DIAGNOSTIC_CATEGORIES, _dispatch, _safe_detail
from atnr_connector.service import ConnectorError


class FakeService:
    def __init__(self) -> None:
        self.calls = []

    def status(self):
        self.calls.append("status")
        return {"connected": False}

    def verify_custody(self):
        self.calls.append("verify_custody")
        return {
            "custodyVerified": True,
            "aclVerified": True,
            "rootHardened": True,
            "protector": "windows-dpapi",
        }

    def connect(self, *, marketplace, account_alias):
        self.calls.append(("connect", marketplace, account_alias))
        return {"connected": True}

    def sync_library(self):
        self.calls.append("sync_library")
        return {"itemCount": 0}

    def disconnect(self):
        self.calls.append("disconnect")
        return {"connected": False}

    def unseal(self, encoded):
        self.calls.append(("unseal", encoded))
        return {"schemaVersion": 1}

    def seal(self, snapshot):
        self.calls.append(("seal", snapshot))
        return {"sealedSnapshot": "AAAA"}

    def seal_local(self, payload):
        self.calls.append(("seal_local", payload))
        return {"sealedPayload": "AAAA"}

    def unseal_local(self, sealed):
        self.calls.append(("unseal_local", sealed))
        return {"purpose": "private-review"}

    def local_artifact_inventory(self):
        self.calls.append("local_artifact_inventory")
        return {
            "credentialsRetained": True,
            "identitySeedRetained": True,
            "protector": "windows-dpapi",
            "removedBy": "confirmed-disconnect-only",
        }


class DispatchTests(unittest.TestCase):
    def setUp(self) -> None:
        self.service = FakeService()

    def test_every_allowed_method_reaches_its_service_route(self) -> None:
        cases = [
            ({"method": "status", "params": {}}, "status"),
            ({"method": "verify_custody", "params": {}}, "verify_custody"),
            ({"method": "local_artifact_inventory", "params": {}}, "local_artifact_inventory"),
            ({"method": "sync_library", "params": {}}, "sync_library"),
            ({"method": "disconnect", "params": {}}, "disconnect"),
            ({"method": "connect", "params": {"marketplace": "us", "accountAlias": "A"}}, None),
            ({"method": "unseal_snapshot", "params": {"sealedSnapshot": "AAAA"}}, None),
            ({"method": "seal_snapshot", "params": {"snapshot": {}}}, None),
            ({"method": "seal_local", "params": {"payload": {}}}, None),
            ({"method": "unseal_local", "params": {"sealedPayload": "AAAA"}}, None),
        ]
        for request, _ in cases:
            with self.subTest(method=request["method"]):
                self.assertIsInstance(_dispatch(self.service, request), dict)
        self.assertEqual(len(self.service.calls), len(cases))

    def test_an_unknown_method_or_parameter_shape_is_refused(self) -> None:
        refused = [
            {"method": "seal_local", "params": {}},
            {"method": "seal_local", "params": {"payload": {}, "extra": 1}},
            {"method": "seal_snapshot", "params": {"payload": {}}},
            {"method": "status", "params": {"force": True}},
            {"method": "register_device", "params": {}},
            {"method": "verify_custody", "params": {"root": "C:\\anywhere"}},
            {"method": "local_artifact_inventory", "params": {"path": "C:\\anywhere"}},
            {"method": "unseal_local", "params": {"sealedSnapshot": "AAAA"}},
        ]
        for request in refused:
            with self.subTest(request=request):
                with self.assertRaisesRegex(ConnectorError, "rpc-method-not-allowed"):
                    _dispatch(self.service, request)
        self.assertEqual(self.service.calls, [], "a refused request never reaches the service")


class DiagnosticBoundaryTests(unittest.TestCase):
    def test_a_normalize_diagnostic_is_reduced_to_position_and_category(self) -> None:
        error = ConnectorError(
            "library-normalization-failed",
            NormalizeError(
                "required-text-missing", category="missing-required-field", record_index=7
            ).diagnostic(),
        )
        detail = _safe_detail(error)
        self.assertEqual(detail, {"category": "missing-required-field", "recordIndex": 7})

    def test_an_unknown_category_is_collapsed_and_content_is_dropped(self) -> None:
        error = ConnectorError(
            "library-normalization-failed",
            {
                "category": "unexpected-category",
                "recordIndex": 3,
                "value": "unmistakable-source-value",
                "field": "title",
            },
        )
        detail = _safe_detail(error)
        self.assertEqual(detail["category"], "unclassified")
        self.assertEqual(detail["recordIndex"], 3)
        self.assertNotIn("value", detail)
        self.assertNotIn("field", detail)
        self.assertNotIn("unmistakable-source-value", repr(detail))

    def test_an_implausible_index_is_dropped_rather_than_echoed(self) -> None:
        for index in (-1, True, 10_000_000, "7", None):
            with self.subTest(index=repr(index)):
                detail = _safe_detail(
                    ConnectorError("x", {"category": "invalid-field-value", "recordIndex": index})
                )
                self.assertNotIn("recordIndex", detail)

    def test_an_error_without_a_detail_produces_none(self) -> None:
        self.assertIsNone(_safe_detail(ConnectorError("library-sync-failed")))
        self.assertIsNone(_safe_detail(RuntimeError("boom")))

    def test_the_category_vocabulary_is_closed(self) -> None:
        self.assertIn("unclassified", DIAGNOSTIC_CATEGORIES)
        self.assertEqual(len(DIAGNOSTIC_CATEGORIES), 6)


if __name__ == "__main__":
    unittest.main()
