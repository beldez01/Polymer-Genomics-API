"""Tests for probe manifest ingestion (parsing, cross-mapping, context classification).

Pure unit tests -- no database connections, no downloads, no real genomic data.
"""

from __future__ import annotations

from pathlib import Path

from polymer_genomics.ingest.probes import (
    BATCH_SIZE,
    BUILDS,
    COLUMNS_MAP_EDGES,
    COLUMNS_PROBES,
    GENE_WINDOW_BP,
    LAYER_KEY_PREFIX,
    PLATFORMS,
    SHELF_DISTANCE,
    SHORE_DISTANCE,
    _classify_context_from_island,
    cross_map_probes,
    filter_by_platform,
    parse_manifest_csv,
)


# ── Sample CSV Data ──────────────────────────────────────────────────────────

SAMPLE_CSV = """\
probe_id,chr,pos,strand,platform
cg00000029,chr16,53434200,+,epic_v2
cg00000108,chr3,37459207,-,epic_v2
cg00000109,chr3,37459210,+,epic_v1
cg00000029,chr16,53434200,+,epic_v1
cg00000236,chr8,42263294,+,450k
cg00000029,chr16,53434200,+,450k
"""

CSV_WITH_BAD_ROWS = """\
probe_id,chr,pos,strand,platform
cg00000001,chr1,100000,+,epic_v2
cg00000002,chrUn_random,200000,+,epic_v2
cg00000003,chr2,300000,-,invalid_platform
cg00000004,chrX,400000,+,epic_v1
cg00000005,chrY,500000,-,450k
"""

CSV_MINIMAL = """\
probe_id,chr,pos,strand,platform
cg00000001,chr1,100,+,epic_v2
"""


# ── Tests: parse_manifest_csv ────────────────────────────────────────────────


class TestParseManifestCsv:
    """Tests for CSV manifest parsing."""

    def test_basic_parsing(self, tmp_path: Path):
        """Parse a small CSV with known probes across platforms."""
        csv_file = tmp_path / "manifest.csv"
        csv_file.write_text(SAMPLE_CSV)

        records = parse_manifest_csv(csv_file)
        assert len(records) == 6  # 6 valid rows

        # Check first record.
        r0 = records[0]
        assert r0["probe_id"] == "cg00000029"
        assert r0["chr"] == "chr16"
        assert r0["chr_id"] == 16
        assert r0["pos"] == 53434200
        assert r0["strand"] == "+"
        assert r0["platform"] == "epic_v2"

    def test_filters_bad_chromosomes(self, tmp_path: Path):
        """Rows with unrecognised chromosomes should be skipped."""
        csv_file = tmp_path / "manifest.csv"
        csv_file.write_text(CSV_WITH_BAD_ROWS)

        records = parse_manifest_csv(csv_file)
        # Only chr1, chrX, chrY should survive.
        assert len(records) == 3
        chr_names = {r["chr"] for r in records}
        assert "chrUn_random" not in chr_names

    def test_filters_bad_platforms(self, tmp_path: Path):
        """Rows with unrecognised platforms should be skipped."""
        csv_file = tmp_path / "manifest.csv"
        csv_file.write_text(CSV_WITH_BAD_ROWS)

        records = parse_manifest_csv(csv_file)
        platforms = {r["platform"] for r in records}
        assert "invalid_platform" not in platforms

    def test_chr_id_mapping(self, tmp_path: Path):
        """Verify chromosome name to ID mapping."""
        csv_file = tmp_path / "manifest.csv"
        csv_file.write_text(CSV_WITH_BAD_ROWS)

        records = parse_manifest_csv(csv_file)
        id_map = {r["chr"]: r["chr_id"] for r in records}
        assert id_map["chr1"] == 1
        assert id_map["chrX"] == 23
        assert id_map["chrY"] == 24

    def test_minimal_csv(self, tmp_path: Path):
        """Single-row CSV should parse correctly."""
        csv_file = tmp_path / "manifest.csv"
        csv_file.write_text(CSV_MINIMAL)

        records = parse_manifest_csv(csv_file)
        assert len(records) == 1
        assert records[0]["probe_id"] == "cg00000001"
        assert records[0]["pos"] == 100

    def test_empty_csv(self, tmp_path: Path):
        """CSV with only headers should return empty list."""
        csv_file = tmp_path / "manifest.csv"
        csv_file.write_text("probe_id,chr,pos,strand,platform\n")

        records = parse_manifest_csv(csv_file)
        assert records == []

    def test_whitespace_handling(self, tmp_path: Path):
        """Leading/trailing whitespace in fields should be stripped."""
        csv_content = "probe_id,chr,pos,strand,platform\n cg00000001 , chr1 , 100 , + , epic_v2 \n"
        csv_file = tmp_path / "manifest.csv"
        csv_file.write_text(csv_content)

        records = parse_manifest_csv(csv_file)
        assert len(records) == 1
        assert records[0]["probe_id"] == "cg00000001"
        assert records[0]["chr"] == "chr1"
        assert records[0]["pos"] == 100
        assert records[0]["platform"] == "epic_v2"

    def test_all_platforms_accepted(self, tmp_path: Path):
        """All three valid platforms should be accepted."""
        csv_file = tmp_path / "manifest.csv"
        csv_file.write_text(SAMPLE_CSV)

        records = parse_manifest_csv(csv_file)
        platforms = {r["platform"] for r in records}
        assert platforms == {"epic_v2", "epic_v1", "450k"}


# ── Tests: filter_by_platform ────────────────────────────────────────────────


class TestFilterByPlatform:
    """Tests for platform filtering of parsed records."""

    def test_filter_epic_v2(self, tmp_path: Path):
        csv_file = tmp_path / "manifest.csv"
        csv_file.write_text(SAMPLE_CSV)
        records = parse_manifest_csv(csv_file)

        epic_v2 = filter_by_platform(records, "epic_v2")
        assert all(r["platform"] == "epic_v2" for r in epic_v2)
        assert len(epic_v2) == 2

    def test_filter_450k(self, tmp_path: Path):
        csv_file = tmp_path / "manifest.csv"
        csv_file.write_text(SAMPLE_CSV)
        records = parse_manifest_csv(csv_file)

        k450 = filter_by_platform(records, "450k")
        assert all(r["platform"] == "450k" for r in k450)
        assert len(k450) == 2

    def test_filter_nonexistent_platform(self, tmp_path: Path):
        csv_file = tmp_path / "manifest.csv"
        csv_file.write_text(SAMPLE_CSV)
        records = parse_manifest_csv(csv_file)

        result = filter_by_platform(records, "nonexistent")
        assert result == []

    def test_filter_empty_records(self):
        result = filter_by_platform([], "epic_v2")
        assert result == []


# ── Tests: _classify_context_from_island ─────────────────────────────────────


class TestClassifyContextFromIsland:
    """Tests for CpG context classification given island boundaries."""

    # --- Island ---

    def test_inside_island_start(self):
        assert _classify_context_from_island(10000, 10000, 11000) == "island"

    def test_inside_island_middle(self):
        assert _classify_context_from_island(10500, 10000, 11000) == "island"

    def test_inside_island_end_exclusive(self):
        """Position at end (exclusive) is NOT inside the island."""
        assert _classify_context_from_island(11000, 10000, 11000) != "island"

    # --- North shore ---

    def test_n_shore_just_before(self):
        assert _classify_context_from_island(9999, 10000, 11000) == "n_shore"

    def test_n_shore_at_boundary(self):
        """Position exactly SHORE_DISTANCE bp before island start."""
        pos = 10000 - SHORE_DISTANCE
        assert _classify_context_from_island(pos, 10000, 11000) == "n_shore"

    def test_n_shore_beyond_boundary(self):
        """Position 1bp beyond shore boundary -> shelf."""
        pos = 10000 - SHORE_DISTANCE - 1
        assert _classify_context_from_island(pos, 10000, 11000) == "n_shelf"

    # --- South shore ---

    def test_s_shore_just_after(self):
        assert _classify_context_from_island(11000, 10000, 11000) == "s_shore"

    def test_s_shore_at_boundary(self):
        """Position at south shore/shelf boundary."""
        # dist = pos - isl_end + 1 = SHORE_DISTANCE => pos = isl_end + SHORE_DISTANCE - 1
        pos = 11000 + SHORE_DISTANCE - 1
        assert _classify_context_from_island(pos, 10000, 11000) == "s_shore"

    # --- North shelf ---

    def test_n_shelf(self):
        pos = 10000 - 3000  # 3000bp before island start
        assert _classify_context_from_island(pos, 10000, 11000) == "n_shelf"

    def test_n_shelf_at_outer_boundary(self):
        pos = 10000 - SHELF_DISTANCE
        assert _classify_context_from_island(pos, 10000, 11000) == "n_shelf"

    def test_n_shelf_beyond_outer(self):
        pos = 10000 - SHELF_DISTANCE - 1
        assert _classify_context_from_island(pos, 10000, 11000) == "open_sea"

    # --- South shelf ---

    def test_s_shelf(self):
        # dist = pos - 11000 + 1 = 3001 => within shelf
        pos = 11000 + 3000
        assert _classify_context_from_island(pos, 10000, 11000) == "s_shelf"

    def test_s_shelf_at_outer_boundary(self):
        # dist = pos - 11000 + 1 = SHELF_DISTANCE => pos = 11000 + SHELF_DISTANCE - 1
        pos = 11000 + SHELF_DISTANCE - 1
        assert _classify_context_from_island(pos, 10000, 11000) == "s_shelf"

    def test_s_shelf_beyond_outer(self):
        pos = 11000 + SHELF_DISTANCE
        assert _classify_context_from_island(pos, 10000, 11000) == "open_sea"

    # --- Open sea ---

    def test_open_sea_far_upstream(self):
        assert _classify_context_from_island(0, 10000, 11000) == "open_sea"

    def test_open_sea_far_downstream(self):
        assert _classify_context_from_island(100000, 10000, 11000) == "open_sea"


# ── Tests: cross_map_probes ──────────────────────────────────────────────────


class TestCrossMapProbes:
    """Tests for cross-platform probe mapping."""

    def _make_probe(self, probe_id: str, chr_id: int, pos: int, platform: str) -> dict:
        return {
            "probe_id": probe_id,
            "chr_id": chr_id,
            "pos": pos,
            "platform": platform,
            "build": "hg38",
        }

    def test_exact_id_match(self):
        """Probes with same ID on different platforms should produce exact_id edges."""
        platform_probes = {
            "epic_v2": [self._make_probe("cg00000029", 16, 53434200, "epic_v2")],
            "epic_v1": [self._make_probe("cg00000029", 16, 53434200, "epic_v1")],
        }

        edges = cross_map_probes(platform_probes)
        assert len(edges) == 2  # Forward + reverse

        # Check methods.
        methods = {e[7] for e in edges}
        assert methods == {"exact_id"}

        # Check both directions.
        src_platforms = {e[0] for e in edges}
        assert "epic_v1" in src_platforms
        assert "epic_v2" in src_platforms

    def test_exact_coord_match(self):
        """Probes at same position with different IDs -> coord_overlap edges."""
        platform_probes = {
            "epic_v2": [self._make_probe("cg00000029", 16, 53434200, "epic_v2")],
            "450k": [self._make_probe("cg99999999", 16, 53434200, "450k")],
        }

        edges = cross_map_probes(platform_probes)
        assert len(edges) == 2  # Forward + reverse

        methods = {e[7] for e in edges}
        assert methods == {"coord_overlap"}

    def test_no_match(self):
        """Probes with different IDs and positions should produce no edges."""
        platform_probes = {
            "epic_v2": [self._make_probe("cg00000029", 16, 53434200, "epic_v2")],
            "450k": [self._make_probe("cg99999999", 8, 42263294, "450k")],
        }

        edges = cross_map_probes(platform_probes)
        assert len(edges) == 0

    def test_id_match_takes_priority_over_coord(self):
        """When ID matches, coord_overlap should NOT also be generated for same pair."""
        platform_probes = {
            "epic_v2": [self._make_probe("cg00000029", 16, 53434200, "epic_v2")],
            "epic_v1": [self._make_probe("cg00000029", 16, 53434200, "epic_v1")],
        }

        edges = cross_map_probes(platform_probes)
        # Should be exactly 2 (forward + reverse), all exact_id.
        assert len(edges) == 2
        assert all(e[7] == "exact_id" for e in edges)

    def test_three_platforms(self):
        """Cross-mapping with three platforms should find all pairwise matches."""
        platform_probes = {
            "epic_v2": [self._make_probe("cg00000029", 16, 53434200, "epic_v2")],
            "epic_v1": [self._make_probe("cg00000029", 16, 53434200, "epic_v1")],
            "450k": [self._make_probe("cg00000029", 16, 53434200, "450k")],
        }

        edges = cross_map_probes(platform_probes)
        # 3 platform pairs * 2 directions = 6 edges
        assert len(edges) == 6

    def test_empty_platform(self):
        """Empty platform probe list should not crash."""
        platform_probes = {
            "epic_v2": [self._make_probe("cg00000029", 16, 53434200, "epic_v2")],
            "epic_v1": [],
        }

        edges = cross_map_probes(platform_probes)
        assert len(edges) == 0

    def test_single_platform(self):
        """Single platform should produce no edges."""
        platform_probes = {
            "epic_v2": [self._make_probe("cg00000029", 16, 53434200, "epic_v2")],
        }

        edges = cross_map_probes(platform_probes)
        assert len(edges) == 0

    def test_edge_tuple_structure(self):
        """Verify edge tuples match COLUMNS_MAP_EDGES structure."""
        platform_probes = {
            "epic_v2": [self._make_probe("cg00000029", 16, 53434200, "epic_v2")],
            "epic_v1": [self._make_probe("cg00000029", 16, 53434200, "epic_v1")],
        }

        edges = cross_map_probes(platform_probes)
        assert len(edges) > 0

        for edge in edges:
            assert len(edge) == len(COLUMNS_MAP_EDGES)
            src_plat, src_id, dst_plat, dst_id, build, chr_id, pos, method, conf = edge
            assert src_plat in PLATFORMS
            assert dst_plat in PLATFORMS
            assert isinstance(src_id, str)
            assert isinstance(dst_id, str)
            assert build in BUILDS
            assert isinstance(chr_id, int)
            assert isinstance(pos, int)
            assert method in ("exact_id", "coord_overlap")
            assert 0.0 <= conf <= 1.0

    def test_multiple_probes_partial_overlap(self):
        """Only probes with matching coords should produce coord_overlap edges."""
        platform_probes = {
            "epic_v2": [
                self._make_probe("cg00000001", 1, 100, "epic_v2"),
                self._make_probe("cg00000002", 1, 200, "epic_v2"),
                self._make_probe("cg00000003", 2, 300, "epic_v2"),
            ],
            "epic_v1": [
                self._make_probe("cg00000004", 1, 100, "epic_v1"),  # same coord as cg00000001
                self._make_probe("cg00000005", 3, 400, "epic_v1"),  # no match
            ],
        }

        edges = cross_map_probes(platform_probes)
        # Only one coord match (cg00000001 <-> cg00000004), forward + reverse
        assert len(edges) == 2
        assert all(e[7] == "coord_overlap" for e in edges)

    def test_confidence_is_one(self):
        """All edges should have confidence 1.0."""
        platform_probes = {
            "epic_v2": [self._make_probe("cg00000029", 16, 53434200, "epic_v2")],
            "epic_v1": [self._make_probe("cg00000029", 16, 53434200, "epic_v1")],
        }

        edges = cross_map_probes(platform_probes)
        assert all(e[8] == 1.0 for e in edges)


# ── Tests: Constants ─────────────────────────────────────────────────────────


class TestProbeIngestConstants:
    """Verify module-level constants are correct."""

    def test_platforms(self):
        assert PLATFORMS == ["epic_v2", "epic_v1", "450k"]

    def test_builds(self):
        assert BUILDS == ["hg38", "hg37"]

    def test_batch_size(self):
        assert BATCH_SIZE == 50_000

    def test_gene_window(self):
        assert GENE_WINDOW_BP == 10_000

    def test_shore_distance(self):
        assert SHORE_DISTANCE == 2000

    def test_shelf_distance(self):
        assert SHELF_DISTANCE == 4000

    def test_layer_key_prefix(self):
        assert LAYER_KEY_PREFIX == "probe"

    def test_columns_probes(self):
        expected = ["layer_id", "probe_id", "build", "chr_id", "pos", "gene_symbol", "cpg_context"]
        assert COLUMNS_PROBES == expected

    def test_columns_map_edges(self):
        expected = [
            "src_platform",
            "src_probe_id",
            "dst_platform",
            "dst_probe_id",
            "build",
            "chr_id",
            "pos",
            "method",
            "confidence",
        ]
        assert COLUMNS_MAP_EDGES == expected


# ── Tests: End-to-End Parsing + Cross-Mapping ────────────────────────────────


class TestEndToEndParseCrossMap:
    """Integration tests combining CSV parsing and cross-mapping (no DB)."""

    def test_parse_and_crossmap(self, tmp_path: Path):
        """Parse a CSV, split by platform, and cross-map."""
        csv_file = tmp_path / "manifest.csv"
        csv_file.write_text(SAMPLE_CSV)

        records = parse_manifest_csv(csv_file)

        # Build per-platform lists.
        platform_probes: dict[str, list[dict]] = {}
        for plat in PLATFORMS:
            probes = filter_by_platform(records, plat)
            for p in probes:
                p["build"] = "hg38"
            if probes:
                platform_probes[plat] = probes

        assert len(platform_probes) == 3

        edges = cross_map_probes(platform_probes)

        # cg00000029 appears on all 3 platforms at same pos
        # -> 3 pairs * 2 directions = 6 exact_id edges
        exact_id_edges = [e for e in edges if e[7] == "exact_id"]
        assert len(exact_id_edges) == 6

        # All cg00000029 edges should reference chr16, pos 53434200.
        for e in exact_id_edges:
            assert e[5] == 16  # chr_id
            assert e[6] == 53434200  # pos

    def test_parse_and_crossmap_no_overlap(self, tmp_path: Path):
        """Platforms with entirely disjoint probes should produce no edges."""
        csv_content = """\
probe_id,chr,pos,strand,platform
cg00000001,chr1,100,+,epic_v2
cg00000002,chr2,200,-,epic_v1
cg00000003,chr3,300,+,450k
"""
        csv_file = tmp_path / "manifest.csv"
        csv_file.write_text(csv_content)

        records = parse_manifest_csv(csv_file)
        platform_probes = {}
        for plat in PLATFORMS:
            probes = filter_by_platform(records, plat)
            for p in probes:
                p["build"] = "hg38"
            if probes:
                platform_probes[plat] = probes

        edges = cross_map_probes(platform_probes)
        assert len(edges) == 0
