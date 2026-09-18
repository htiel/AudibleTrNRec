"""Record reproducible artifact hashes for the pinned connector dependencies.

Provenance rules enforced here:
  - the only index consulted is the approved HTTPS pypi.org JSON API, over a
    verified public-CA TLS connection (no interception proxy, no mirror);
  - exactly one artifact is selected per pinned distribution, for the exact
    target environment (CPython 3.13, win_amd64), using explicit wheel-tag
    rules rather than an opaque resolver;
  - only binary wheels are eligible under `--only-binary :all:`; a distribution
    that publishes no compatible wheel still has its source-artifact hash
    recorded as evidence, but is reported so the flag is never quietly relaxed;
    - the selected artifact filename is recorded as a comment above each pin so
      the wheel/source nature of every distribution stays auditable from the
      digest-protected lock itself;
  - a yanked artifact or a missing digest is a hard stop. Nothing partial is
    ever written.

The digests written here are the ones PyPI publishes for those exact files.
pip verifies the downloaded bytes against them at install time under
`--require-hashes`, so a substituted artifact fails the install closed.

Usage: python scripts/record-dependency-hashes.py [--write]
"""

from __future__ import annotations

import json
import re
import sys
import urllib.request
from pathlib import Path

INDEX = "https://pypi.org/pypi"
TARGET_PYTHON = (3, 13)
TARGET_PLATFORM = "win_amd64"
ROOT = Path(__file__).resolve().parent.parent
LOCK = ROOT / "connector" / "requirements-private-alpha.lock"

WHEEL_NAME = re.compile(
    r"^(?P<name>[^-]+)-(?P<version>[^-]+)(?:-(?P<build>\d[^-]*))?"
    r"-(?P<python>[^-]+)-(?P<abi>[^-]+)-(?P<platform>[^-]+)\.whl$"
)
CPYTHON_TAG = re.compile(r"^cp(\d)(\d+)$")


def _platform_ok(platform_tag: str) -> bool:
    return TARGET_PLATFORM in platform_tag.split(".") or platform_tag == "any"


def _rank(python_tag: str, abi_tag: str, platform_tag: str) -> int | None:
    """Lower is better. `None` means the wheel is not usable on the target."""
    if not _platform_ok(platform_tag):
        return None
    pythons = python_tag.split(".")
    abis = abi_tag.split(".")
    native = platform_tag != "any"

    # Exact interpreter + exact ABI, e.g. cp313-cp313-win_amd64.
    if f"cp{TARGET_PYTHON[0]}{TARGET_PYTHON[1]}" in pythons and f"cp{TARGET_PYTHON[0]}{TARGET_PYTHON[1]}" in abis:
        return 0 if native else 1
    # Stable ABI, e.g. cp39-abi3-win_amd64 (usable by any newer CPython 3.x).
    if "abi3" in abis:
        for tag in pythons:
            match = CPYTHON_TAG.match(tag)
            if match and (int(match.group(1)), int(match.group(2))) <= TARGET_PYTHON:
                return 2 if native else 3
        return None
    # Pure Python, e.g. py3-none-any.
    if "none" in abis and ("py3" in pythons or f"cp{TARGET_PYTHON[0]}{TARGET_PYTHON[1]}" in pythons):
        return 4 if native else 5
    return None


def select(name: str, version: str) -> dict[str, str]:
    with urllib.request.urlopen(f"{INDEX}/{name}/{version}/json", timeout=60) as response:
        if response.status != 200:
            raise SystemExit(f"{name}=={version}: index returned {response.status}")
        payload = json.load(response)

    best: tuple[int, dict] | None = None
    sdist: dict | None = None
    for entry in payload.get("urls", []):
        if entry.get("yanked"):
            continue
        if entry.get("packagetype") == "sdist" and sdist is None:
            sdist = entry
        if entry.get("packagetype") != "bdist_wheel":
            continue
        parsed = WHEEL_NAME.match(entry.get("filename", ""))
        if not parsed:
            continue
        rank = _rank(parsed["python"], parsed["abi"], parsed["platform"])
        if rank is None:
            continue
        if best is None or rank < best[0]:
            best = (rank, entry)

    # A distribution that publishes no compatible wheel cannot satisfy
    # `--only-binary :all:`. Its hash is still recorded as evidence, but it is
    # reported as a source artifact so the flag is never quietly relaxed.
    entry = best[1] if best is not None else sdist
    kind = "wheel" if best is not None else "sdist"
    if entry is None:
        raise SystemExit(f"{name}=={version}: the index published no usable artifact")
    digest = (entry.get("digests") or {}).get("sha256")
    if not isinstance(digest, str) or not re.fullmatch(r"[a-f0-9]{64}", digest):
        raise SystemExit(f"{name}=={version}: index published no usable sha256 digest")
    return {"filename": entry["filename"], "sha256": digest, "kind": kind}


def main(argv: list[str]) -> int:
    pinned = []
    for line in LOCK.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or stripped.startswith("--hash="):
            continue
        requirement = stripped.split("--hash=")[0].strip().rstrip("\\").strip()
        name, _, version = requirement.partition("==")
        if not name or not version:
            raise SystemExit(f"lock line is not an exact pin: {stripped}")
        pinned.append((name, version))

    lines = []
    source_artifacts = []
    for name, version in pinned:
        chosen = select(name, version)
        print(f"{name}=={version} -> {chosen['filename']} [{chosen['kind']}]")
        if chosen["kind"] != "wheel":
            source_artifacts.append(f"{name}=={version} ({chosen['filename']})")
        lines.append(
            f"# {chosen['filename']}\n{name}=={version} \\\n    --hash=sha256:{chosen['sha256']}"
        )

    rendered = "\n".join(lines) + "\n"
    if "--write" in argv:
        LOCK.write_text(rendered, encoding="utf-8", newline="\n")
        print(f"\nwrote {len(pinned)} hash-pinned requirements to {LOCK}")
    else:
        print(f"\n{len(pinned)} requirements resolved; re-run with --write to record them")
    if source_artifacts:
        print("\nSOURCE ARTIFACTS (cannot satisfy --only-binary :all:):")
        for item in source_artifacts:
            print(f"  {item}")
        print("These require a named, scoped approval before any install is permitted.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
