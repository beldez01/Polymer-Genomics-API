import pytest
from httpx import ASGITransport, AsyncClient

from polymer_genomics.db import close_pool, init_pool
from polymer_genomics.main import app


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
    import asyncpg

    conn = await asyncpg.connect(
        host="localhost",
        port=5432,
        database="polymer_genomics",
        user="admin",
        password="dev_password",
    )
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
    conn = await asyncpg.connect(
        host="localhost",
        port=5432,
        database="polymer_genomics",
        user="admin",
        password="dev_password",
    )
    await conn.execute(
        "DELETE FROM registry.layers WHERE layer_key IN ('probe_epic_v2', 'cpg_sites', 'gencode_v44')"
    )
    await conn.close()
