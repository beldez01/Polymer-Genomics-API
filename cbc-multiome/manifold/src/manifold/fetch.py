"""Idempotent download helpers."""
from __future__ import annotations

import hashlib
from pathlib import Path


def sha256_of(path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def should_fetch(path, expected_sha256: str | None) -> bool:
    """True if the file is missing or (when a checksum is given) does not match."""
    p = Path(path)
    if not p.exists():
        return True
    if expected_sha256 is None:
        return False
    return sha256_of(p) != expected_sha256
