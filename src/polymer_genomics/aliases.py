"""Gene alias resolution helper.

Resolves common gene names/synonyms (e.g. OCT4, p53) to canonical
GENCODE symbols (POU5F1, TP53) via the gene.aliases table.
"""

from __future__ import annotations

import asyncpg


async def resolve_alias(conn: asyncpg.Connection, symbol: str) -> str | None:
    """Resolve a gene alias to its canonical symbol.

    Returns the canonical symbol if found, or None if no alias match exists.
    Queries the active gene_alias layer.
    """
    row = await conn.fetchrow(
        """
        SELECT a.canonical_symbol
        FROM gene.aliases a
        JOIN registry.active_layers l ON l.id = a.layer_id
        WHERE UPPER(a.alias) = UPPER($1)
          AND l.layer_type = 'gene_alias'
        LIMIT 1
        """,
        symbol,
    )
    return row["canonical_symbol"] if row else None
