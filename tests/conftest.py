import asyncpg
import pytest
from httpx import ASGITransport, AsyncClient

from polymer_genomics.db import close_pool, init_pool
from polymer_genomics.main import app


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
async def client():
    await init_pool()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c
    await close_pool()


@pytest.fixture
async def seed_layers():
    """Insert test layers into the database using admin credentials."""
    conn = await _admin_connect()
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
    await conn.close()
    yield
    conn = await _admin_connect()
    await conn.execute(
        "DELETE FROM registry.layers WHERE layer_key IN ('probe_epic_v2', 'cpg_sites', 'gencode_v44')"
    )
    await conn.close()


@pytest.fixture
async def seed_genomic_data(seed_layers):
    """Insert small test dataset for region queries."""
    conn = await _admin_connect()
    cpg_layer = await conn.fetchval(
        "SELECT id FROM registry.layers WHERE layer_key = 'cpg_sites'"
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
    await conn.close()
    yield
    conn = await _admin_connect()
    await conn.execute("DELETE FROM cpg.sites WHERE chr_id = 16")
    await conn.close()


@pytest.fixture
async def seed_gene_data(seed_layers):
    """Insert test gene features on chr16 for gene endpoint tests."""
    conn = await _admin_connect()
    gene_layer = await conn.fetchval(
        "SELECT id FROM registry.layers WHERE layer_key = 'gencode_v44'"
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
    await conn.close()
    yield
    conn = await _admin_connect()
    await conn.execute("DELETE FROM gene.features WHERE chr_id = 16")
    await conn.close()


@pytest.fixture
async def seed_probe_data(seed_layers):
    """Insert test probe coordinates and crossmap edges."""
    conn = await _admin_connect()
    probe_layer = await conn.fetchval(
        "SELECT id FROM registry.layers WHERE layer_key = 'probe_epic_v2'"
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
    await conn.close()
    yield
    conn = await _admin_connect()
    await conn.execute("DELETE FROM probe.coordinates WHERE chr_id = 16")
    await conn.execute("DELETE FROM probe.map_edges WHERE chr_id = 16")
    await conn.close()
