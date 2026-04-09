"""Unit tests for the validation framework."""

from polymer_genomics.validation.framework import (
    validate_row_count,
    validate_value_range,
    validate_null_fraction,
)


def test_row_count_pass():
    r = validate_row_count("biophysics", actual=2937992, expected_min=2900000)
    assert r.passed is True


def test_row_count_fail():
    r = validate_row_count("biophysics", actual=100, expected_min=2900000)
    assert r.passed is False


def test_value_range_pass():
    r = validate_value_range("gc_content", values=[0.3, 0.5, 0.7], expected_min=0.0, expected_max=1.0)
    assert r.passed is True


def test_value_range_fail():
    r = validate_value_range("gc_content", values=[0.3, 1.5, 0.7], expected_min=0.0, expected_max=1.0)
    assert r.passed is False


def test_null_fraction_pass():
    r = validate_null_fraction("stacking_dg37", null_count=100, total=2937992, max_null_frac=0.01)
    assert r.passed is True


def test_null_fraction_fail():
    r = validate_null_fraction("stacking_dg37", null_count=100000, total=2937992, max_null_frac=0.01)
    assert r.passed is False


def test_result_has_expected_fields():
    r = validate_row_count("test_layer", actual=500, expected_min=100)
    assert r.layer_key == "test_layer"
    assert r.check_name == "row_count"
    assert r.actual == 500
    assert r.expected == ">= 100"
