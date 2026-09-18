"""
Custody ACL-before-use tests (A2-WP016 / ATR-S016).

Only synthetic temporary directories are used. The personal private root under
LOCALAPPDATA is never created, read, hardened or deleted by this module.
"""

import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from atnr_connector.custody import (
    CustodyError,
    custody_artifact_path,
    ensure_private_root,
    parse_icacls,
    secure_path,
    trusted_system_executable,
    verify_path_acl,
)


class TrustedExecutableTests(unittest.TestCase):
    @unittest.skipUnless(sys.platform == "win32", "Windows helper resolution")
    def test_helpers_resolve_to_absolute_system32_paths(self) -> None:
        for name in ("whoami.exe", "icacls.exe"):
            resolved = trusted_system_executable(name)
            self.assertTrue(os.path.isabs(resolved))
            self.assertTrue(resolved.lower().endswith("\\system32\\" + name))

    def test_bare_relative_and_non_exe_names_are_rejected(self) -> None:
        for name in ("whoami", "..\\whoami.exe", "sub/whoami.exe", "evil.bat", "", "whoami.exe "):
            with self.assertRaises(CustodyError):
                trusted_system_executable(name)

    def test_a_hijacked_system_root_is_not_trusted(self) -> None:
        with patch.dict(os.environ, {"SystemRoot": "not-a-path", "windir": "not-a-path"}):
            with self.assertRaises(CustodyError):
                trusted_system_executable("whoami.exe")


class AclParsingTests(unittest.TestCase):
    def test_icacls_output_is_parsed_into_principal_and_rights(self) -> None:
        path = Path("C:\\synthetic\\root")
        output = (
            "C:\\synthetic\\root DESKTOP\\owner:(OI)(CI)(F)\r\n"
            "\r\n"
            "Successfully processed 1 files; Failed processing 0 files\r\n"
        )
        self.assertEqual(parse_icacls(output, path), [("DESKTOP\\owner", "(OI)(CI)(F)")])

    def test_summary_and_blank_lines_are_ignored(self) -> None:
        self.assertEqual(parse_icacls("Successfully processed 1 files\n\n", Path("C:\\x")), [])


class AclVerificationTests(unittest.TestCase):
    """The ACL is always re-read; a successful icacls exit code is not proof."""

    def setUp(self) -> None:
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.path = Path(self.directory.name)

    def _run(self, stdout: str, returncode: int = 0):
        class Result:
            def __init__(self) -> None:
                self.returncode = returncode
                self.stdout = stdout
                self.stderr = ""

        return Result()

    def test_an_owner_only_acl_verifies(self) -> None:
        owner = f"{self.path} DESKTOP\\owner:(OI)(CI)(F)\n"
        with (
            patch("atnr_connector.custody._current_user", return_value=("DESKTOP\\owner", "S-1-5-21-1")),
            patch("atnr_connector.custody._run_trusted", return_value=self._run(owner)),
        ):
            verify_path_acl(self.path)  # must not raise

    def test_a_foreign_principal_fails_closed(self) -> None:
        shared = (
            f"{self.path} DESKTOP\\owner:(OI)(CI)(F)\n"
            "              BUILTIN\\Users:(RX)\n"
        )
        with (
            patch("atnr_connector.custody._current_user", return_value=("DESKTOP\\owner", "S-1-5-21-1")),
            patch("atnr_connector.custody._run_trusted", return_value=self._run(shared)),
        ):
            with self.assertRaises(CustodyError) as raised:
                verify_path_acl(self.path)
        self.assertEqual(str(raised.exception), "private-path-acl-unverified")

    def test_an_inherited_ace_fails_closed(self) -> None:
        inherited = f"{self.path} DESKTOP\\owner:(I)(OI)(CI)(F)\n"
        with (
            patch("atnr_connector.custody._current_user", return_value=("DESKTOP\\owner", "S-1-5-21-1")),
            patch("atnr_connector.custody._run_trusted", return_value=self._run(inherited)),
        ):
            with self.assertRaises(CustodyError):
                verify_path_acl(self.path)

    def test_an_unreadable_acl_fails_closed(self) -> None:
        with (
            patch("atnr_connector.custody._current_user", return_value=("DESKTOP\\owner", "S-1-5-21-1")),
            patch("atnr_connector.custody._run_trusted", return_value=self._run("", returncode=1)),
        ):
            with self.assertRaises(CustodyError):
                verify_path_acl(self.path)

    def test_secure_path_verifies_after_granting(self) -> None:
        calls: list[str] = []

        def fake_run(name, args, *, timeout):  # noqa: ANN001, ARG001
            calls.append(args[1] if len(args) > 1 else args[0])
            return self._run(f"{self.path} DESKTOP\\owner:(OI)(CI)(F)\n")

        with (
            patch("atnr_connector.custody._current_user", return_value=("DESKTOP\\owner", "S-1-5-21-1")),
            patch("atnr_connector.custody._current_user_sid", return_value="S-1-5-21-1"),
            patch("atnr_connector.custody._run_trusted", side_effect=fake_run),
        ):
            secure_path(self.path, directory=True)
        # /inheritance:r ran first, and the ACL was read back afterwards.
        self.assertEqual(calls[0], "/inheritance:r")
        self.assertEqual(len(calls), 2)

    def test_a_grant_failure_prevents_use(self) -> None:
        with (
            patch("atnr_connector.custody._current_user_sid", return_value="S-1-5-21-1"),
            patch("atnr_connector.custody._run_trusted", return_value=self._run("", returncode=5)),
        ):
            with self.assertRaises(CustodyError) as raised:
                secure_path(self.path, directory=True)
        self.assertEqual(str(raised.exception), "private-path-acl-failed")


class PrivateRootTests(unittest.TestCase):
    def test_the_root_is_hardened_and_verified_before_it_is_returned(self) -> None:
        order: list[str] = []
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory) / "private-alpha"

            def fake_secure(path, *, directory):  # noqa: ANN001, ARG001
                order.append("secured")
                self.assertTrue(path.is_dir())

            with patch("atnr_connector.custody.secure_path", side_effect=fake_secure):
                resolved = ensure_private_root(target)
            self.assertEqual(order, ["secured"])
            self.assertEqual(resolved, target.resolve())

    def test_a_custody_failure_stops_the_root_from_being_used(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory) / "private-alpha"
            with patch(
                "atnr_connector.custody.secure_path",
                side_effect=CustodyError("private-path-acl-unverified"),
            ):
                with self.assertRaises(CustodyError):
                    ensure_private_root(target)

    @unittest.skipUnless(sys.platform == "win32", "symlink creation requires privilege on Windows")
    def test_a_symlinked_root_is_refused(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            real = Path(directory) / "real"
            real.mkdir()
            link = Path(directory) / "link"
            try:
                link.symlink_to(real, target_is_directory=True)
            except OSError:
                self.skipTest("symlink creation not permitted in this environment")
            with patch("atnr_connector.custody.secure_path"):
                with self.assertRaises(CustodyError) as raised:
                    ensure_private_root(link)
            self.assertEqual(str(raised.exception), "private-root-unsafe")


class CustodyArtifactTests(unittest.TestCase):
    """A rollback envelope holds the same personal state as the live store."""

    def setUp(self) -> None:
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name) / "private-alpha"
        self.root.mkdir()

    def test_an_artifact_resolves_inside_the_verified_root(self) -> None:
        with patch("atnr_connector.custody.secure_path") as secured:
            resolved = custody_artifact_path("library.sqlite3.migration-backup", self.root)
        self.assertEqual(resolved.parent, self.root.resolve())
        # The root is hardened and verified before the path is handed back.
        secured.assert_called_once()

    def test_traversal_and_absolute_escapes_are_refused(self) -> None:
        for name in (
            "..",
            ".",
            "../escape.db",
            "..\\escape.db",
            "sub/escape.db",
            "C:\\Windows\\Temp\\escape.db",
            "",
            "a" * 200,
        ):
            with patch("atnr_connector.custody.secure_path"):
                with self.assertRaises(CustodyError, msg=f"accepted {name!r}"):
                    custody_artifact_path(name, self.root)

    def test_a_linked_artifact_is_refused(self) -> None:
        outside = Path(self.directory.name) / "outside.db"
        outside.write_bytes(b"sealed")
        link = self.root / "rollback.db"
        try:
            link.symlink_to(outside)
        except OSError:
            self.skipTest("symlink creation not permitted in this environment")
        with patch("atnr_connector.custody.secure_path"):
            with self.assertRaises(CustodyError) as raised:
                custody_artifact_path("rollback.db", self.root)
        self.assertEqual(str(raised.exception), "custody-artifact-link-refused")

    def test_an_unverified_root_stops_the_artifact_from_being_used(self) -> None:
        with patch(
            "atnr_connector.custody.secure_path",
            side_effect=CustodyError("private-path-acl-unverified"),
        ):
            with self.assertRaises(CustodyError):
                custody_artifact_path("rollback.db", self.root)


if __name__ == "__main__":
    unittest.main()
