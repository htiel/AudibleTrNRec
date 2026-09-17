import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from atnr_connector.custody import (
    SecureJsonStore,
    WindowsDpapiProtector,
    seal_snapshot,
    unseal_snapshot,
)


class ReversibleProtector:
    def protect(self, plaintext: bytes) -> bytes:
        return b"protected:" + plaintext[::-1]

    def unprotect(self, ciphertext: bytes) -> bytes:
        if not ciphertext.startswith(b"protected:"):
            raise ValueError("invalid test ciphertext")
        return ciphertext[len(b"protected:") :][::-1]


class CustodyTests(unittest.TestCase):
    def test_secure_json_store_never_writes_plaintext(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "credentials.bin"
            store = SecureJsonStore(path, ReversibleProtector())
            value = {"refresh_token": "synthetic-secret", "schemaVersion": 1}
            with (
                patch("atnr_connector.custody.ensure_private_root", return_value=Path(directory)),
                patch("atnr_connector.custody.secure_path"),
            ):
                store.write(value)
                self.assertNotIn(b"synthetic-secret", path.read_bytes())
                self.assertEqual(store.read(), value)
                store.delete()
                self.assertFalse(path.exists())

    def test_snapshot_round_trip_is_sealed(self) -> None:
        snapshot = {"schemaVersion": 1, "catalog": {"books": []}, "entries": []}
        protector = ReversibleProtector()
        encoded = seal_snapshot(snapshot, protector)
        self.assertNotIn(json.dumps(snapshot), encoded)
        self.assertEqual(unseal_snapshot(encoded, protector), snapshot)

    @unittest.skipUnless(sys.platform == "win32", "Windows DPAPI test")
    def test_windows_dpapi_round_trip(self) -> None:
        protector = WindowsDpapiProtector()
        plaintext = b"ATnR synthetic DPAPI canary"
        ciphertext = protector.protect(plaintext)
        self.assertNotEqual(ciphertext, plaintext)
        self.assertEqual(protector.unprotect(ciphertext), plaintext)


if __name__ == "__main__":
    unittest.main()
