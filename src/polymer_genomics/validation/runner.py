"""Run validation checks against live database."""

from __future__ import annotations

import asyncpg

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

    # Check if the table exists before querying
    table_exists = await conn.fetchval(
        "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema || '.' || table_name = $1)",
        table,
    )
    if not table_exists:
        return [ValidationResult(layer_key, "table_exists", False, f"Table {table} does not exist")]

    # Check if build column exists (some tables use different partitioning)
    has_build_col = await conn.fetchval(
        """SELECT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema || '.' || table_name = $1
              AND column_name = 'build'
        )""",
        table,
    )

    try:
        # Row count
        if has_build_col:
            count = await conn.fetchval(
                f"SELECT count(*) FROM {table} WHERE build = $1::genome_build", build
            )
        else:
            count = await conn.fetchval(f"SELECT count(*) FROM {table}")
        results.append(validate_row_count(layer_key, count, spec["row_count_min"]))

        # Value ranges (sample 10K rows)
        for field, (vmin, vmax) in spec.get("value_ranges", {}).items():
            # Check column exists
            col_exists = await conn.fetchval(
                """SELECT EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_schema || '.' || table_name = $1
                      AND column_name = $2
                )""",
                table, field,
            )
            if not col_exists:
                results.append(ValidationResult(
                    f"{layer_key}.{field}", "column_exists", False,
                    f"Column {field} does not exist in {table}",
                ))
                continue

            # Use TABLESAMPLE for large tables to avoid full-table ORDER BY random()
            if has_build_col:
                rows = await conn.fetch(
                    f"SELECT {field} FROM {table} TABLESAMPLE SYSTEM (1) WHERE build = $1::genome_build AND {field} IS NOT NULL LIMIT 10000",
                    build,
                )
            else:
                rows = await conn.fetch(
                    f"SELECT {field} FROM {table} TABLESAMPLE SYSTEM (1) WHERE {field} IS NOT NULL LIMIT 10000",
                )
            values = [float(r[0]) for r in rows]
            results.append(validate_value_range(f"{layer_key}.{field}", values, vmin, vmax))

        # Null fraction
        for field in spec.get("value_ranges", {}):
            col_exists = await conn.fetchval(
                """SELECT EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_schema || '.' || table_name = $1
                      AND column_name = $2
                )""",
                table, field,
            )
            if not col_exists:
                continue  # already reported above

            if has_build_col:
                null_count = await conn.fetchval(
                    f"SELECT count(*) FROM {table} WHERE build = $1::genome_build AND {field} IS NULL",
                    build,
                )
            else:
                null_count = await conn.fetchval(
                    f"SELECT count(*) FROM {table} WHERE {field} IS NULL",
                )
            results.append(validate_null_fraction(
                f"{layer_key}.{field}", null_count, count, spec.get("max_null_frac", 0.01),
            ))

    except asyncpg.UndefinedTableError as e:
        results.append(ValidationResult(layer_key, "query", False, f"Table error: {e}"))
    except asyncpg.UndefinedColumnError as e:
        results.append(ValidationResult(layer_key, "query", False, f"Column error: {e}"))
    except Exception as e:
        results.append(ValidationResult(layer_key, "query", False, f"Unexpected error: {e}"))

    return results


async def run_all_validations(conn, build: str = "hg38") -> dict[str, list[ValidationResult]]:
    """Run validations for all layers with specs."""
    all_results: dict[str, list[ValidationResult]] = {}
    for layer_key in LAYER_VALIDATION_SPECS:
        all_results[layer_key] = await run_layer_validation(conn, layer_key, build)
    return all_results
