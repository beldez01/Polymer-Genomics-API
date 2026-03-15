"""Core validation framework for data layer integrity checks."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass
class ValidationResult:
    layer_key: str
    check_name: str
    passed: bool
    message: str
    actual: float | int | None = None
    expected: str | None = None


def validate_row_count(
    layer_key: str, actual: int, expected_min: int
) -> ValidationResult:
    passed = actual >= expected_min
    return ValidationResult(
        layer_key=layer_key,
        check_name="row_count",
        passed=passed,
        message=f"Row count {actual:,} {'≥' if passed else '<'} minimum {expected_min:,}",
        actual=actual,
        expected=f">= {expected_min:,}",
    )


def validate_value_range(
    field: str,
    values: list[float],
    expected_min: float,
    expected_max: float,
) -> ValidationResult:
    out_of_range = [v for v in values if v < expected_min or v > expected_max]
    passed = len(out_of_range) == 0
    return ValidationResult(
        layer_key=field,
        check_name="value_range",
        passed=passed,
        message=f"{len(out_of_range)} values outside [{expected_min}, {expected_max}]",
        actual=len(out_of_range),
        expected=f"[{expected_min}, {expected_max}]",
    )


def validate_null_fraction(
    field: str,
    null_count: int,
    total: int,
    max_null_frac: float,
) -> ValidationResult:
    frac = null_count / total if total > 0 else 0
    passed = frac <= max_null_frac
    return ValidationResult(
        layer_key=field,
        check_name="null_fraction",
        passed=passed,
        message=f"Null fraction {frac:.4f} {'≤' if passed else '>'} {max_null_frac}",
        actual=frac,
        expected=f"<= {max_null_frac}",
    )
