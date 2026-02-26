"""Tests for CpG site scanning, context classification, and island parsing.

Pure unit tests — no database connections, no downloads, no real genomic data.
"""

from __future__ import annotations

from pathlib import Path

from polymer_genomics.ingest.cpg import (
    SHELF_DISTANCE,
    SHORE_DISTANCE,
    classify_context,
    compute_gc_content,
    parse_cpg_islands,
    read_fasta_sequence,
    scan_cpg_sites,
)


# ── Tests: scan_cpg_sites ───────────────────────────────────────────────────


class TestScanCpgSites:
    """Tests for CG dinucleotide scanning."""

    def test_basic_sequence(self):
        """ACGTCGACG -> CG at positions 1, 4, 7."""
        # A(0) C(1) G(2) T(3) C(4) G(5) A(6) C(7) G(8)
        seq = "ACGTCGACG"
        result = scan_cpg_sites(seq)
        assert result == [1, 4, 7]

    def test_no_cpg(self):
        """Sequence with no CG dinucleotides."""
        seq = "AATTAATT"
        result = scan_cpg_sites(seq)
        assert result == []

    def test_consecutive_cg(self):
        """CGCG -> CG at positions 0 and 2."""
        seq = "CGCG"
        result = scan_cpg_sites(seq)
        assert result == [0, 2]

    def test_all_cg(self):
        """CGCGCG -> CG at 0, 2, 4."""
        seq = "CGCGCG"
        result = scan_cpg_sites(seq)
        assert result == [0, 2, 4]

    def test_single_cg(self):
        seq = "CG"
        result = scan_cpg_sites(seq)
        assert result == [0]

    def test_cg_at_end(self):
        seq = "AACG"
        result = scan_cpg_sites(seq)
        assert result == [2]

    def test_cg_at_start(self):
        seq = "CGAA"
        result = scan_cpg_sites(seq)
        assert result == [0]

    def test_empty_sequence(self):
        result = scan_cpg_sites("")
        assert result == []

    def test_single_base(self):
        result = scan_cpg_sites("C")
        assert result == []

    def test_lowercase_handling(self):
        """scan_cpg_sites should handle lowercase input."""
        seq = "acgtcgacg"
        result = scan_cpg_sites(seq)
        assert result == [1, 4, 7]

    def test_mixed_case(self):
        seq = "AcGtCgAcG"
        result = scan_cpg_sites(seq)
        assert result == [1, 4, 7]

    def test_realistic_count(self):
        """A GC-rich 100bp sequence should have several CpG sites."""
        # Known sequence with exactly 5 CG dinucleotides.
        seq = "ATCGATCGATCGATCGATCG" * 5  # 100bp, CG at 2,6,10,14,18 in each repeat
        result = scan_cpg_sites(seq)
        # "ATCGATCGATCGATCGATCG" has CG at positions 2, 6, 10, 14, 18
        # across 5 repeats of 20bp each
        assert len(result) > 0
        # Verify sorted.
        assert result == sorted(result)


# ── Tests: compute_gc_content ────────────────────────────────────────────────


class TestComputeGcContent:
    """Tests for local GC fraction computation."""

    def test_all_gc(self):
        seq = "GCGCGCGCGCGCGCGCGCGC"
        gc = compute_gc_content(seq, 10, window=5)
        assert gc == 1.0

    def test_all_at(self):
        seq = "AATTAATTAATTAATTAATT"
        gc = compute_gc_content(seq, 10, window=5)
        assert gc == 0.0

    def test_half_gc(self):
        """Known composition: GCGCATATAT -> 4 GC / 10 = 0.4."""
        seq = "GCGCATATAT"
        gc = compute_gc_content(seq, 5, window=5)
        assert abs(gc - 0.4) < 0.01

    def test_window_clipping_start(self):
        """Window at position 0 should not go negative."""
        seq = "GCGCATATATAT"
        gc = compute_gc_content(seq, 0, window=3)
        # Window is [0, 3) = "GCG" -> 3/3 = 1.0
        assert gc == 1.0

    def test_window_clipping_end(self):
        """Window at the end should clip to sequence length."""
        seq = "ATATATATGCG"
        # pos=10 (last base 'G'), window=3 => [7, 13) clipped to [7, 11) = "TGCG"
        gc = compute_gc_content(seq, len(seq) - 1, window=3)
        # "TGCG" = 3 GC / 4 total = 0.75
        assert abs(gc - 0.75) < 0.01

    def test_empty_sequence(self):
        gc = compute_gc_content("", 0, window=5)
        assert gc == 0.0

    def test_small_window(self):
        seq = "ACGT"
        gc = compute_gc_content(seq, 1, window=1)
        # Window [0, 2) = "AC" -> 1/2 = 0.5
        assert abs(gc - 0.5) < 0.01

    def test_default_window(self):
        """Default window is 500bp (1000bp total)."""
        seq = "A" * 2000
        gc = compute_gc_content(seq, 1000)
        assert gc == 0.0


# ── Tests: classify_context ──────────────────────────────────────────────────

# Test islands: one at [10000, 11000) and another at [20000, 21000)
TEST_ISLANDS: list[tuple[int, int, str]] = [
    (10000, 11000, "CpG: 100"),
    (20000, 21000, "CpG: 200"),
]


class TestClassifyContext:
    """Tests for CpG context classification using binary search."""

    # --- Island ---

    def test_inside_island_start(self):
        assert classify_context(10000, TEST_ISLANDS) == "island"

    def test_inside_island_middle(self):
        assert classify_context(10500, TEST_ISLANDS) == "island"

    def test_inside_island_end_exclusive(self):
        """Position 11000 is at the end (exclusive) — NOT inside the island."""
        assert classify_context(11000, TEST_ISLANDS) != "island"

    def test_inside_second_island(self):
        assert classify_context(20500, TEST_ISLANDS) == "island"

    # --- North shore (upstream, within 2kb of island start) ---

    def test_n_shore_just_before_island(self):
        assert classify_context(9999, TEST_ISLANDS) == "n_shore"

    def test_n_shore_boundary(self):
        """Position exactly 2000bp before island start = n_shore."""
        assert classify_context(8000, TEST_ISLANDS) == "n_shore"

    def test_n_shore_one_past_boundary(self):
        """Position 2001bp before island start = n_shelf (not n_shore)."""
        assert classify_context(7999, TEST_ISLANDS) == "n_shelf"

    # --- South shore (downstream, within 2kb of island end) ---

    def test_s_shore_just_after_island(self):
        assert classify_context(11000, TEST_ISLANDS) == "s_shore"

    def test_s_shore_2kb_after(self):
        """Position 1999bp after island end = s_shore."""
        # island_end=11000, pos=11000+1999-1=12998
        # dist = pos - end + 1 = 12998 - 11000 + 1 = 1999 <= 2000
        assert classify_context(12998, TEST_ISLANDS) == "s_shore"

    def test_s_shore_boundary(self):
        """Position exactly at shore/shelf boundary."""
        # dist = pos - end + 1 = 12999 - 11000 + 1 = 2000 <= SHORE_DISTANCE
        assert classify_context(12999, TEST_ISLANDS) == "s_shore"

    # --- North shelf (2-4kb upstream of island start) ---

    def test_n_shelf(self):
        """Position 3000bp before island start = n_shelf."""
        assert classify_context(7000, TEST_ISLANDS) == "n_shelf"

    def test_n_shelf_boundary_outer(self):
        """Position exactly 4000bp before island start = n_shelf."""
        assert classify_context(6000, TEST_ISLANDS) == "n_shelf"

    def test_n_shelf_just_outside(self):
        """Position 4001bp before island start = open_sea."""
        assert classify_context(5999, TEST_ISLANDS) == "open_sea"

    # --- South shelf (2-4kb downstream of island end) ---

    def test_s_shelf(self):
        """Position 3000bp after island end."""
        # dist = pos - end + 1 = 14000 - 11000 + 1 = 3001
        # 2000 < 3001 <= 4000 => s_shelf
        assert classify_context(14000, TEST_ISLANDS) == "s_shelf"

    def test_s_shelf_boundary_outer(self):
        """Position at the outer edge of s_shelf."""
        # dist = pos - end + 1 = 14999 - 11000 + 1 = 4000 <= SHELF_DISTANCE
        assert classify_context(14999, TEST_ISLANDS) == "s_shelf"

    def test_s_shelf_just_outside(self):
        """Position just beyond s_shelf = open_sea."""
        # dist = 15000 - 11000 + 1 = 4001 > SHELF_DISTANCE
        assert classify_context(15000, TEST_ISLANDS) == "open_sea"

    # --- Open sea ---

    def test_open_sea_far_upstream(self):
        assert classify_context(0, TEST_ISLANDS) == "open_sea"

    def test_open_sea_far_downstream(self):
        assert classify_context(100000, TEST_ISLANDS) == "open_sea"

    def test_open_sea_between_islands(self):
        """Position between two islands, beyond shelf distance of both."""
        # First island end=11000, second island start=20000
        # Middle = 15500: dist from 11000 = 4501 (>4000), dist from 20000 = 4500 (>4000)
        assert classify_context(15500, TEST_ISLANDS) == "open_sea"

    # --- Empty islands ---

    def test_empty_islands(self):
        assert classify_context(5000, []) == "open_sea"

    # --- Single island ---

    def test_single_island(self):
        islands = [(1000, 2000, "CpG: 50")]
        assert classify_context(1500, islands) == "island"
        assert classify_context(999, islands) == "n_shore"
        assert classify_context(2000, islands) == "s_shore"

    # --- Between close islands ---

    def test_between_close_islands(self):
        """When position is between two islands and in range of both shores."""
        islands = [(1000, 2000, "CpG: A"), (3000, 4000, "CpG: B")]
        # pos=2500: 500bp downstream of first island, 500bp upstream of second
        # Both are shores — should return the nearest context.
        result = classify_context(2500, islands)
        assert result in ("s_shore", "n_shore")

    # --- Constants sanity ---

    def test_shore_distance_value(self):
        assert SHORE_DISTANCE == 2000

    def test_shelf_distance_value(self):
        assert SHELF_DISTANCE == 4000


# ── Tests: parse_cpg_islands ─────────────────────────────────────────────────


class TestParseCpgIslands:
    """Tests for UCSC cpgIslandExt.txt parsing."""

    def test_basic_parsing(self, tmp_path: Path):
        """Parse a small BED-like file with known islands."""
        bed_content = (
            "585\tchr1\t28735\t29810\tCpG: 111\t1075\t93\t752\t21.4\n"
            "586\tchr1\t135124\t135563\tCpG: 30\t439\t30\t295\t20.0\n"
            "741\tchr2\t237891\t238509\tCpG: 47\t618\t47\t429\t17.3\n"
        )
        bed_file = tmp_path / "cpgIslandExt.txt"
        bed_file.write_text(bed_content)

        result = parse_cpg_islands(bed_file)

        assert "chr1" in result
        assert "chr2" in result
        assert len(result["chr1"]) == 2
        assert len(result["chr2"]) == 1

        # Check first island.
        start, end, name = result["chr1"][0]
        assert start == 28735
        assert end == 29810
        assert name == "CpG: 111"

    def test_filters_non_standard_chromosomes(self, tmp_path: Path):
        """Scaffolds and random chromosomes should be skipped."""
        bed_content = (
            "585\tchr1\t28735\t29810\tCpG: 111\t1075\t93\t752\t21.4\n"
            "100\tchrUn_gl000220\t100\t500\tCpG: 10\t400\t10\t200\t15.0\n"
            "200\tchr1_random\t200\t600\tCpG: 15\t400\t15\t250\t16.0\n"
        )
        bed_file = tmp_path / "cpgIslandExt.txt"
        bed_file.write_text(bed_content)

        result = parse_cpg_islands(bed_file)
        assert "chr1" in result
        assert len(result["chr1"]) == 1
        assert "chrUn_gl000220" not in result
        assert "chr1_random" not in result

    def test_sorted_output(self, tmp_path: Path):
        """Islands should be sorted by start position within each chromosome."""
        bed_content = (
            "585\tchr1\t200000\t201000\tCpG: B\t1000\t50\t600\t18.0\n"
            "586\tchr1\t100000\t101000\tCpG: A\t1000\t50\t600\t18.0\n"
            "587\tchr1\t300000\t301000\tCpG: C\t1000\t50\t600\t18.0\n"
        )
        bed_file = tmp_path / "cpgIslandExt.txt"
        bed_file.write_text(bed_content)

        result = parse_cpg_islands(bed_file)
        starts = [isl[0] for isl in result["chr1"]]
        assert starts == sorted(starts)

    def test_gzipped_file(self, tmp_path: Path):
        """Gzipped files should be parsed correctly."""
        import gzip as gz

        bed_content = "585\tchr1\t28735\t29810\tCpG: 111\t1075\t93\t752\t21.4\n"
        bed_file = tmp_path / "cpgIslandExt.txt.gz"
        with gz.open(bed_file, "wt") as fh:
            fh.write(bed_content)

        result = parse_cpg_islands(bed_file)
        assert "chr1" in result
        assert len(result["chr1"]) == 1

    def test_empty_file(self, tmp_path: Path):
        bed_file = tmp_path / "cpgIslandExt.txt"
        bed_file.write_text("")

        result = parse_cpg_islands(bed_file)
        assert result == {}

    def test_comment_lines_skipped(self, tmp_path: Path):
        bed_content = (
            "# This is a comment\n"
            "585\tchr1\t28735\t29810\tCpG: 111\t1075\t93\t752\t21.4\n"
        )
        bed_file = tmp_path / "cpgIslandExt.txt"
        bed_file.write_text(bed_content)

        result = parse_cpg_islands(bed_file)
        assert len(result["chr1"]) == 1

    def test_short_lines_skipped(self, tmp_path: Path):
        bed_content = (
            "585\tchr1\t28735\t29810\tCpG: 111\t1075\t93\t752\t21.4\n"
            "bad\tline\n"
        )
        bed_file = tmp_path / "cpgIslandExt.txt"
        bed_file.write_text(bed_content)

        result = parse_cpg_islands(bed_file)
        assert len(result["chr1"]) == 1

    def test_chrx_included(self, tmp_path: Path):
        bed_content = "585\tchrX\t28735\t29810\tCpG: 111\t1075\t93\t752\t21.4\n"
        bed_file = tmp_path / "cpgIslandExt.txt"
        bed_file.write_text(bed_content)

        result = parse_cpg_islands(bed_file)
        assert "chrX" in result

    def test_chry_included(self, tmp_path: Path):
        bed_content = "585\tchrY\t28735\t29810\tCpG: 111\t1075\t93\t752\t21.4\n"
        bed_file = tmp_path / "cpgIslandExt.txt"
        bed_file.write_text(bed_content)

        result = parse_cpg_islands(bed_file)
        assert "chrY" in result


# ── Tests: read_fasta_sequence ───────────────────────────────────────────────


class TestReadFastaSequence:
    """Tests for FASTA file reading (pure unit tests with tmp files)."""

    def test_read_single_chr(self, tmp_path: Path):
        fasta = tmp_path / "test.fa"
        fasta.write_text(">chr1\nACGTACGT\nGCGCGCGC\n")

        result = read_fasta_sequence(fasta, "chr1")
        assert result == "ACGTACGTGCGCGCGC"

    def test_read_specific_chr(self, tmp_path: Path):
        fasta = tmp_path / "test.fa"
        fasta.write_text(">chr1\nAAAA\n>chr2\nCCCC\n>chr3\nGGGG\n")

        result = read_fasta_sequence(fasta, "chr2")
        assert result == "CCCC"

    def test_uppercase_conversion(self, tmp_path: Path):
        fasta = tmp_path / "test.fa"
        fasta.write_text(">chr1\nacgtacgt\n")

        result = read_fasta_sequence(fasta, "chr1")
        assert result == "ACGTACGT"

    def test_multiline_sequence(self, tmp_path: Path):
        fasta = tmp_path / "test.fa"
        fasta.write_text(">chr1\nACGT\nTGCA\nAAAA\n")

        result = read_fasta_sequence(fasta, "chr1")
        assert result == "ACGTTGCAAAAA"

    def test_chr_not_found(self, tmp_path: Path):
        fasta = tmp_path / "test.fa"
        fasta.write_text(">chr1\nACGT\n")

        import pytest

        with pytest.raises(ValueError, match="not found"):
            read_fasta_sequence(fasta, "chr99")

    def test_header_with_description(self, tmp_path: Path):
        """FASTA headers can have descriptions after the name."""
        fasta = tmp_path / "test.fa"
        fasta.write_text(">chr1 length=1000 some description\nACGTACGT\n")

        result = read_fasta_sequence(fasta, "chr1")
        assert result == "ACGTACGT"

    def test_gzipped_fasta(self, tmp_path: Path):
        import gzip as gz

        fasta = tmp_path / "test.fa.gz"
        with gz.open(fasta, "wt") as fh:
            fh.write(">chr1\nACGTACGT\n")

        result = read_fasta_sequence(fasta, "chr1")
        assert result == "ACGTACGT"

    def test_last_chr_no_trailing_newline(self, tmp_path: Path):
        """Last chromosome may not have trailing newline."""
        fasta = tmp_path / "test.fa"
        fasta.write_text(">chr1\nACGT\n>chr2\nTGCA")

        result = read_fasta_sequence(fasta, "chr2")
        assert result == "TGCA"


# ── Tests: Integration of scan + classify ────────────────────────────────────


class TestScanAndClassify:
    """Integration tests combining scanning and classification."""

    def test_scan_and_classify_small_sequence(self):
        """Scan a small sequence and classify CpG sites against a known island."""
        # Sequence: 30 bases with CG at multiple positions.
        seq = "AACGTTCGAACGTTTTTTTTTTTTTTTTTT"
        # CG at positions: 2, 6, 10
        positions = scan_cpg_sites(seq)
        assert positions == [2, 6, 10]

        # Island at [5, 8) — only pos=6 should be "island".
        islands = [(5, 8, "CpG: test")]
        contexts = [classify_context(p, islands) for p in positions]
        assert contexts[1] == "island"  # pos=6
        # pos=2 is 3bp before island start — within shore distance.
        assert contexts[0] == "n_shore"
        # pos=10 is 2bp after island end — within shore distance.
        assert contexts[2] == "s_shore"

    def test_all_open_sea(self):
        """Without any islands, all sites are open_sea."""
        seq = "ACGTACGTACGT"
        positions = scan_cpg_sites(seq)
        contexts = [classify_context(p, []) for p in positions]
        assert all(c == "open_sea" for c in contexts)


# ── Tests: Constants and imports ─────────────────────────────────────────────


class TestCpgConstants:
    """Verify module-level constants are correct."""

    def test_island_urls_keys(self):
        from polymer_genomics.ingest.cpg import ISLAND_URLS

        assert "hg38" in ISLAND_URLS
        assert "hg37" in ISLAND_URLS

    def test_batch_size(self):
        from polymer_genomics.ingest.cpg import BATCH_SIZE

        assert BATCH_SIZE == 100_000

    def test_site_columns(self):
        from polymer_genomics.ingest.cpg import SITE_COLUMNS

        assert "layer_id" in SITE_COLUMNS
        assert "build" in SITE_COLUMNS
        assert "chr_id" in SITE_COLUMNS
        assert "pos" in SITE_COLUMNS
        assert "context" in SITE_COLUMNS
        assert "gc_content" in SITE_COLUMNS
        assert "island_id" in SITE_COLUMNS

    def test_island_columns(self):
        from polymer_genomics.ingest.cpg import ISLAND_COLUMNS

        assert "layer_id" in ISLAND_COLUMNS
        assert "start_pos" in ISLAND_COLUMNS
        assert "end_pos" in ISLAND_COLUMNS
        assert "island_name" in ISLAND_COLUMNS

    def test_gc_window(self):
        from polymer_genomics.ingest.cpg import GC_WINDOW

        assert GC_WINDOW == 500
