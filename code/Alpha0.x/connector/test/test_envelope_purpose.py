"""
Purpose-bound custody envelope tests (final review must-fix).

Before purpose binding, a sealed private review and a sealed library snapshot
shared one header and one protector, so the snapshot-opening route decrypted
private reviews on request. These tests prove the oracle is closed in both
directions and that the owner's existing 0.0.1 state stays readable.

Only synthetic payloads and a fake protector are used. No personal state, no
DPAPI call and no custody root are touched.
"""

import base64
import json
import tempfile
import unittest
from pathlib import Path

from atnr_connector.custody import (
    FILE_MAGIC,
    PURPOSE_LIBRARY_SNAPSHOT,
    PURPOSE_MAGIC_PREFIX,
    PURPOSE_PRIVATE_REVIEW,
    CustodyError,
    SecureJsonStore,
    seal_local_record,
    seal_purpose,
    seal_snapshot,
    unseal_local_record,
    unseal_purpose,
    unseal_snapshot,
)


class ReversibleProtector:
    """A deliberately transparent protector.

    Using a reversible transform proves the refusals come from the purpose
    binding itself, not from an inability to decrypt. A protector that simply
    failed would hide a missing check.
    """

    def __init__(self) -> None:
        self.unprotect_calls = 0

    def protect(self, data: bytes) -> bytes:
        return bytes(b ^ 0x5A for b in data)

    def unprotect(self, data: bytes) -> bytes:
        self.unprotect_calls += 1
        return bytes(b ^ 0x5A for b in data)


SNAPSHOT = {"schemaVersion": 1, "entries": [], "catalog": {}}
REVIEW = {"purpose": "private-review", "record": {"rating": 5}}


class EnvelopePurposeTests(unittest.TestCase):
    def setUp(self) -> None:
        self.protector = ReversibleProtector()

    def test_each_purpose_round_trips_through_its_own_route(self) -> None:
        sealed_snapshot = seal_snapshot(SNAPSHOT, self.protector)
        self.assertEqual(unseal_snapshot(sealed_snapshot, self.protector), SNAPSHOT)

        sealed_review = seal_local_record(REVIEW, self.protector)
        self.assertEqual(unseal_local_record(sealed_review, self.protector), REVIEW)

    def test_the_snapshot_route_cannot_decrypt_a_private_review(self) -> None:
        sealed_review = seal_local_record(REVIEW, self.protector)
        before = self.protector.unprotect_calls
        with self.assertRaises(CustodyError) as caught:
            unseal_snapshot(sealed_review, self.protector)
        self.assertEqual(str(caught.exception), "envelope-purpose-mismatch")
        # Refused on the header, so the ciphertext was never even decrypted.
        self.assertEqual(self.protector.unprotect_calls, before)

    def test_the_review_route_cannot_decrypt_a_library_snapshot(self) -> None:
        sealed_snapshot = seal_snapshot(SNAPSHOT, self.protector)
        before = self.protector.unprotect_calls
        with self.assertRaises(CustodyError) as caught:
            unseal_local_record(sealed_snapshot, self.protector)
        self.assertEqual(str(caught.exception), "envelope-purpose-mismatch")
        self.assertEqual(self.protector.unprotect_calls, before)

    def test_envelopes_for_the_two_purposes_are_distinguishable(self) -> None:
        snapshot_blob = base64.b64decode(seal_snapshot(SNAPSHOT, self.protector))
        review_blob = base64.b64decode(seal_local_record(REVIEW, self.protector))
        for blob in (snapshot_blob, review_blob):
            self.assertTrue(blob.startswith(PURPOSE_MAGIC_PREFIX))
        self.assertTrue(
            snapshot_blob.startswith(
                PURPOSE_MAGIC_PREFIX + PURPOSE_LIBRARY_SNAPSHOT.encode() + b"\x00"
            )
        )
        self.assertTrue(
            review_blob.startswith(
                PURPOSE_MAGIC_PREFIX + PURPOSE_PRIVATE_REVIEW.encode() + b"\x00"
            )
        )

    def test_a_sealed_snapshot_still_satisfies_the_storage_container_check(self) -> None:
        # The storage container (src/store/encrypted-snapshot-store.js) refuses
        # any sealed payload that does not begin with FILE_MAGIC. Purpose
        # binding must not break that contract, or every newly sealed snapshot
        # would be rejected on save.
        snapshot_blob = base64.b64decode(seal_snapshot(SNAPSHOT, self.protector))
        self.assertTrue(snapshot_blob.startswith(FILE_MAGIC))
        self.assertTrue(PURPOSE_MAGIC_PREFIX.startswith(FILE_MAGIC))

    def test_an_unknown_purpose_is_never_sealed_or_opened(self) -> None:
        for purpose in ("", "credentials", "library-snapshot ", "PRIVATE-REVIEW"):
            with self.assertRaises(CustodyError) as sealing:
                seal_purpose(SNAPSHOT, self.protector, purpose=purpose)
            self.assertEqual(str(sealing.exception), "envelope-purpose-invalid")
            with self.assertRaises(CustodyError):
                unseal_purpose("AAAA", self.protector, purpose=purpose)

    def test_legacy_0_0_1_state_still_opens_as_a_library_snapshot(self) -> None:
        plaintext = json.dumps(SNAPSHOT, ensure_ascii=True, separators=(",", ":"), sort_keys=True)
        legacy = base64.b64encode(
            FILE_MAGIC + self.protector.protect(plaintext.encode("utf-8"))
        ).decode("ascii")
        self.assertEqual(unseal_snapshot(legacy, self.protector), SNAPSHOT)

    def test_a_legacy_envelope_is_never_accepted_as_a_private_review(self) -> None:
        # No private review has ever been written untagged, so accepting one
        # here would simply reopen the oracle through the legacy path.
        plaintext = json.dumps(REVIEW, ensure_ascii=True, separators=(",", ":"), sort_keys=True)
        legacy = base64.b64encode(
            FILE_MAGIC + self.protector.protect(plaintext.encode("utf-8"))
        ).decode("ascii")
        before = self.protector.unprotect_calls
        with self.assertRaises(CustodyError) as caught:
            unseal_local_record(legacy, self.protector)
        self.assertEqual(str(caught.exception), "snapshot-envelope-invalid")
        self.assertEqual(self.protector.unprotect_calls, before)

    def test_malformed_and_oversized_envelopes_fail_closed(self) -> None:
        for candidate in ("", "not base64!!", "AAAA", None, 12345):
            with self.assertRaises(CustodyError):
                unseal_snapshot(candidate, self.protector)  # type: ignore[arg-type]

    def test_a_purpose_bound_envelope_is_refused_as_a_credential_file(self) -> None:
        # The credential reader only checked the leading FILE_MAGIC, which a
        # purpose-bound envelope now shares. It must refuse before the
        # protector is invoked.
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "credentials.bin"
            path.write_bytes(base64.b64decode(seal_local_record(REVIEW, self.protector)))
            store = SecureJsonStore(path, self.protector)
            before = self.protector.unprotect_calls
            with self.assertRaises(CustodyError) as caught:
                store.read()
            self.assertEqual(str(caught.exception), "credential-envelope-invalid")
            self.assertEqual(self.protector.unprotect_calls, before)


if __name__ == "__main__":
    unittest.main()
