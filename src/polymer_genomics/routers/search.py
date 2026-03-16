import time

from fastapi import APIRouter, HTTPException, Query

from polymer_genomics.constants import CHR_ID_TO_NAME, VALID_BUILDS
from polymer_genomics.db import get_pool

router = APIRouter(prefix="/v1/search", tags=["search"])


@router.get("")
async def search(
    q: str = Query(..., min_length=1),
    build: str = Query(...),
):
    if build not in VALID_BUILDS:
        raise HTTPException(
            400,
            {"error": {"code": "BUILD_MISMATCH", "message": f"Invalid build: {build}"}},
        )

    if len(q) < 2:
        raise HTTPException(
            400,
            {"error": {"code": "QUERY_TOO_SHORT", "message": "Search query must be at least 2 characters"}},
        )

    # Escape LIKE metacharacters in user input and uppercase for btree index use
    safe_q = q.replace("%", "\\%").replace("_", "\\_").upper()

    pool = await get_pool()
    async with pool.acquire() as conn:
        # Resolve gene_model layer
        layer = await conn.fetchrow(
            "SELECT id FROM registry.active_layers "
            "WHERE layer_type = 'gene_model' AND genome_build = $1::genome_build",
            build,
        )
        if not layer:
            return {"results": [], "total": 0}

        # Direct symbol matches — use LIKE (case-sensitive) for btree index
        direct_rows = await conn.fetch(
            """
            SELECT gene_symbol, MIN(chr_id) AS chr_id, (gene_symbol = $4) AS exact_match
            FROM (
                SELECT DISTINCT gene_symbol, chr_id
                FROM gene.features
                WHERE build = $1::genome_build
                  AND gene_symbol LIKE $2
                  AND layer_id = $3
            ) sub
            GROUP BY gene_symbol
            ORDER BY exact_match DESC, gene_symbol
            LIMIT 20
            """,
            build,
            safe_q + "%",
            layer["id"],
            q.upper(),
        )

        # Alias matches — search aliases and join to gene.features for chr info
        alias_rows = await conn.fetch(
            """
            SELECT a.canonical_symbol AS gene_symbol,
                   a.alias AS matched_alias,
                   MIN(f.chr_id) AS chr_id
            FROM gene.aliases a
            JOIN registry.active_layers al ON al.id = a.layer_id AND al.layer_type = 'gene_alias'
            LEFT JOIN gene.features f
                ON f.build = $1::genome_build
                AND f.gene_symbol = a.canonical_symbol
                AND f.layer_id = $3
            WHERE a.alias LIKE $2
            GROUP BY a.canonical_symbol, a.alias
            ORDER BY (a.alias = $4) DESC, a.canonical_symbol
            LIMIT 20
            """,
            build,
            safe_q + "%",
            layer["id"],
            q.upper(),
        )

    # Build results: direct matches first, then alias matches (deduplicated)
    direct_symbols = {r["gene_symbol"] for r in direct_rows}

    results = [
        {
            "gene_symbol": r["gene_symbol"],
            "chromosome": CHR_ID_TO_NAME.get(r["chr_id"], f"chr{r['chr_id']}") if r["chr_id"] is not None else None,
            "type": "gene",
            "match_type": "direct",
        }
        for r in direct_rows
    ]

    seen_symbols = set(direct_symbols)
    for r in alias_rows:
        sym = r["gene_symbol"]
        # Skip alias matches whose canonical symbol already appears as a direct match
        if sym in seen_symbols:
            continue
        seen_symbols.add(sym)
        results.append({
            "gene_symbol": sym,
            "chromosome": CHR_ID_TO_NAME.get(r["chr_id"], f"chr{r['chr_id']}") if r["chr_id"] is not None else None,
            "type": "gene",
            "match_type": "alias",
            "matched_alias": r["matched_alias"],
        })

    # Cap at 20 total results
    results = results[:20]

    return {"results": results, "total": len(results)}
