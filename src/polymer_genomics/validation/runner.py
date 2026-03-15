"""Run validation checks against live database."""

from __future__ import annotations

from polymer_genomics.validation.framework import (
    ValidationResult,
    validate_row_count,
    validate_value_range,
    validate_null_fraction,
)
from polymer_genomics.validation.layer_specs import LAYER_VALIDATION_SPECS


async def run_layer_validation(
    conn,
    layer_key: str,
    build: str = "hg38",
) -> list[ValidationResult]:
    """Run all validation checks for a given layer."""
    spec = LAYER_VALIDATION_SPECS.get(layer_key)
    if spec is None:
        return [ValidationResult(layer_key, "spec_exists", False, "No validation spec defined")]

    results: list[ValidationResult] = []
    table = spec["table"]

    # Row count
    count = await conn.fetchval(
        f"SELECT count(*) FROM {table} WHERE build = $1::genome_build", build
    )
    results.append(validate_row_count(layer_key, count, spec["row_count_min"]))

    # Value ranges (sample 10K rows)
    for field, (vmin, vmax) in spec.get("value_ranges", {}).items():
        rows = await conn.fetch(
            f"SELECT {field} FROM {table} WHERE build = $1::genome_build AND {field} IS NOT NULL ORDER BY random() LIMIT 10000",
            build,
        )
        values = [float(r[0]) for r in rows]
        results.append(validate_value_range(f"{layer_key}.{field}", values, vmin, vmax))

    # Null fraction
    for field in spec.get("value_ranges", {}):
        null_count = await conn.fetchval(
            f"SELECT count(*) FROM {table} WHERE build = $1::genome_build AND {field} IS NULL",
            build,
        )
        results.append(validate_null_fraction(
            f"{layer_key}.{field}", null_count, count, spec.get("max_null_frac", 0.01),
        ))

    return results


async def run_all_validations(conn, build: str = "hg38") -> dict[str, list[ValidationResult]]:
    """Run validations for all layers with specs."""
    all_results: dict[str, list[ValidationResult]] = {}
    for layer_key in LAYER_VALIDATION_SPECS:
        all_results[layer_key] = await run_layer_validation(conn, layer_key, build)
    return all_results
