"""Tests for the chromosome lengths seeder.

These tests run against the live database (Docker Compose postgres).
"""

from __future__ import annotations

import os

import asyncpg
import pytest

from polymer_genomics.ingest.seed_chromosomes import (
    EXPECTED_CHROMOSOMES,
    HG37_LENGTHS,
    HG38_LENGTHS,
    seed_chromosomes,
)


@pytest.fixture
async def admin_conn():
    """Provide an asyncpg connection wrapped in a transaction that rolls back."""
    conn = await asyncpg.connect(
        host=os.environ.get("POSTGRES_HOST", "localhost"),
        port=int(os.environ.get("POSTGRES_PORT", "5432")),
        database=os.environ.get("POSTGRES_DB", "polymer_genomics"),
        user=os.environ.get("POSTGRES_ADMIN_USER", "admin"),
        password=os.environ.get("POSTGRES_PASSWORD", "dev_password"),
    )
    tr = conn.transaction()
    await tr.start()
    yield conn
    await tr.rollback()
    await conn.close()


async def test_data_dicts_have_25_entries():
    """Both length dicts must cover exactly 25 chromosomes."""
    assert len(HG38_LENGTHS) == EXPECTED_CHROMOSOMES
    assert len(HG37_LENGTHS) == EXPECTED_CHROMOSOMES
    assert set(HG38_LENGTHS.keys()) == set(HG37_LENGTHS.keys())


async def test_data_dicts_keys_match_expected():
    """Keys must be chr1-chr22, chrX, chrY, chrM."""
    expected = {f"chr{i}" for i in range(1, 23)} | {"chrX", "chrY", "chrM"}
    assert set(HG38_LENGTHS.keys()) == expected
    assert set(HG37_LENGTHS.keys()) == expected


async def test_all_lengths_positive():
    """All chromosome lengths must be positive integers."""
    for name, length in HG38_LENGTHS.items():
        assert isinstance(length, int), f"{name} hg38 length not int"
        assert length > 0, f"{name} hg38 length not positive"
    for name, length in HG37_LENGTHS.items():
        assert isinstance(length, int), f"{name} hg37 length not int"
        assert length > 0, f"{name} hg37 length not positive"


async def test_seed_updates_all_rows(admin_conn: asyncpg.Connection):
    """seed_chromosomes should update all 25 rows."""
    updated = await seed_chromosomes(admin_conn)
    assert updated == EXPECTED_CHROMOSOMES


async def test_seed_sets_correct_lengths(admin_conn: asyncpg.Connection):
    """After seeding, chr1 lengths should match the known UCSC values."""
    await seed_chromosomes(admin_conn)

    row = await admin_conn.fetchrow(
        "SELECT length_hg37, length_hg38 FROM ref.chromosomes WHERE chr_name = 'chr1'"
    )
    assert row is not None
    assert row["length_hg38"] == 248956422
    assert row["length_hg37"] == 249250621


async def test_seed_chrm_lengths(admin_conn: asyncpg.Connection):
    """chrM should have the smallest lengths (mitochondrial genome)."""
    await seed_chromosomes(admin_conn)

    row = await admin_conn.fetchrow(
        "SELECT length_hg37, length_hg38 FROM ref.chromosomes WHERE chr_name = 'chrM'"
    )
    assert row is not None
    assert row["length_hg38"] == 16569
    assert row["length_hg37"] == 16571


async def test_no_nulls_after_seed(admin_conn: asyncpg.Connection):
    """After seeding, no length columns should be NULL."""
    await seed_chromosomes(admin_conn)

    null_count = await admin_conn.fetchval(
        "SELECT count(*) FROM ref.chromosomes "
        "WHERE length_hg37 IS NULL OR length_hg38 IS NULL"
    )
    assert null_count == 0


async def test_seed_is_idempotent(admin_conn: asyncpg.Connection):
    """Running seed_chromosomes twice should not error and should return 25 both times."""
    first = await seed_chromosomes(admin_conn)
    second = await seed_chromosomes(admin_conn)
    assert first == EXPECTED_CHROMOSOMES
    assert second == EXPECTED_CHROMOSOMES

    # Values should be identical after the second run
    row = await admin_conn.fetchrow(
        "SELECT length_hg37, length_hg38 FROM ref.chromosomes WHERE chr_name = 'chr1'"
    )
    assert row["length_hg38"] == 248956422
    assert row["length_hg37"] == 249250621
