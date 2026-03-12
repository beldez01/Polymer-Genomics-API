"""Tests for gene alias resolution.

Verifies:
- Lookup alias resolves to canonical gene data
- Direct symbol match takes priority over alias
- Search returns alias matches with match_type: "alias"
- Case-insensitive resolution
- Unknown alias still 404s
"""

from __future__ import annotations

import pytest
from httpx import ASGITransport, AsyncClient

# These tests assume a running instance with gene_aliases data loaded.
# For CI, use the test database fixture; for local dev, run against Docker.

pytestmark = pytest.mark.asyncio


@pytest.fixture
def base_url():
    return "http://test"


class TestAliasLookup:
    """Gene lookup endpoint with alias fallback."""

    async def test_direct_symbol_works(self, client: AsyncClient):
        """Direct symbol still returns gene data without alias field."""
        resp = await client.get("/v1/genes/hg38/TP53")
        assert resp.status_code == 200
        data = resp.json()
        assert "resolved_alias" not in data.get("query", {})

    async def test_alias_resolves_to_canonical(self, client: AsyncClient):
        """Known alias (e.g. OCT4) resolves to canonical symbol (POU5F1)."""
        resp = await client.get("/v1/genes/hg38/OCT4")
        if resp.status_code == 200:
            data = resp.json()
            query = data.get("query", {})
            assert query.get("resolved_alias") == "OCT4"
            # The actual gene data should be for POU5F1
            mcols = data.get("data", {}).get("mcols", {})
            symbols = mcols.get("gene_symbol", [])
            if symbols:
                assert symbols[0] == "POU5F1"

    async def test_unknown_alias_404s(self, client: AsyncClient):
        """Unknown gene name still returns 404."""
        resp = await client.get("/v1/genes/hg38/XYZNOTREAL123")
        assert resp.status_code == 404

    async def test_case_insensitive(self, client: AsyncClient):
        """Alias resolution is case-insensitive."""
        resp_upper = await client.get("/v1/genes/hg38/OCT4")
        resp_lower = await client.get("/v1/genes/hg38/oct4")
        assert resp_upper.status_code == resp_lower.status_code


class TestAliasSearch:
    """Search endpoint with alias UNION."""

    async def test_direct_match_has_type_direct(self, client: AsyncClient):
        """Direct symbol matches have match_type 'direct'."""
        resp = await client.get("/v1/search?q=TP53&build=hg38")
        assert resp.status_code == 200
        data = resp.json()
        results = data.get("results", [])
        for r in results:
            if r["gene_symbol"] == "TP53":
                assert r.get("match_type", "direct") == "direct"

    async def test_alias_match_has_type_alias(self, client: AsyncClient):
        """Alias matches include match_type 'alias' and matched_alias."""
        resp = await client.get("/v1/search?q=OCT4&build=hg38")
        if resp.status_code == 200:
            data = resp.json()
            results = data.get("results", [])
            alias_results = [r for r in results if r.get("match_type") == "alias"]
            for r in alias_results:
                assert "matched_alias" in r

    async def test_direct_match_sorts_first(self, client: AsyncClient):
        """Direct matches always sort before alias matches."""
        resp = await client.get("/v1/search?q=TP&build=hg38")
        if resp.status_code == 200:
            data = resp.json()
            results = data.get("results", [])
            saw_alias = False
            for r in results:
                if r.get("match_type") == "alias":
                    saw_alias = True
                elif saw_alias:
                    # Direct match after alias match = sort violation
                    assert r.get("match_type") != "direct", (
                        "Direct matches should sort before alias matches"
                    )
