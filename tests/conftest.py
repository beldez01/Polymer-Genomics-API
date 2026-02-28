import contextlib

import asyncpg
import pytest
from httpx import ASGITransport, AsyncClient

import polymer_genomics.db as db_module
from polymer_genomics.main import app


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def _admin_connect() -> asyncpg.Connection:
    """Connect as admin for test fixture setup/teardown."""
    return await asyncpg.connect(
        host="localhost",
        port=5432,
        database="polymer_genomics",
        user="admin",
        password="dev_password",
    )


async def _ingest_connect() -> asyncpg.Connection:
    """Connect as ingest_writer for ingestion tests."""
    return await asyncpg.connect(
        host="localhost",
        port=5432,
        database="polymer_genomics",
        user="ingest_writer",
        password="ingest_writer_dev",
    )


# ---------------------------------------------------------------------------
# Transactional pool wrapper — allows API code to use pool.acquire() while
# all operations stay in a single transaction that is rolled back at the end.
# ---------------------------------------------------------------------------


class _FakeAcquire:
    """Context manager returning the shared transactional connection."""

    def __init__(self, conn: asyncpg.Connection):
        self._conn = conn

    async def __aenter__(self) -> asyncpg.Connection:
        return self._conn

    async def __aexit__(self, *args):
        pass


class _RollbackPool:
    """Mimics asyncpg.Pool but always returns the same transactional connection."""

    def __init__(self, conn: asyncpg.Connection):
        self._conn = conn

    def acquire(self) -> _FakeAcquire:
        return _FakeAcquire(self._conn)

    async def close(self):
        pass  # Connection lifecycle managed externally.


# ---------------------------------------------------------------------------
# Core fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
async def _txn_conn():
    """Admin connection wrapped in a transaction that rolls back on teardown.

    Every INSERT/UPDATE made through this connection is automatically undone,
    so tests never mutate the real database.
    """
    conn = await _admin_connect()
    tx = conn.transaction()
    await tx.start()
    yield conn
    await tx.rollback()
    await conn.close()


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
async def client(_txn_conn):
    """HTTPX test client whose DB pool is the transactional connection.

    The FastAPI app sees the same connection (and uncommitted data) as the
    seed fixtures, giving full isolation without touching real data.
    """
    db_module._pool = _RollbackPool(_txn_conn)
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c
    db_module._pool = None


# ---------------------------------------------------------------------------
# Seed fixtures — all operate within the rollback transaction
# ---------------------------------------------------------------------------


@pytest.fixture
async def seed_layers(_txn_conn):
    """Insert test layers, temporarily deactivating real defaults if present.

    Within the transaction:
    1. Set is_default=false on any existing default layers that would conflict
       (restored when the transaction rolls back).
    2. Insert test layers with version '1.0' and is_default=true.
    """
    conn = _txn_conn

    # Deactivate real defaults that would conflict with one_default_per_key
    # or leak real data into test queries (e.g. probe lookups span all
    # active probe layers).
    await conn.execute("""
        UPDATE registry.layers SET is_default = false
        WHERE layer_key IN (
            'probe_epic_v2', 'probe_epic_v1', 'probe_450k',
            'cpg_sites', 'gencode_v44'
        ) AND is_default = true
    """)

    # Insert test layers (new UUIDs, isolated from real data).
    await conn.execute("""
        INSERT INTO registry.layers
            (layer_key, version, name, layer_type, genome_build,
             source, license_class, storage_type, row_count, is_active, is_default)
        VALUES
            ('probe_epic_v2', '1.0', 'EPIC v2 Probes', 'probe', 'hg38',
             'derived:Illumina', 'derived', 'postgres', 935000, true, true),
            ('cpg_sites', '1.0', 'CpG Sites', 'cpg', 'hg38',
             'computed', 'public_domain', 'postgres', 28300000, true, true),
            ('gencode_v44', '1.0', 'GENCODE v44', 'gene_model', 'hg38',
             'gencodegenes.org', 'public_domain', 'postgres', 2700000, true, true)
        ON CONFLICT (layer_key, version) DO NOTHING
    """)
    yield


@pytest.fixture
async def seed_genomic_data(_txn_conn, seed_layers):
    """Insert small CpG test dataset for region/tile/aggregation queries."""
    conn = _txn_conn
    cpg_layer = await conn.fetchval(
        "SELECT id FROM registry.layers WHERE layer_key = 'cpg_sites' AND is_default = true"
    )
    await conn.execute(
        """
        INSERT INTO cpg.sites (layer_id, build, chr_id, pos, context, gc_content)
        VALUES
            ($1, 'hg38', 16, 70699929, 'island', 0.62),
            ($1, 'hg38', 16, 70699940, 'island', 0.61),
            ($1, 'hg38', 16, 70699960, 'n_shore', 0.55)
        """,
        cpg_layer,
    )
    yield


@pytest.fixture
async def seed_gene_data(_txn_conn, seed_layers):
    """Insert test gene features on chr16 for gene endpoint tests."""
    conn = _txn_conn
    gene_layer = await conn.fetchval(
        "SELECT id FROM registry.layers WHERE layer_key = 'gencode_v44' AND is_default = true"
    )
    await conn.execute(
        """
        INSERT INTO gene.features
            (layer_id, build, chr_id, start_pos, end_pos, strand,
             gene_symbol, gene_id, transcript_id, feature_type)
        VALUES
            ($1, 'hg38', 16, 70699000, 70700000, '+',
             'VAC14', 'ENSG00000130164', 'ENST00000355500', 'exon'),
            ($1, 'hg38', 16, 70700000, 70705000, '+',
             'VAC14', 'ENSG00000130164', 'ENST00000355500', 'intron'),
            ($1, 'hg38', 16, 70705000, 70706000, '+',
             'VAC14', 'ENSG00000130164', 'ENST00000355500', 'exon')
        """,
        gene_layer,
    )
    yield


@pytest.fixture
async def seed_probe_data(_txn_conn, seed_layers):
    """Insert test probe coordinates and crossmap edges."""
    conn = _txn_conn
    probe_layer = await conn.fetchval(
        "SELECT id FROM registry.layers WHERE layer_key = 'probe_epic_v2' AND is_default = true"
    )
    await conn.execute(
        """
        INSERT INTO probe.coordinates
            (layer_id, probe_id, build, chr_id, pos, gene_symbol, cpg_context)
        VALUES
            ($1, 'cg08796240', 'hg38', 16, 70699929, 'VAC14', 'island'),
            ($1, 'cg14514483', 'hg38', 16, 70699940, 'VAC14', 'island'),
            ($1, 'cg27457201', 'hg38', 16, 70699960, 'VAC14', 'n_shore')
        """,
        probe_layer,
    )
    # Remove real crossmap edges for test probe IDs (rolled back with transaction)
    await conn.execute(
        """
        DELETE FROM probe.map_edges
        WHERE src_probe_id IN ('cg08796240', 'cg14514483', 'cg27457201')
           OR dst_probe_id IN ('cg08796240', 'cg14514483', 'cg27457201')
        """
    )
    await conn.execute(
        """
        INSERT INTO probe.map_edges
            (src_platform, src_probe_id, dst_platform, dst_probe_id,
             build, chr_id, pos, method, confidence)
        VALUES
            ('epic_v2', 'cg08796240', 'epic_v1', 'cg08796240',
             'hg38', 16, 70699929, 'exact_id', 1.0)
        """
    )
    yield
