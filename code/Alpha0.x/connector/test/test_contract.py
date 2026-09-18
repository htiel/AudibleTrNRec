"""Source-contract artifact agreement tests (CP-01 input).

The connector must read its limits from the reviewed artifact rather than from
inlined constants, and must fail closed when the artifact is missing, damaged
or of an unsupported revision.
"""

import importlib
import json
import unittest
from pathlib import Path
from unittest.mock import patch

from atnr_connector import contract

ARTIFACT = Path(contract.CONTRACT_PATH)


class ArtifactTests(unittest.TestCase):
    def test_the_artifact_exists_and_declares_the_supported_revision(self) -> None:
        raw = json.loads(ARTIFACT.read_text(encoding="utf-8"))
        self.assertEqual(raw["contractRevision"], contract.CONTRACT_REVISION)
        for key in contract.EXPECTED_KEYS:
            self.assertIn(key, raw)

    def test_every_derived_constant_matches_the_artifact(self) -> None:
        raw = json.loads(ARTIFACT.read_text(encoding="utf-8"))
        self.assertEqual(contract.CONTRIBUTOR_LIMIT, raw["contributorLimit"])
        self.assertEqual(contract.CATEGORY_LADDER_LIMIT, raw["facetLimits"]["categoryLadders"])
        self.assertEqual(contract.MAX_PAGES, raw["pagination"]["maxPages"])
        self.assertEqual(contract.PAGE_SIZE, raw["pagination"]["pageSize"])
        self.assertEqual(contract.MAX_ITEMS, raw["pagination"]["maxItems"])
        self.assertEqual(
            contract.MAX_RESPONSE_BYTES, raw["pagination"]["maxCumulativeResponseBytes"]
        )
        self.assertEqual(contract.BYTE_ACCOUNTING, raw["pagination"]["byteAccounting"])
        self.assertEqual(
            contract.BYTE_ACCOUNTING_IS_WIRE_PROOF,
            raw["pagination"]["byteAccountingIsWireProof"],
        )
        self.assertEqual(
            list(contract.COMPLETENESS_BASES), raw["pagination"]["completenessBases"]
        )

    def test_the_declared_progress_scale_is_a_percentage(self) -> None:
        declared = contract.progress_scale("percent_complete")
        self.assertIsNotNone(declared)
        self.assertEqual(declared["scale"], "percent-0-100")
        self.assertEqual(declared["invalidPolicy"], "reject-record")
        self.assertEqual(declared["absentPolicy"], "unknown")

    def test_an_undeclared_progress_field_has_no_scale(self) -> None:
        self.assertIsNone(contract.progress_scale("listening_seconds"))


class FailClosedTests(unittest.TestCase):
    """A missing, damaged or drifted artifact must never fall back silently."""

    def _reload_with(self, text: str | None):
        def fake_read_text(self_path, encoding="utf-8"):  # noqa: ANN001 - patch shim
            if text is None:
                raise OSError("missing")
            return text

        with patch.object(Path, "read_text", fake_read_text):
            return importlib.reload(contract)

    def _assert_fails_closed(self, text: str | None, expected: str) -> None:
        # `importlib.reload` rebinds the module's classes, so the failure is
        # matched on the stable code rather than on class identity.
        with self.assertRaises(RuntimeError) as caught:
            self._reload_with(text)
        self.assertEqual(getattr(caught.exception, "code", None), expected)

    def tearDown(self) -> None:
        importlib.reload(contract)

    def test_a_missing_artifact_fails_closed(self) -> None:
        self._assert_fails_closed(None, "source-contract-unavailable")

    def test_damaged_json_fails_closed(self) -> None:
        self._assert_fails_closed("{not json", "source-contract-invalid")

    def test_an_unsupported_revision_fails_closed(self) -> None:
        raw = json.loads(ARTIFACT.read_text(encoding="utf-8"))
        raw["contractRevision"] = "atr-source-contract-r99"
        self._assert_fails_closed(json.dumps(raw), "source-contract-revision-unsupported")

    def test_a_truncated_artifact_fails_closed(self) -> None:
        raw = json.loads(ARTIFACT.read_text(encoding="utf-8"))
        del raw["pagination"]
        self._assert_fails_closed(json.dumps(raw), "source-contract-invalid")


if __name__ == "__main__":
    unittest.main()
