from __future__ import annotations

import base64
import csv
import ctypes
import json
import os
import re
import subprocess
import sys
from ctypes import wintypes
from dataclasses import dataclass
from io import StringIO
from pathlib import Path
from typing import Any, Protocol

MAX_CREDENTIAL_BYTES = 4 * 1024 * 1024
MAX_SNAPSHOT_BYTES = 32 * 1024 * 1024
FILE_MAGIC = b"ATNR-DPAPI-1\x00"
ENTROPY = b"Audible Track and Recommend private alpha 0.0.1"

#: Purpose-bound envelope header (Alpha 0.0.2).
#:
#: The 0.0.1 envelope (``FILE_MAGIC``) carries no purpose tag, so any sealed
#: value was interchangeable with any other: a sealed private review could be
#: handed to the snapshot-opening route and decrypted, because both used the
#: same protector and the same header. Purpose is now bound *inside* the
#: authenticated header, and every open states the purpose it expects.
#:
#: The prefix deliberately *extends* ``FILE_MAGIC`` rather than replacing it.
#: The storage container validates the leading ``FILE_MAGIC`` bytes before it
#: will accept a sealed snapshot, and that check is owned by the storage
#: workstream; a replacement magic would have silently rejected every newly
#: sealed snapshot. Extending keeps the container contract intact while still
#: discriminating purpose *before* any ciphertext reaches the protector.
PURPOSE_MAGIC_PREFIX = FILE_MAGIC + b"P2\x00"

#: Closed purpose vocabulary. A value outside this set is never sealed or opened.
PURPOSE_LIBRARY_SNAPSHOT = "library-snapshot"
PURPOSE_PRIVATE_REVIEW = "private-review"
ENVELOPE_PURPOSES = frozenset({PURPOSE_LIBRARY_SNAPSHOT, PURPOSE_PRIVATE_REVIEW})

#: Purposes that may still be read from a 0.0.1 (untagged) envelope. Only the
#: library snapshot predates 0.0.2; a private review has never been written in
#: the legacy format, so accepting one there would only reopen the oracle.
LEGACY_READABLE_PURPOSES = frozenset({PURPOSE_LIBRARY_SNAPSHOT})


class CustodyError(RuntimeError):
    pass


class Protector(Protocol):
    def protect(self, plaintext: bytes) -> bytes: ...

    def unprotect(self, ciphertext: bytes) -> bytes: ...


class _DataBlob(ctypes.Structure):
    _fields_ = [("cbData", wintypes.DWORD), ("pbData", ctypes.POINTER(ctypes.c_byte))]


def _blob(data: bytes) -> tuple[_DataBlob, ctypes.Array[ctypes.c_char]]:
    buffer = ctypes.create_string_buffer(data)
    return (
        _DataBlob(len(data), ctypes.cast(buffer, ctypes.POINTER(ctypes.c_byte))),
        buffer,
    )


class WindowsDpapiProtector:
    _UI_FORBIDDEN = 0x1

    def __init__(self) -> None:
        if sys.platform != "win32":
            raise CustodyError("windows-dpapi-required")
        self._crypt32 = ctypes.WinDLL("crypt32", use_last_error=True)
        self._kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
        self._crypt32.CryptProtectData.argtypes = [
            ctypes.POINTER(_DataBlob),
            wintypes.LPCWSTR,
            ctypes.POINTER(_DataBlob),
            ctypes.c_void_p,
            ctypes.c_void_p,
            wintypes.DWORD,
            ctypes.POINTER(_DataBlob),
        ]
        self._crypt32.CryptProtectData.restype = wintypes.BOOL
        self._crypt32.CryptUnprotectData.argtypes = [
            ctypes.POINTER(_DataBlob),
            ctypes.POINTER(wintypes.LPWSTR),
            ctypes.POINTER(_DataBlob),
            ctypes.c_void_p,
            ctypes.c_void_p,
            wintypes.DWORD,
            ctypes.POINTER(_DataBlob),
        ]
        self._crypt32.CryptUnprotectData.restype = wintypes.BOOL
        self._kernel32.LocalFree.argtypes = [wintypes.HLOCAL]
        self._kernel32.LocalFree.restype = wintypes.HLOCAL

    def protect(self, plaintext: bytes) -> bytes:
        return self._transform(plaintext, protect=True)

    def unprotect(self, ciphertext: bytes) -> bytes:
        return self._transform(ciphertext, protect=False)

    def _transform(self, value: bytes, *, protect: bool) -> bytes:
        source, source_buffer = _blob(value)
        entropy, entropy_buffer = _blob(ENTROPY)
        output = _DataBlob()
        description = wintypes.LPWSTR()

        if protect:
            ok = self._crypt32.CryptProtectData(
                ctypes.byref(source),
                "ATnR private alpha",
                ctypes.byref(entropy),
                None,
                None,
                self._UI_FORBIDDEN,
                ctypes.byref(output),
            )
        else:
            ok = self._crypt32.CryptUnprotectData(
                ctypes.byref(source),
                ctypes.byref(description),
                ctypes.byref(entropy),
                None,
                None,
                self._UI_FORBIDDEN,
                ctypes.byref(output),
            )

        _ = source_buffer, entropy_buffer
        if not ok:
            raise CustodyError("dpapi-operation-failed")
        try:
            return ctypes.string_at(output.pbData, output.cbData)
        finally:
            if output.pbData:
                self._kernel32.LocalFree(ctypes.cast(output.pbData, ctypes.c_void_p))
            if description:
                self._kernel32.LocalFree(ctypes.cast(description, ctypes.c_void_p))


def private_data_root() -> Path:
    local_app_data = os.environ.get("LOCALAPPDATA")
    if not local_app_data:
        raise CustodyError("local-app-data-unavailable")
    return Path(local_app_data) / "ATnR" / "Alpha0.0.1" / "private-alpha"


_SYSTEM_ROOT_PATTERN = re.compile(r"^[A-Za-z]:\\[^<>\"|?*]*$")


def _system32() -> Path:
    """Absolute System32 directory from a validated environment value."""
    root = os.environ.get("SystemRoot") or os.environ.get("windir") or "C:\\Windows"
    if not _SYSTEM_ROOT_PATTERN.match(root):
        raise CustodyError("trusted-system-executable-missing")
    system32 = Path(root) / "System32"
    if not system32.is_dir():
        raise CustodyError("trusted-system-executable-missing")
    return system32


def trusted_system_executable(name: str) -> str:
    """
    Resolve a Windows helper to its absolute System32 path.

    Bare names resolve through PATH and relative names through the working
    directory; both are hijackable by anything that can write a file earlier
    in the search order. Only an absolute, existing System32 file is accepted.
    """
    if not re.fullmatch(r"[A-Za-z0-9._-]+\.exe", name):
        raise CustodyError("trusted-system-executable-missing")
    candidate = _system32() / name
    if not candidate.is_file():
        raise CustodyError("trusted-system-executable-missing")
    return str(candidate)


def _minimal_env() -> dict[str, str]:
    system32 = _system32()
    root = str(system32.parent)
    return {"SystemRoot": root, "windir": root, "PATH": str(system32)}


def _run_trusted(name: str, args: list[str], *, timeout: int) -> subprocess.CompletedProcess[str]:
    return subprocess.run(  # noqa: S603 - absolute trusted path, shell=False, fixed args
        [trusted_system_executable(name), *args],
        check=False,
        capture_output=True,
        text=True,
        timeout=timeout,
        shell=False,
        env=_minimal_env(),
    )


def _current_user() -> tuple[str, str]:
    """Return (account name, SID) for the current user."""
    result = _run_trusted("whoami.exe", ["/user", "/fo", "csv", "/nh"], timeout=10)
    if result.returncode != 0:
        raise CustodyError("current-user-sid-unavailable")
    rows = list(csv.reader(StringIO(result.stdout.strip())))
    if len(rows) != 1 or len(rows[0]) < 2 or not rows[0][1].startswith("S-1-"):
        raise CustodyError("current-user-sid-invalid")
    return rows[0][0], rows[0][1]


def _current_user_sid() -> str:
    return _current_user()[1]


def parse_icacls(output: str, path: Path) -> list[tuple[str, str]]:
    """Parse `icacls <path>` into (principal, rights) pairs."""
    entries: list[tuple[str, str]] = []
    for raw_line in output.splitlines():
        line = raw_line.strip()
        if not line or ":(" not in line:
            continue
        if line.startswith(str(path)):
            line = line[len(str(path)) :].strip()
        principal, _, rights = line.partition(":(")
        if not principal:
            continue
        entries.append((principal.strip(), "(" + rights))
    return entries


def verify_path_acl(path: Path) -> None:
    """
    Read the ACL back and prove it grants only the current user.

    A zero exit code from `icacls /grant:r` is not evidence that the resulting
    ACL is correct, so the ACL is always re-read before the path is used.
    """
    name, sid = _current_user()
    result = _run_trusted("icacls.exe", [str(path)], timeout=15)
    if result.returncode != 0:
        raise CustodyError("private-path-acl-unverified")
    entries = parse_icacls(result.stdout, path)
    if not entries:
        raise CustodyError("private-path-acl-unverified")
    allowed = {name.casefold(), sid.casefold()}
    for principal, rights in entries:
        if principal.casefold() not in allowed:
            raise CustodyError("private-path-acl-unverified")
        if "(I)" in rights:  # inherited ACEs must have been removed
            raise CustodyError("private-path-acl-unverified")


def secure_path(path: Path, *, directory: bool) -> None:
    sid = _current_user_sid()
    grant = f"*{sid}:(OI)(CI)F" if directory else f"*{sid}:F"
    result = _run_trusted(
        "icacls.exe",
        [str(path), "/inheritance:r", "/grant:r", grant],
        timeout=15,
    )
    if result.returncode != 0:
        raise CustodyError("private-path-acl-failed")
    verify_path_acl(path)


_ARTIFACT_NAME_PATTERN = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$")


def custody_artifact_path(name: str, root: Path | None = None) -> Path:
    """
    Resolve a migration/rollback artifact path *inside* the verified custody
    boundary (Alpha 0.0.2 runtime requirement).

    A rollback envelope holds the same personal library state as the live
    store. If it were written to a temporary directory, a synchronized folder,
    or anywhere reached by traversal or a link, it would leave the boundary
    that the ACL, DPAPI sealing and deletion semantics actually cover. Only a
    plain file name directly inside the hardened root is accepted, and the
    root's ACL is verified before the path is handed back.
    """
    if not _ARTIFACT_NAME_PATTERN.match(name or "") or name in {".", ".."}:
        raise CustodyError("custody-artifact-name-invalid")
    verified_root = ensure_private_root(root)
    candidate = (verified_root / name).resolve()
    if candidate.parent != verified_root:
        raise CustodyError("custody-artifact-outside-boundary")
    if candidate.is_symlink():
        raise CustodyError("custody-artifact-link-refused")
    return candidate


def ensure_private_root(root: Path | None = None) -> Path:
    """
    Create, harden and *verify* the private root before anything opens a file
    inside it. Any custody failure raises, so no store is ever opened on an
    unverified directory.
    """
    target = root or private_data_root()
    if target.is_symlink():
        raise CustodyError("private-root-unsafe")
    resolved = target.resolve()
    resolved.mkdir(parents=True, exist_ok=True)
    secure_path(resolved, directory=True)
    return resolved


def verify_custody_boundary(root: Path | None = None) -> dict[str, Any]:
    """
    Prove the OS-level custody boundary before any personal byte is written.

    ``ensure_private_root`` creates the root, applies a restrictive ACL and
    re-reads it with ``icacls`` to confirm that only the current user is
    granted and that no inherited ACE survived. Path-shape checks on the Node
    side cannot establish any of that: a directory can be perfectly contained
    and still be world-readable.

    The return value is deliberately closed and contentless — booleans and a
    fixed protector name only. It carries no path, no user name, no SID and no
    count, so it is safe to record as startup evidence.
    """

    verified_root = ensure_private_root(root)
    # Re-read the ACL after hardening. `ensure_private_root` already verifies,
    # but the proof is repeated here so this route can never be satisfied by a
    # cached or assumed result.
    verify_path_acl(verified_root)
    return {
        "custodyVerified": True,
        "aclVerified": True,
        "rootHardened": True,
        "protector": "windows-dpapi",
    }


@dataclass
class SecureJsonStore:
    path: Path
    protector: Protector

    @classmethod
    def credentials(cls, protector: Protector | None = None) -> "SecureJsonStore":
        root = ensure_private_root()
        return cls(root / "credentials.bin", protector or WindowsDpapiProtector())

    @classmethod
    def identity(cls, protector: Protector | None = None) -> "SecureJsonStore":
        root = ensure_private_root()
        return cls(root / "identity.bin", protector or WindowsDpapiProtector())

    def exists(self) -> bool:
        return self.path.is_file()

    def read(self) -> dict[str, Any]:
        try:
            encoded = self.path.read_bytes()
        except FileNotFoundError as error:
            raise CustodyError("connection-not-found") from error
        if len(encoded) > MAX_CREDENTIAL_BYTES or not encoded.startswith(FILE_MAGIC):
            raise CustodyError("credential-envelope-invalid")
        if encoded.startswith(PURPOSE_MAGIC_PREFIX):
            # A purpose-bound snapshot or review envelope is not a credential
            # file. Refuse before the protector sees it rather than relying on
            # decryption to fail.
            raise CustodyError("credential-envelope-invalid")
        plaintext = self.protector.unprotect(encoded[len(FILE_MAGIC) :])
        if len(plaintext) > MAX_CREDENTIAL_BYTES:
            raise CustodyError("credential-payload-too-large")
        try:
            value = json.loads(plaintext.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as error:
            raise CustodyError("credential-payload-invalid") from error
        if not isinstance(value, dict):
            raise CustodyError("credential-payload-invalid")
        return value

    def write(self, value: dict[str, Any]) -> None:
        root = ensure_private_root(self.path.parent)
        plaintext = json.dumps(
            value, ensure_ascii=True, separators=(",", ":"), sort_keys=True
        ).encode("utf-8")
        if len(plaintext) > MAX_CREDENTIAL_BYTES:
            raise CustodyError("credential-payload-too-large")
        encoded = FILE_MAGIC + self.protector.protect(plaintext)
        temporary = root / f".{self.path.name}.{os.getpid()}.tmp"
        try:
            with temporary.open("xb") as handle:
                handle.write(encoded)
                handle.flush()
                os.fsync(handle.fileno())
            secure_path(temporary, directory=False)
            os.replace(temporary, self.path)
            secure_path(self.path, directory=False)
        finally:
            temporary.unlink(missing_ok=True)

    def delete(self) -> None:
        if not self.path.exists():
            return
        size = self.path.stat().st_size
        with self.path.open("r+b", buffering=0) as handle:
            handle.write(os.urandom(size))
            handle.flush()
            os.fsync(handle.fileno())
        self.path.unlink()
        if self.path.exists():
            raise CustodyError("credential-delete-failed")


def _purpose_header(purpose: str) -> bytes:
    if purpose not in ENVELOPE_PURPOSES:
        raise CustodyError("envelope-purpose-invalid")
    return PURPOSE_MAGIC_PREFIX + purpose.encode("ascii") + b"\x00"


def seal_purpose(value: dict[str, Any], protector: Protector, *, purpose: str) -> str:
    """Seal a value under an explicit, header-bound purpose."""

    header = _purpose_header(purpose)
    plaintext = json.dumps(
        value, ensure_ascii=True, separators=(",", ":"), sort_keys=True
    ).encode("utf-8")
    if len(plaintext) > MAX_SNAPSHOT_BYTES:
        raise CustodyError("snapshot-too-large")
    return base64.b64encode(header + protector.protect(plaintext)).decode("ascii")


def unseal_purpose(
    encoded: str,
    protector: Protector,
    *,
    purpose: str,
    allow_legacy: bool | None = None,
) -> dict[str, Any]:
    """
    Open a sealed value, refusing every purpose except the expected one.

    The purpose is matched against the envelope header *before* the ciphertext
    is handed to the protector, so a record sealed for another purpose is never
    decrypted here — not even transiently. This is what stops the snapshot
    route from acting as a decryption oracle for private reviews.

    ``allow_legacy`` permits a 0.0.1 untagged envelope. It defaults to true
    only for purposes that actually predate 0.0.2.
    """

    header = _purpose_header(purpose)
    if allow_legacy is None:
        allow_legacy = purpose in LEGACY_READABLE_PURPOSES
    if not isinstance(encoded, str) or len(encoded) > MAX_SNAPSHOT_BYTES * 2:
        raise CustodyError("snapshot-envelope-invalid")
    try:
        blob = base64.b64decode(encoded, validate=True)
    except ValueError as error:
        raise CustodyError("snapshot-envelope-invalid") from error

    if blob.startswith(header):
        body = blob[len(header) :]
    elif blob.startswith(PURPOSE_MAGIC_PREFIX):
        # A purpose-bound envelope for a *different* purpose. Refused without
        # any decryption attempt.
        raise CustodyError("envelope-purpose-mismatch")
    elif allow_legacy and blob.startswith(FILE_MAGIC):
        body = blob[len(FILE_MAGIC) :]
    else:
        raise CustodyError("snapshot-envelope-invalid")

    plaintext = protector.unprotect(body)
    if len(plaintext) > MAX_SNAPSHOT_BYTES:
        raise CustodyError("snapshot-too-large")
    try:
        value = json.loads(plaintext.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise CustodyError("snapshot-payload-invalid") from error
    if not isinstance(value, dict):
        raise CustodyError("snapshot-payload-invalid")
    return value


def seal_snapshot(value: dict[str, Any], protector: Protector) -> str:
    """Seal a library snapshot. Purpose-bound; never opens a private review."""

    return seal_purpose(value, protector, purpose=PURPOSE_LIBRARY_SNAPSHOT)


def unseal_snapshot(encoded: str, protector: Protector) -> dict[str, Any]:
    """
    Open a library snapshot only.

    A 0.0.1 untagged envelope is still accepted so the owner's existing
    encrypted state stays readable, but a private-review envelope — which is
    always purpose-tagged — is refused.
    """

    return unseal_purpose(encoded, protector, purpose=PURPOSE_LIBRARY_SNAPSHOT)


def seal_local_record(value: dict[str, Any], protector: Protector) -> str:
    """Seal a locally owned private review. Always purpose-tagged."""

    return seal_purpose(value, protector, purpose=PURPOSE_PRIVATE_REVIEW)


def unseal_local_record(encoded: str, protector: Protector) -> dict[str, Any]:
    """
    Open a locally owned private review.

    Legacy untagged envelopes are refused: no private review has ever been
    written in that format, so accepting one would let a snapshot be laundered
    into the review path.
    """

    return unseal_purpose(
        encoded, protector, purpose=PURPOSE_PRIVATE_REVIEW, allow_legacy=False
    )
