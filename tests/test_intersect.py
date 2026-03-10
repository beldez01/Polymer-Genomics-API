"""Tests for cross-layer intersection endpoint (Task 13).

Unit tests for validation logic — no database required.
Integration tests require local Postgres.
"""

import pytest

from polymer_genomics.routers.intersect import (
    INTERSECT_TABLES,
    IntersectFilter,
    IntersectRequest,
    _build_subquery,
)


# ═══════════════════════════════════════════════════════════════════
# Unit tests — no DB required
# ═══════════════════════════════════════════════════════════════════


class TestIntersectValidation:
    """Request validation tests."""

    def test_valid_request(self):
        req = IntersectRequest(
            build="hg38",
            region="chr16:70699000-70702000",
            filters=[IntersectFilter(layer="biophysics", op="overlaps")],
        )
        assert req.build == "hg38"
        assert len(req.filters) == 1

    def test_empty_filters_rejected(self):
        with pytest.raises(Exception):
            IntersectRequest(
                build="hg38",
                region="chr16:70699000-70702000",
                filters=[],
            )

    def test_limit_max(self):
        req = IntersectRequest(
            build="hg38",
            region="chr16:1-1000",
            filters=[IntersectFilter(layer="biophysics", op="overlaps")],
            limit=10000,
        )
        assert req.limit == 10000

    def test_limit_exceeds_max(self):
        with pytest.raises(Exception):
            IntersectRequest(
                build="hg38",
                region="chr16:1-1000",
                filters=[IntersectFilter(layer="biophysics", op="overlaps")],
                limit=10001,
            )

    def test_too_many_filters_rejected(self):
        with pytest.raises(Exception):
            IntersectRequest(
                build="hg38",
                region="chr16:1-1000",
                filters=[IntersectFilter(layer="biophysics", op="overlaps")] * 11,
            )


class TestSubqueryBuilder:
    """Test SQL subquery construction."""

    def test_overlaps_filter(self):
        filt = IntersectFilter(layer="biophysics", op="overlaps")
        sql, params, next_idx = _build_subquery(filt, 1, "hg38", 16, 70699000, 70702000)
        assert "biophysics.sequence_properties" in sql
        assert "int4range" in sql
        assert len(params) == 4
        assert next_idx == 5

    def test_numeric_filter(self):
        filt = IntersectFilter(layer="biophysics", field="gc_content", op=">", value=0.6)
        sql, params, next_idx = _build_subquery(filt, 1, "hg38", 16, 70699000, 70702000)
        assert "gc_content >" in sql
        assert 0.6 in params

    def test_between_filter(self):
        filt = IntersectFilter(layer="conservation", field="phylop_mean", op="between", value=[0.5, 2.0])
        sql, params, next_idx = _build_subquery(filt, 1, "hg38", 16, 70699000, 70702000)
        assert "BETWEEN" in sql
        assert 0.5 in params
        assert 2.0 in params

    def test_invalid_layer_raises(self):
        from fastapi import HTTPException
        filt = IntersectFilter(layer="nonexistent", op="overlaps")
        with pytest.raises(HTTPException) as exc_info:
            _build_subquery(filt, 1, "hg38", 16, 1, 1000)
        assert exc_info.value.status_code == 400

    def test_invalid_field_raises(self):
        from fastapi import HTTPException
        filt = IntersectFilter(layer="biophysics", field="nonexistent", op=">", value=1.0)
        with pytest.raises(HTTPException) as exc_info:
            _build_subquery(filt, 1, "hg38", 16, 1, 1000)
        assert exc_info.value.status_code == 400

    def test_missing_field_for_comparison_raises(self):
        from fastapi import HTTPException
        filt = IntersectFilter(layer="biophysics", op=">", value=1.0)
        with pytest.raises(HTTPException) as exc_info:
            _build_subquery(filt, 1, "hg38", 16, 1, 1000)
        assert exc_info.value.status_code == 400


class TestIntersectTables:
    """Verify INTERSECT_TABLES registry."""

    def test_all_tables_have_required_keys(self):
        for key, info in INTERSECT_TABLES.items():
            assert "table" in info, f"{key} missing 'table'"
            assert "fields" in info, f"{key} missing 'fields'"

    def test_biophysics_has_expected_fields(self):
        assert "gc_content" in INTERSECT_TABLES["biophysics"]["fields"]
        assert "stacking_dg37" in INTERSECT_TABLES["biophysics"]["fields"]

    def test_conservation_has_expected_fields(self):
        assert "phylop_mean" in INTERSECT_TABLES["conservation"]["fields"]
