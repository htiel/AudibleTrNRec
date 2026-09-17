from __future__ import annotations

import base64
import csv
import ctypes
import json
import os
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


def _current_user_sid() -> str:
    result = subprocess.run(
        ["whoami", "/user", "/fo", "csv", "/nh"],
        check=False,
        capture_output=True,
        text=True,
        timeout=10,
    )
    if result.returncode != 0:
        raise CustodyError("current-user-sid-unavailable")
    rows = list(csv.reader(StringIO(result.stdout.strip())))
    if len(rows) != 1 or len(rows[0]) < 2 or not rows[0][1].startswith("S-1-"):
        raise CustodyError("current-user-sid-invalid")
    return rows[0][1]


def secure_path(path: Path, *, directory: bool) -> None:
    sid = _current_user_sid()
    grant = f"*{sid}:(OI)(CI)F" if directory else f"*{sid}:F"
    result = subprocess.run(
        ["icacls", str(path), "/inheritance:r", "/grant:r", grant],
        check=False,
        capture_output=True,
        text=True,
        timeout=15,
    )
    if result.returncode != 0:
        raise CustodyError("private-path-acl-failed")


def ensure_private_root(root: Path | None = None) -> Path:
    resolved = (root or private_data_root()).resolve()
    resolved.mkdir(parents=True, exist_ok=True)
    secure_path(resolved, directory=True)
    return resolved


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


def seal_snapshot(value: dict[str, Any], protector: Protector) -> str:
    plaintext = json.dumps(
        value, ensure_ascii=True, separators=(",", ":"), sort_keys=True
    ).encode("utf-8")
    if len(plaintext) > MAX_SNAPSHOT_BYTES:
        raise CustodyError("snapshot-too-large")
    return base64.b64encode(FILE_MAGIC + protector.protect(plaintext)).decode("ascii")


def unseal_snapshot(encoded: str, protector: Protector) -> dict[str, Any]:
    if not isinstance(encoded, str) or len(encoded) > MAX_SNAPSHOT_BYTES * 2:
        raise CustodyError("snapshot-envelope-invalid")
    try:
        blob = base64.b64decode(encoded, validate=True)
    except ValueError as error:
        raise CustodyError("snapshot-envelope-invalid") from error
    if not blob.startswith(FILE_MAGIC):
        raise CustodyError("snapshot-envelope-invalid")
    plaintext = protector.unprotect(blob[len(FILE_MAGIC) :])
    if len(plaintext) > MAX_SNAPSHOT_BYTES:
        raise CustodyError("snapshot-too-large")
    try:
        value = json.loads(plaintext.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise CustodyError("snapshot-payload-invalid") from error
    if not isinstance(value, dict):
        raise CustodyError("snapshot-payload-invalid")
    return value
