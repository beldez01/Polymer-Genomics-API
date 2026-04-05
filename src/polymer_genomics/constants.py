"""Shared constants for the Polymer Genomics API."""

import re

VALID_BUILDS = {"hg37", "hg38"}

_SAFE_IDENT_RE = re.compile(r"^[a-z_][a-z0-9_]*$")


def safe_identifier(name: str, allowed: set[str] | frozenset[str]) -> str:
    """Validate a SQL identifier is safe to interpolate.

    Checks both format (lowercase alphanumeric + underscores) and membership
    in an explicit allow-set. Raises ValueError on failure.
    """
    if not _SAFE_IDENT_RE.match(name):
        raise ValueError(f"Unsafe SQL identifier: {name!r}")
    if name not in allowed:
        raise ValueError(f"Identifier {name!r} not in allowed set")
    return name


def safe_table(qualified_name: str, allowed: set[str] | frozenset[str]) -> str:
    """Validate a qualified table name (schema.table) for SQL interpolation."""
    if qualified_name not in allowed:
        raise ValueError(f"Table {qualified_name!r} not in allowed set")
    parts = qualified_name.split(".")
    if len(parts) != 2 or not all(_SAFE_IDENT_RE.match(p) for p in parts):
        raise ValueError(f"Unsafe table name: {qualified_name!r}")
    return qualified_name

CHR_NAME_TO_ID = {f"chr{i}": i for i in range(1, 23)}
CHR_NAME_TO_ID.update({"chrX": 23, "chrY": 24, "chrM": 25})

CHR_ID_TO_NAME = {v: k for k, v in CHR_NAME_TO_ID.items()}
