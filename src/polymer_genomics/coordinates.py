"""Coordinate conversion: internal 0-based half-open <-> external 1-based closed."""

import re

_REGION_PATTERN = re.compile(r"^(chr[0-9XYM]+):(\d+)-(\d+)$")


def db_to_api(start: int, end: int) -> dict:
    """Convert internal [start, end) to API {start, end, width} (1-based closed)."""
    return {"start": start + 1, "end": end, "width": end - start}


def api_to_db(start: int, end: int, coords: str = "1based") -> dict:
    """Convert API query coordinates to internal [start, end)."""
    if coords == "0based":
        return {"start": start, "end": end}
    return {"start": start - 1, "end": end}


def parse_region(region: str) -> dict:
    """Parse 'chr16:70699930-70700000' -> {chr, start, end}."""
    m = _REGION_PATTERN.match(region)
    if not m:
        raise ValueError(f"Invalid region format: {region!r}. Expected 'chrN:start-end'.")
    return {"chr": m.group(1), "start": int(m.group(2)), "end": int(m.group(3))}
