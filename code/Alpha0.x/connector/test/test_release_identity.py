"""
Release identity and legacy-custody immutability (Alpha 0.0.2).

The implemented release is 0.0.2, but the custody directory and the DPAPI
entropy are pinned to 0.0.1 forever: they name state that already exists on the
owner's machine. Changing either would relocate the private root or make every
sealed payload undecryptable, which is indistinguishable from data loss.

No personal state is created, read or written here. The root path is resolved
against a synthetic LOCALAPPDATA value only.
"""

import re
import unittest
from pathlib import Path
from unittest.mock import patch

from atnr_connector import CONNECTOR_VERSION, LEGACY_CUSTODY_RELEASE
from atnr_connector.custody import ENTROPY, private_data_root

REPO_ROOT = Path(__file__).resolve().parents[2]


class ReleaseIdentityTest(unittest.TestCase):
    def test_connector_declares_the_implemented_release(self) -> None:
        self.assertEqual(CONNECTOR_VERSION, "0.0.2")

    def test_legacy_release_constant_is_named_and_distinct(self) -> None:
        self.assertEqual(LEGACY_CUSTODY_RELEASE, "0.0.1")
        self.assertNotEqual(LEGACY_CUSTODY_RELEASE, CONNECTOR_VERSION)

    def test_dpapi_entropy_stays_pinned_to_the_legacy_release(self) -> None:
        # Re-keying entropy would orphan every existing sealed payload.
        self.assertEqual(
            ENTROPY,
            b"Audible Track and Recommend private alpha 0.0.1",
        )
        self.assertNotIn(CONNECTOR_VERSION.encode(), ENTROPY)

    def test_private_root_does_not_follow_the_release(self) -> None:
        with patch.dict("os.environ", {"LOCALAPPDATA": r"C:\synthetic-localappdata"}):
            root = private_data_root()
        self.assertEqual(root.parts[-3:], ("ATnR", "Alpha0.0.1", "private-alpha"))
        self.assertNotIn(f"Alpha{CONNECTOR_VERSION}", str(root))

    def test_node_and_python_pin_the_same_custody_directory(self) -> None:
        version_js = (REPO_ROOT / "src" / "version.js").read_text(encoding="utf-8")
        legacy = re.search(r"LEGACY_ALPHA_VERSION = '([^']+)'", version_js)
        self.assertIsNotNone(legacy)
        self.assertEqual(legacy.group(1), LEGACY_CUSTODY_RELEASE)
        alpha = re.search(r"const ALPHA_VERSION = '([^']+)'", version_js)
        self.assertIsNotNone(alpha)
        self.assertEqual(alpha.group(1), CONNECTOR_VERSION)


if __name__ == "__main__":
    unittest.main()
