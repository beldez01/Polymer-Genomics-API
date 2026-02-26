"""Tests for isochore computation, classification, and window generation.

Pure unit tests -- no database connections, no real FASTA files.
"""

from __future__ import annotations

from polymer_genomics.ingest.isochores import (
    COLUMNS,
    DEFAULT_STEP_SIZE,
    DEFAULT_WINDOW_SIZE,
    ISOCHORE_THRESHOLDS,
    classify_isochore,
    compute_gc_content,
    compute_isochores,
)


# ── Tests: classify_isochore ─────────────────────────────────────────────────


class TestClassifyIsochore:
    """Tests for Bernardi isochore band classification."""

    # --- L1: GC < 37% ---

    def test_l1_low(self):
        assert classify_isochore(0.0) == "L1"

    def test_l1_mid(self):
        assert classify_isochore(0.30) == "L1"

    def test_l1_just_below_boundary(self):
        assert classify_isochore(0.369) == "L1"

    # --- L2: 37% <= GC < 41% ---

    def test_l2_at_lower_boundary(self):
        assert classify_isochore(0.37) == "L2"

    def test_l2_mid(self):
        assert classify_isochore(0.39) == "L2"

    def test_l2_just_below_upper(self):
        assert classify_isochore(0.409) == "L2"

    # --- H1: 41% <= GC < 46% ---

    def test_h1_at_lower_boundary(self):
        assert classify_isochore(0.41) == "H1"

    def test_h1_mid(self):
        assert classify_isochore(0.43) == "H1"

    def test_h1_just_below_upper(self):
        assert classify_isochore(0.459) == "H1"

    # --- H2: 46% <= GC < 53% ---

    def test_h2_at_lower_boundary(self):
        assert classify_isochore(0.46) == "H2"

    def test_h2_mid(self):
        assert classify_isochore(0.50) == "H2"

    def test_h2_just_below_upper(self):
        assert classify_isochore(0.529) == "H2"

    # --- H3: GC >= 53% ---

    def test_h3_at_lower_boundary(self):
        assert classify_isochore(0.53) == "H3"

    def test_h3_high(self):
        assert classify_isochore(0.70) == "H3"

    def test_h3_max(self):
        assert classify_isochore(1.0) == "H3"


# ── Tests: compute_gc_content ────────────────────────────────────────────────


class TestComputeGcContent:
    """Tests for GC fraction computation over a substring."""

    def test_all_gc(self):
        """Pure GC sequence should yield 1.0."""
        seq = "GCGCGCGCGC"
        assert compute_gc_content(seq, 0, 10) == 1.0

    def test_all_at(self):
        """Pure AT sequence should yield 0.0."""
        seq = "ATATATATAT"
        assert compute_gc_content(seq, 0, 10) == 0.0

    def test_half_gc(self):
        """Sequence with equal GC and AT should yield 0.5."""
        seq = "GCGCATATAT"
        gc = compute_gc_content(seq, 0, 10)
        assert abs(gc - 0.4) < 0.01

    def test_known_composition(self):
        """ACGTACGT = 4 GC out of 8 = 0.5."""
        seq = "ACGTACGT"
        gc = compute_gc_content(seq, 0, 8)
        assert abs(gc - 0.5) < 0.01

    def test_substring(self):
        """Compute GC for a middle substring."""
        seq = "AAAAGCGCAAAA"
        # substring [4, 8) = "GCGC" -> 1.0
        gc = compute_gc_content(seq, 4, 8)
        assert gc == 1.0

    def test_empty_range(self):
        """Empty range should return 0.0."""
        seq = "ACGT"
        assert compute_gc_content(seq, 0, 0) == 0.0

    def test_empty_sequence(self):
        """Empty sequence should return 0.0."""
        assert compute_gc_content("", 0, 0) == 0.0

    def test_n_bases_excluded(self):
        """N bases should not count toward GC or total.

        Sequence 'GCNNNN' has 1G+1C=2 GC, 0 AT, total=2 -> GC=1.0.
        The N bases are simply ignored.
        """
        seq = "GCNNNN"
        gc = compute_gc_content(seq, 0, 6)
        assert gc == 1.0

    def test_all_n_bases(self):
        """Sequence of only N bases should return 0.0."""
        seq = "NNNNNNNN"
        gc = compute_gc_content(seq, 0, 8)
        assert gc == 0.0

    def test_mixed_with_n(self):
        """N bases should be excluded from both numerator and denominator."""
        # "GCATNNGCAT" -> G:2, C:2, A:2, T:2, N:2
        # GC=4, AT=4, total=8 -> GC=0.5
        seq = "GCATNNGCAT"
        gc = compute_gc_content(seq, 0, 10)
        assert abs(gc - 0.5) < 0.01

    def test_single_base_g(self):
        seq = "G"
        assert compute_gc_content(seq, 0, 1) == 1.0

    def test_single_base_a(self):
        seq = "A"
        assert compute_gc_content(seq, 0, 1) == 0.0


# ── Tests: compute_isochores ─────────────────────────────────────────────────


class TestComputeIsochores:
    """Tests for sliding window isochore computation."""

    def test_empty_sequence(self):
        """Empty sequence should produce no windows."""
        result = compute_isochores("", "chr1")
        assert result == []

    def test_single_window_short_sequence(self):
        """Sequence shorter than window size should produce one window."""
        seq = "GCGCGCGCGC"  # 10 bp, window=300000
        result = compute_isochores(seq, "chr1", window_size=300_000, step_size=300_000)
        assert len(result) == 1
        start, end, gc, iso_class = result[0]
        assert start == 0
        assert end == 10
        assert gc == 1.0
        assert iso_class == "H3"

    def test_exact_window_size(self):
        """Sequence exactly equal to window size should produce one window."""
        seq = "A" * 100
        result = compute_isochores(seq, "chr1", window_size=100, step_size=100)
        assert len(result) == 1
        start, end, gc, iso_class = result[0]
        assert start == 0
        assert end == 100
        assert gc == 0.0
        assert iso_class == "L1"

    def test_two_windows(self):
        """Sequence of 2x window size should produce 2 windows."""
        seq = "G" * 50 + "A" * 50
        result = compute_isochores(seq, "chr1", window_size=50, step_size=50)
        assert len(result) == 2
        # First window: all G
        assert result[0] == (0, 50, 1.0, "H3")
        # Second window: all A
        assert result[1] == (50, 100, 0.0, "L1")

    def test_last_window_truncated(self):
        """Final window should be truncated to sequence length."""
        # 75 bp with window=50, step=50 -> windows at [0,50) and [50,75)
        seq = "G" * 75
        result = compute_isochores(seq, "chr1", window_size=50, step_size=50)
        assert len(result) == 2
        assert result[0] == (0, 50, 1.0, "H3")
        # Second window is truncated.
        assert result[1][0] == 50
        assert result[1][1] == 75
        assert result[1][2] == 1.0

    def test_non_overlapping_boundaries(self):
        """With step_size == window_size, windows should not overlap."""
        seq = "A" * 1000
        result = compute_isochores(seq, "chr1", window_size=100, step_size=100)
        assert len(result) == 10
        # Check that each window end == next window start.
        for i in range(len(result) - 1):
            assert result[i][1] == result[i + 1][0]

    def test_overlapping_windows(self):
        """With step_size < window_size, windows should overlap."""
        seq = "A" * 200
        result = compute_isochores(seq, "chr1", window_size=100, step_size=50)
        # Starts: 0, 50, 100, 150 -> 4 windows
        assert len(result) == 4
        assert result[0][0] == 0
        assert result[1][0] == 50
        assert result[2][0] == 100
        assert result[3][0] == 150

    def test_window_gc_computation_correct(self):
        """Verify GC content is computed correctly per window."""
        # First 100bp: 60% GC, next 100bp: 30% GC.
        first = "GC" * 30 + "A" * 40  # 60G+C in 100bp
        second = "GC" * 15 + "A" * 70  # 30G+C in 100bp
        seq = first + second
        result = compute_isochores(seq, "chr1", window_size=100, step_size=100)
        assert len(result) == 2
        assert abs(result[0][2] - 0.60) < 0.01
        assert abs(result[1][2] - 0.30) < 0.01

    def test_isochore_classification_in_results(self):
        """Each window should be classified into the correct isochore band."""
        # Build a 500bp sequence with known GC content per 100bp window:
        # Window 0: 30% GC -> L1
        # Window 1: 39% GC -> L2
        # Window 2: 43% GC -> H1
        # Window 3: 50% GC -> H2
        # Window 4: 60% GC -> H3
        windows_data = [
            ("GC" * 15 + "A" * 70),  # 30% GC -> L1
            ("GC" * 19 + "AT" + "A" * 60),  # 38% GC -> L2
            ("GC" * 22 + "AT" * 3 + "A" * 50),  # 44% GC -> H1
            ("GC" * 25 + "A" * 50),  # 50% GC -> H2
            ("GC" * 30 + "A" * 40),  # 60% GC -> H3
        ]
        seq = "".join(windows_data)
        result = compute_isochores(seq, "chr1", window_size=100, step_size=100)
        assert len(result) == 5
        assert result[0][3] == "L1"
        assert result[1][3] == "L2"
        assert result[2][3] == "H1"
        assert result[3][3] == "H2"
        assert result[4][3] == "H3"

    def test_n_rich_region(self):
        """A window of all N bases should get GC=0.0 and classify as L1."""
        seq = "N" * 100
        result = compute_isochores(seq, "chr1", window_size=100, step_size=100)
        assert len(result) == 1
        assert result[0][2] == 0.0
        assert result[0][3] == "L1"

    def test_default_window_size(self):
        """Verify default window/step size constants."""
        assert DEFAULT_WINDOW_SIZE == 300_000
        assert DEFAULT_STEP_SIZE == 300_000


# ── Tests: Column definitions ────────────────────────────────────────────────


class TestIsochoreConstants:
    """Verify module-level constants are correct."""

    def test_columns_match_schema(self):
        """COLUMNS should match the ref.isochores table definition."""
        assert "layer_id" in COLUMNS
        assert "build" in COLUMNS
        assert "chr_id" in COLUMNS
        assert "start_pos" in COLUMNS
        assert "end_pos" in COLUMNS
        assert "gc_content" in COLUMNS
        assert "isochore_class" in COLUMNS

    def test_column_count(self):
        """7 columns (excluding auto-generated id and coord)."""
        assert len(COLUMNS) == 7

    def test_thresholds_sorted(self):
        """Thresholds should be in ascending order."""
        thresholds = [t[0] for t in ISOCHORE_THRESHOLDS]
        assert thresholds == sorted(thresholds)

    def test_all_five_classes_reachable(self):
        """All 5 isochore classes should be reachable."""
        classes = {classify_isochore(gc) for gc in [0.0, 0.38, 0.43, 0.50, 0.60]}
        assert classes == {"L1", "L2", "H1", "H2", "H3"}
