"""Tests for the ingestion framework (partitions + loader)."""

from __future__ import annotations

import asyncpg
import pytest

from polymer_genomics.ingest.loader import batch_load, compute_content_hash, update_layer_stats
from polymer_genomics.ingest.partitions import ensure_partitions

# ---------------------------------------------------------------------------
# Connection helpers
# ---------------------------------------------------------------------------

async def _admin_connect() -> asyncpg.Connection:
    """Connect as admin for setup/teardown."""
    return await asyncpg.connect(
        host="localhost",
        port=5432,
        database="polymer_genomics",
        user="admin",
        password="dev_password",
    )


async def _ingest_connect() -> asyncpg.Connection:
    """Connect as ingest_writer for loader tests."""
    return await asyncpg.connect(
        host="localhost",
        port=5432,
        database="polymer_genomics",
        user="ingest_writer",
        password="ingest_writer_dev",
    )


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
async def admin_conn():
    conn = await _admin_connect()
    yield conn
    await conn.close()


@pytest.fixture
async def ingest_conn():
    conn = await _ingest_connect()
    yield conn
    await conn.close()


@pytest.fixture
async def test_layer(admin_conn):
    """Create a disposable layer for testing, clean up after."""
    layer_id = await admin_conn.fetchval(
        """
        INSERT INTO registry.layers
            (layer_key, version, name, layer_type, genome_build,
             source, license_class, storage_type, is_active, is_default)
        VALUES
            ('test_ingest_layer', '1.0', 'Test Ingest Layer', 'cpg', 'hg38',
             'test', 'public_domain', 'postgres', true, false)
        RETURNING id
        """
    )
    yield layer_id
    # Teardown: remove any rows loaded with this layer, then the layer itself.
    await admin_conn.execute("DELETE FROM cpg.sites WHERE layer_id = $1", layer_id)
    await admin_conn.execute("DELETE FROM registry.layers WHERE id = $1", layer_id)


# ---------------------------------------------------------------------------
# Partition tests
# ---------------------------------------------------------------------------

class TestEnsurePartitions:
    """Tests for ensure_partitions."""

    async def test_verify_existing_partitions(self, admin_conn):
        """cpg.sites partitions were created by init.sql and should exist."""
        result = await ensure_partitions(
            admin_conn, "cpg", "sites", "hg38", [1, 16, 25]
        )
        assert result == {1: True, 16: True, 25: True}

    async def test_verify_all_chr_ids(self, admin_conn):
        """All 25 chromosomes should have cpg.sites partitions."""
        result = await ensure_partitions(
            admin_conn, "cpg", "sites", "hg38", list(range(1, 26))
        )
        assert all(v is True for v in result.values())
        assert len(result) == 25

    async def test_missing_partition_raises(self, admin_conn):
        """Should raise RuntimeError if partition is missing and create_if_missing=False."""
        # probe.coordinates is NOT sub-partitioned by chr, so requesting
        # a chr-level partition for it should fail.
        with pytest.raises(RuntimeError, match="does not exist"):
            await ensure_partitions(
                admin_conn, "probe", "coordinates", "hg38", [1]
            )

    async def test_invalid_schema_raises(self, admin_conn):
        with pytest.raises(ValueError, match="not in allowed list"):
            await ensure_partitions(admin_conn, "evil", "sites", "hg38", [1])

    async def test_invalid_table_raises(self, admin_conn):
        with pytest.raises(ValueError, match="not in allowed list"):
            await ensure_partitions(admin_conn, "cpg", "drop_table", "hg38", [1])

    async def test_invalid_build_raises(self, admin_conn):
        with pytest.raises(ValueError, match="not in allowed list"):
            await ensure_partitions(admin_conn, "cpg", "sites", "hg99", [1])

    async def test_invalid_chr_id_raises(self, admin_conn):
        with pytest.raises(ValueError, match="chr_id must be"):
            await ensure_partitions(admin_conn, "cpg", "sites", "hg38", [0])

    async def test_idempotent(self, admin_conn):
        """Calling ensure_partitions twice should be safe."""
        r1 = await ensure_partitions(admin_conn, "gene", "features", "hg38", [1, 2])
        r2 = await ensure_partitions(admin_conn, "gene", "features", "hg38", [1, 2])
        assert r1 == r2


# ---------------------------------------------------------------------------
# Loader tests
# ---------------------------------------------------------------------------

class TestBatchLoad:
    """Tests for batch_load using cpg.sites (partitions already exist)."""

    async def test_load_rows(self, ingest_conn, test_layer):
        """batch_load should insert rows and return the count."""
        rows = [
            (test_layer, "hg38", 1, 1000, "island", 0.65),
            (test_layer, "hg38", 1, 2000, "open_sea", 0.42),
            (test_layer, "hg38", 1, 3000, "n_shore", 0.55),
        ]
        columns = ["layer_id", "build", "chr_id", "pos", "context", "gc_content"]

        n = await batch_load(
            ingest_conn, "cpg", "sites", "hg38", 1, str(test_layer), rows, columns
        )
        assert n == 3

        # Verify rows landed in the database.
        count = await ingest_conn.fetchval(
            "SELECT count(*) FROM cpg.sites WHERE layer_id = $1", test_layer
        )
        assert count == 3

    async def test_load_empty(self, ingest_conn, test_layer):
        """Loading zero rows should return 0 without error."""
        n = await batch_load(
            ingest_conn, "cpg", "sites", "hg38", 1, str(test_layer), [], []
        )
        assert n == 0

    async def test_load_routes_to_partition(self, ingest_conn, test_layer):
        """Rows loaded for chr16 should be queryable from the chr16 partition."""
        rows = [
            (test_layer, "hg38", 16, 50000, "island", 0.60),
        ]
        columns = ["layer_id", "build", "chr_id", "pos", "context", "gc_content"]

        await batch_load(
            ingest_conn, "cpg", "sites", "hg38", 16, str(test_layer), rows, columns
        )

        # Query the sub-partition directly.
        count = await ingest_conn.fetchval(
            "SELECT count(*) FROM cpg.sites_hg38_chr16 WHERE layer_id = $1",
            test_layer,
        )
        assert count == 1


class TestComputeContentHash:
    """Tests for compute_content_hash."""

    async def test_hash_deterministic(self, ingest_conn, test_layer):
        """Same data should produce the same hash."""
        rows = [
            (test_layer, "hg38", 1, 10000, "island", 0.70),
            (test_layer, "hg38", 1, 10001, "island", 0.71),
        ]
        columns = ["layer_id", "build", "chr_id", "pos", "context", "gc_content"]
        await batch_load(
            ingest_conn, "cpg", "sites", "hg38", 1, str(test_layer), rows, columns
        )

        h1 = await compute_content_hash(ingest_conn, "cpg", "sites", str(test_layer))
        h2 = await compute_content_hash(ingest_conn, "cpg", "sites", str(test_layer))
        assert h1 == h2
        assert h1.startswith("sha256:")
        assert len(h1) == len("sha256:") + 64

    async def test_hash_empty(self, ingest_conn, test_layer):
        """Hash of zero rows should still be a valid sha256."""
        h = await compute_content_hash(ingest_conn, "cpg", "sites", str(test_layer))
        assert h.startswith("sha256:")
        # SHA-256 of empty input
        assert h == "sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"

    async def test_hash_changes_with_data(self, ingest_conn, test_layer):
        """Hash should change when different data is loaded."""
        h_empty = await compute_content_hash(
            ingest_conn, "cpg", "sites", str(test_layer)
        )

        rows = [(test_layer, "hg38", 1, 99999, "island", 0.50)]
        columns = ["layer_id", "build", "chr_id", "pos", "context", "gc_content"]
        await batch_load(
            ingest_conn, "cpg", "sites", "hg38", 1, str(test_layer), rows, columns
        )

        h_loaded = await compute_content_hash(
            ingest_conn, "cpg", "sites", str(test_layer)
        )
        assert h_empty != h_loaded


class TestUpdateLayerStats:
    """Tests for update_layer_stats."""

    async def test_updates_registry(self, ingest_conn, test_layer):
        """update_layer_stats should write row_count and content_hash."""
        await update_layer_stats(
            ingest_conn,
            test_layer,
            row_count=42,
            content_hash="sha256:abc123",
        )

        row = await ingest_conn.fetchrow(
            "SELECT row_count, content_hash FROM registry.layers WHERE id = $1",
            test_layer,
        )
        assert row["row_count"] == 42
        assert row["content_hash"] == "sha256:abc123"

    async def test_updates_timestamp(self, ingest_conn, test_layer):
        """updated_at should advance after update_layer_stats."""
        before = await ingest_conn.fetchval(
            "SELECT updated_at FROM registry.layers WHERE id = $1", test_layer
        )

        await update_layer_stats(
            ingest_conn,
            test_layer,
            row_count=10,
            content_hash="sha256:def456",
        )

        after = await ingest_conn.fetchval(
            "SELECT updated_at FROM registry.layers WHERE id = $1", test_layer
        )
        assert after >= before
