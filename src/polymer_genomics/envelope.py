"""Uniform response envelope for all data endpoints."""

import time
from typing import Any


def build_envelope(
    *,
    status: str,
    query: dict,
    layers_resolved: list[dict],
    data: Any,
    pagination: dict | None = None,
    db_time_ms: float | None = None,
    _start_time: float | None = None,
) -> dict:
    query_time_ms = round((time.monotonic() - _start_time) * 1000, 1) if _start_time else 0
    envelope = {
        "status": status,
        "coordinate_system": "1-based_closed",
        "query": query,
        "layers_resolved": layers_resolved,
        "data": data,
        "timing": {
            "query_time_ms": query_time_ms,
            "db_time_ms": db_time_ms or 0,
        },
    }
    if pagination:
        envelope["pagination"] = pagination
    return envelope
