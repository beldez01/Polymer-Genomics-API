"""Run validation checks against live database."""

from __future__ import annotations

import asyncio

import asyncpg

from polymer_genomics.validation.framework import (
    ValidationResult,
    validate_row_count,
    validate_value_range,
    validate_null_fraction,
)
from polymer_genomics.validation.layer_specs import LAYER_VALIDATION_SPECS


async def run_layer_validation(
    pool,
    layer_key: str,
    build: str = "hg38",
) -> list[ValidationResult]:
    """Run all validation checks for a given layer."""
    spec = LAYER_VALIDATION_SPECS.get(layer_key)
    if spec is None:
        return [ValidationResult(layer_key, "spec_exists", False, "No validation spec defined")]

    results: list[ValidationResult] = []
    table = spec["table"]

    async with pool.acquire() as conn:
        # Use registry row_count instead of full count(*)
        reg_row = await conn.fetchrow(
            "SELECT row_count FROM registry.layers "
            "WHERE layer_key = $1 AND genome_build = $2 AND is_active = true LIMIT 1",
            layer_key, build,
        )
        count = reg_row["row_count"] if reg_row and reg_row["row_count"] else 0
        if count == 0:
            # Fallback: fast estimate from pg_stat
            schema, tbl = table.split(".", 1)
            est = await conn.fetchval(
                "SELECT n_live_tup FROM pg_stat_user_tables WHERE schemaname = $1 AND relname = $2",
                schema, tbl,
            )
            count = est or 0
        results.append(validate_row_count(layer_key, count, spec["row_count_min"]))

        # Resolve layer_id for build-specific sampling
        layer_row = await conn.fetchrow(
            "SELECT id FROM registry.layers "
            "WHERE layer_key = $1 AND genome_build = $2 AND is_active = true LIMIT 1",
            layer_key, build,
        )
        layer_id = layer_row["id"] if layer_row else None

        try:
            # Value ranges + null fraction in one pass per field
            for field, (vmin, vmax) in spec.get("value_ranges", {}).items():
                build_filter = f"WHERE build = '{build}'" if layer_id is None else f"WHERE build = '{build}' AND layer_id = '{layer_id}'"
                try:
                    rows = await conn.fetch(
                        f"SELECT {field} FROM {table} TABLESAMPLE SYSTEM (1) {build_filter} AND {field} IS NOT NULL LIMIT 10000",
                    )
                    values = [float(r[0]) for r in rows]
                    results.append(validate_value_range(f"{layer_key}.{field}", values, vmin, vmax))

                    # Null fraction from sample estimate instead of full count
                    sample = await conn.fetchrow(
                        f"SELECT count(*) AS total, count({field}) AS non_null "
                        f"FROM {table} TABLESAMPLE SYSTEM (1) {build_filter} LIMIT 50000",
                    )
                    if sample and sample["total"] > 0:
                        null_count = sample["total"] - sample["non_null"]
                        results.append(validate_null_fraction(
                            f"{layer_key}.{field}", null_count, sample["total"],
                            spec.get("max_null_frac", 0.01),
                        ))
                except (asyncpg.UndefinedColumnError, asyncpg.UndefinedTableError):
                    results.append(ValidationResult(
                        f"{layer_key}.{field}", "column_exists", False,
                        f"Column {field} does not exist in {table}",
                    ))
        except Exception as e:
            results.append(ValidationResult(layer_key, "query", False, f"Error: {e}"))

    return results


async def run_all_validations(pool, build: str = "hg38") -> dict[str, list[ValidationResult]]:
    """Run validations for all layers with specs (parallel)."""
    async def _validate(key):
        return key, await run_layer_validation(pool, key, build)

    results = await asyncio.gather(*[_validate(k) for k in LAYER_VALIDATION_SPECS])
    return {k: v for k, v in results}
