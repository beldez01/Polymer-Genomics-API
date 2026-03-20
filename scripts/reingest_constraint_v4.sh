#!/usr/bin/env bash
# Re-ingest gene constraint data from gnomAD v4.1
#
# Prerequisites:
#   - Docker Postgres running: docker compose up -d postgres
#   - gnomAD v4.1 file: data/gnomad/gnomad.v4.1.constraint_metrics.tsv
#
# This script:
#   1. Deletes old constraint data from the local DB
#   2. Re-ingests from gnomAD v4.1 with MANE Select filtering
#   3. Verifies key genes have correct transcripts
#
# After running locally, push to Fly.io:
#   1. pg_dump the constraint table
#   2. Upload via fly proxy or sftp + on-machine psql

set -euo pipefail

cd "$(dirname "$0")/.."

echo "=== Re-ingesting gene constraint from gnomAD v4.1 ==="

PYTHONPATH=src .venv/bin/python3 -u -c "
import asyncio, asyncpg

async def reingest():
    conn = await asyncpg.connect(host='localhost', port=5432, database='polymer_genomics',
                                  user='admin', password='dev_password', command_timeout=300)

    # 1. Delete old data
    layer_id = await conn.fetchval(
        \"SELECT id FROM registry.layers WHERE layer_key = 'gene_constraint_v1' AND is_default = true\"
    )
    if layer_id:
        deleted = await conn.execute(
            'DELETE FROM conservation.gene_constraint WHERE layer_id = \$1', layer_id
        )
        print(f'Deleted old data: {deleted}')
        await conn.execute('DELETE FROM registry.layers WHERE id = \$1', layer_id)
        print('Deleted old layer registration')

    # 2. Re-ingest
    from polymer_genomics.ingest.gene_constraint import ingest_build, register_layer
    layer_id = await register_layer(conn, 'hg38')
    total = await ingest_build(conn, 'hg38', layer_id,
                                'data/gnomad/gnomad.v4.1.constraint_metrics.tsv')
    print(f'Ingested {total:,} genes')

    # Update row count
    await conn.execute('UPDATE registry.layers SET row_count = \$1 WHERE id = \$2', total, layer_id)

    # 3. Verify
    for gene in ['TP53', 'BRCA1', 'BRCA2', 'KRAS', 'MYC', 'SCN1A']:
        row = await conn.fetchrow(
            'SELECT transcript, pli, loeuf, exp_lof FROM conservation.gene_constraint '
            'WHERE gene_symbol = \$1 AND build = \$2::genome_build ORDER BY exp_lof DESC LIMIT 1',
            gene, 'hg38'
        )
        if row:
            print(f'  {gene}: tx={row[\"transcript\"]}, pLI={row[\"pli\"]:.3f}, LOEUF={row[\"loeuf\"]:.3f}')

    await conn.close()
    print('Done!')

asyncio.run(reingest())
"
