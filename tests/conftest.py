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
            'cpg_sites', 'gencode_v44', 'gtex_v10', 'encode_ccre_v4',
            'phylop_phastcons_100way'
        ) AND is_default = true
    """)

    # Insert test layers (new UUIDs, isolated from real data).
    await conn.execute("""
        INSERT INTO registry.layers
            (layer_key, version, name, layer_type, genome_build,
             source, license_class, storage_type, row_count, is_active, is_default,
             evidence_class, tier, equilibrium_regime, statefulness,
             validation_status, interpretability, is_composite)
        VALUES
            ('probe_epic_v2', '1.0', 'EPIC v2 Probes', 'probe', 'hg38',
             'derived:Illumina', 'derived', 'postgres', 935000, true, true,
             'D', 'intrinsic', 'equilibrium', 'reference_static',
             'internally_validated', 'direct', false),
            ('cpg_sites', '1.0', 'CpG Sites', 'cpg', 'hg38',
             'computed', 'public_domain', 'postgres', 28300000, true, true,
             'D', 'intrinsic', 'equilibrium', 'reference_static',
             'externally_benchmarked', 'direct', false),
            ('gencode_v44', '1.0', 'GENCODE v44', 'gene_model', 'hg38',
             'gencodegenes.org', 'public_domain', 'postgres', 2700000, true, true,
             'K', 'intrinsic', 'equilibrium', 'reference_static',
             'externally_benchmarked', 'direct', true),
            ('gtex_v10', '1.0', 'GTEx v10 Expression', 'expression', 'hg38',
             'GTEx v10', 'public_domain', 'postgres', 56000, true, true,
             'M', 'active', 'non_equilibrium', 'reference_static',
             'externally_validated', 'direct', false),
            ('encode_ccre_v4', '1.0', 'ENCODE cCREs V4', 'regulatory', 'hg38',
             'ENCODE SCREEN V4', 'public_domain', 'postgres', 926535, true, true,
             'S', 'active', 'non_equilibrium', 'reference_static',
             'externally_validated', 'semi_interpretable', true),
            ('phylop_phastcons_100way', '1.0', 'PhyloP+PhastCons 100-way', 'conservation', 'hg38',
             'UCSC 100-way', 'public_domain', 'postgres', 3100000, true, true,
             'S', 'intrinsic', 'equilibrium', 'reference_static',
             'externally_benchmarked', 'semi_interpretable', false)
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


@pytest.fixture
async def seed_expression_data(_txn_conn, seed_layers):
    """Insert test gene expression data on chr16 and chr17 for expression endpoint tests."""
    conn = _txn_conn
    expr_layer = await conn.fetchval(
        "SELECT id FROM registry.layers WHERE layer_key = 'gtex_v10' AND is_default = true"
    )
    # VAC14 on chr16 — moderately expressed, highest in kidney
    await conn.execute(
        """
        INSERT INTO expression.gene_tpm
            (layer_id, build, chr_id, start_pos, end_pos, strand,
             gene_symbol, gene_id,
             median_tpm, max_tpm, max_tissue, n_tissues_detected,
             tpm_kidney_cortex, tpm_liver, tpm_whole_blood, tpm_brain_cortex)
        VALUES
            ($1, 'hg38', 16, 70699000, 70706000, '+',
             'VAC14', 'ENSG00000130164',
             8.5, 42.3, 'kidney_cortex', 48,
             42.3, 15.2, 8.5, 3.1)
        """,
        expr_layer,
    )
    # TP53 on chr17 — ubiquitously expressed
    await conn.execute(
        """
        INSERT INTO expression.gene_tpm
            (layer_id, build, chr_id, start_pos, end_pos, strand,
             gene_symbol, gene_id,
             median_tpm, max_tpm, max_tissue, n_tissues_detected,
             tpm_kidney_cortex, tpm_liver, tpm_whole_blood, tpm_brain_cortex)
        VALUES
            ($1, 'hg38', 17, 7668402, 7687550, '-',
             'TP53', 'ENSG00000141510',
             12.1, 35.8, 'liver', 54,
             22.0, 35.8, 18.3, 9.7)
        """,
        expr_layer,
    )
    yield


@pytest.fixture
async def seed_regulatory_data(_txn_conn, seed_layers):
    """Insert test cCRE records on chr16 for regulatory endpoint tests."""
    conn = _txn_conn
    reg_layer = await conn.fetchval(
        "SELECT id FROM registry.layers WHERE layer_key = 'encode_ccre_v4' AND is_default = true"
    )
    await conn.execute(
        """
        INSERT INTO regulatory.ccre
            (layer_id, build, chr_id, start_pos, end_pos,
             accession, score, encode_label, ccre_class, z_score, description)
        VALUES
            ($1, 'hg38', 16, 70699500, 70699800, 'EH38E0000001', 488, 'pELS',
             'pELS,CTCF-bound', 4.88, 'EH38E0000001 proximal enhancer-like signature'),
            ($1, 'hg38', 16, 70700100, 70700350, 'EH38E0000002', 759, 'PLS',
             'PLS,CTCF-bound', 7.60, 'EH38E0000002 promoter-like signature'),
            ($1, 'hg38', 16, 70702000, 70702200, 'EH38E0000003', 179, 'dELS',
             'dELS', 1.79, 'EH38E0000003 distal enhancer-like signature')
        """,
        reg_layer,
    )
    yield


@pytest.fixture
async def seed_conservation_data(_txn_conn, seed_layers):
    """Insert test conservation scores (1kb bins) on chr16."""
    conn = _txn_conn
    cons_layer = await conn.fetchval(
        "SELECT id FROM registry.layers WHERE layer_key = 'phylop_phastcons_100way' AND is_default = true"
    )
    await conn.execute(
        """
        INSERT INTO conservation.scores
            (layer_id, build, chr_id, start_pos, end_pos,
             phylop_mean, phylop_max, phastcons_mean, phastcons_max)
        VALUES
            ($1, 'hg38', 16, 70699000, 70700000, 0.85, 4.21, 0.42, 0.99),
            ($1, 'hg38', 16, 70700000, 70701000, 1.23, 6.78, 0.61, 1.00),
            ($1, 'hg38', 16, 70701000, 70702000, -0.15, 2.10, 0.18, 0.75)
        """,
        cons_layer,
    )
    yield
