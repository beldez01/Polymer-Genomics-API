"""Tests for methylation atlas ingestion.

Pure unit tests -- no database connections, no S3 uploads, no real genomic data.
"""

from __future__ import annotations

import hashlib
from pathlib import Path

import pyarrow as pa
import pyarrow.parquet as pq
import pytest

from polymer_genomics.ingest.methylation import (
    CELL_TYPES,
    DEFAULT_BIN_SIZE,
    REQUIRED_COLUMNS,
    compute_file_hash,
    create_cell_type_parquet,
    create_summary_bins,
    read_methylation_matrix,
    write_summary_parquet,
)

# ── Fixtures ─────────────────────────────────────────────────────────────────


SAMPLE_CSV = (
    "probe_id,chr,pos,CD4T,CD8T,NK,Bcell,Mono,Gran\n"
    "cg00000001,chr1,10000,0.85,0.82,0.90,0.10,0.75,0.60\n"
    "cg00000002,chr1,20000,0.15,0.18,0.20,0.95,0.30,0.40\n"
    "cg00000003,chr2,5000,0.50,0.55,0.45,0.50,0.60,0.65\n"
    "cg00000004,chr2,15000,0.70,0.72,0.68,0.30,0.80,0.85\n"
    "cg00000005,chr1,25000,0.40,0.42,0.38,0.60,0.35,0.45\n"
)


@pytest.fixture
def sample_csv(tmp_path: Path) -> Path:
    """Create a sample methylation matrix CSV in a temp directory."""
    csv_file = tmp_path / "test_matrix.csv"
    csv_file.write_text(SAMPLE_CSV)
    return csv_file


@pytest.fixture
def sample_probe_data(sample_csv: Path) -> dict[str, dict]:
    """Read the sample CSV and return probe data."""
    return read_methylation_matrix(sample_csv)


# ── Tests: read_methylation_matrix ───────────────────────────────────────────


class TestReadMethylationMatrix:
    """Tests for CSV parsing of methylation reference matrices."""

    def test_basic_read(self, sample_csv: Path):
        """Read a well-formed CSV and check structure."""
        data = read_methylation_matrix(sample_csv)

        assert len(data) == 5
        assert "cg00000001" in data
        assert "cg00000003" in data

    def test_probe_structure(self, sample_csv: Path):
        """Each probe entry has chr, chr_id, pos, and cell type values."""
        data = read_methylation_matrix(sample_csv)
        entry = data["cg00000001"]

        assert entry["chr"] == "chr1"
        assert entry["chr_id"] == 1
        assert entry["pos"] == 10000
        assert entry["CD4T"] == pytest.approx(0.85)
        assert entry["Bcell"] == pytest.approx(0.10)

    def test_all_cell_types_present(self, sample_csv: Path):
        """All 6 cell types should be in each probe entry."""
        data = read_methylation_matrix(sample_csv)
        entry = data["cg00000001"]

        for ct in CELL_TYPES:
            assert ct in entry, f"Missing cell type: {ct}"
            assert isinstance(entry[ct], float)

    def test_chr2_probes(self, sample_csv: Path):
        """Probes on chr2 should have chr_id=2."""
        data = read_methylation_matrix(sample_csv)
        assert data["cg00000003"]["chr_id"] == 2
        assert data["cg00000003"]["chr"] == "chr2"

    def test_tab_delimited(self, tmp_path: Path):
        """Tab-delimited files should be parsed correctly."""
        tsv_content = (
            "probe_id\tchr\tpos\tCD4T\tCD8T\n"
            "cg00000001\tchr1\t10000\t0.85\t0.82\n"
        )
        tsv_file = tmp_path / "test.tsv"
        tsv_file.write_text(tsv_content)

        data = read_methylation_matrix(tsv_file)
        assert len(data) == 1
        assert data["cg00000001"]["CD4T"] == pytest.approx(0.85)

    def test_missing_cell_type_columns(self, tmp_path: Path):
        """CSV with only some cell types should still parse."""
        csv_content = (
            "probe_id,chr,pos,CD4T,Mono\n"
            "cg00000001,chr1,10000,0.85,0.75\n"
        )
        csv_file = tmp_path / "partial.csv"
        csv_file.write_text(csv_content)

        data = read_methylation_matrix(csv_file)
        assert len(data) == 1
        assert data["cg00000001"]["CD4T"] == pytest.approx(0.85)
        assert data["cg00000001"]["Mono"] == pytest.approx(0.75)
        # Cell types not in CSV should not be present.
        assert "CD8T" not in data["cg00000001"]

    def test_missing_required_columns(self, tmp_path: Path):
        """CSV missing required columns should raise ValueError."""
        csv_content = "probe_id,chr\ncg00000001,chr1\n"
        csv_file = tmp_path / "bad.csv"
        csv_file.write_text(csv_content)

        with pytest.raises(ValueError, match="Missing required columns"):
            read_methylation_matrix(csv_file)

    def test_file_not_found(self):
        """Non-existent file should raise FileNotFoundError."""
        with pytest.raises(FileNotFoundError):
            read_methylation_matrix("/nonexistent/path.csv")

    def test_skips_unknown_chromosomes(self, tmp_path: Path):
        """Rows with non-standard chromosomes should be skipped."""
        csv_content = (
            "probe_id,chr,pos,CD4T\n"
            "cg00000001,chr1,10000,0.85\n"
            "cg00000002,chrUn_gl000220,500,0.50\n"
            "cg00000003,chr1_random,300,0.40\n"
        )
        csv_file = tmp_path / "unknown_chr.csv"
        csv_file.write_text(csv_content)

        data = read_methylation_matrix(csv_file)
        assert len(data) == 1
        assert "cg00000001" in data

    def test_na_values_become_none(self, tmp_path: Path):
        """NA values should be stored as None."""
        csv_content = (
            "probe_id,chr,pos,CD4T,CD8T\n"
            "cg00000001,chr1,10000,0.85,NA\n"
            "cg00000002,chr1,20000,,0.50\n"
        )
        csv_file = tmp_path / "na_values.csv"
        csv_file.write_text(csv_content)

        data = read_methylation_matrix(csv_file)
        assert data["cg00000001"]["CD8T"] is None
        assert data["cg00000002"]["CD4T"] is None
        assert data["cg00000002"]["CD8T"] == pytest.approx(0.50)

    def test_out_of_range_betas_become_none(self, tmp_path: Path):
        """Beta values outside [0, 1] should be stored as None."""
        csv_content = (
            "probe_id,chr,pos,CD4T\n"
            "cg00000001,chr1,10000,1.5\n"
            "cg00000002,chr1,20000,-0.1\n"
            "cg00000003,chr1,30000,0.5\n"
        )
        csv_file = tmp_path / "bad_betas.csv"
        csv_file.write_text(csv_content)

        data = read_methylation_matrix(csv_file)
        assert data["cg00000001"]["CD4T"] is None
        assert data["cg00000002"]["CD4T"] is None
        assert data["cg00000003"]["CD4T"] == pytest.approx(0.5)

    def test_invalid_pos_skipped(self, tmp_path: Path):
        """Rows with non-integer pos should be skipped."""
        csv_content = (
            "probe_id,chr,pos,CD4T\n"
            "cg00000001,chr1,abc,0.85\n"
            "cg00000002,chr1,20000,0.50\n"
        )
        csv_file = tmp_path / "bad_pos.csv"
        csv_file.write_text(csv_content)

        data = read_methylation_matrix(csv_file)
        assert len(data) == 1
        assert "cg00000002" in data

    def test_empty_rows_skipped(self, tmp_path: Path):
        """Rows with empty probe_id, chr, or pos should be skipped."""
        csv_content = (
            "probe_id,chr,pos,CD4T\n"
            ",chr1,10000,0.85\n"
            "cg00000002,,20000,0.50\n"
            "cg00000003,chr1,,0.40\n"
            "cg00000004,chr1,40000,0.60\n"
        )
        csv_file = tmp_path / "empty_fields.csv"
        csv_file.write_text(csv_content)

        data = read_methylation_matrix(csv_file)
        assert len(data) == 1
        assert "cg00000004" in data

    def test_non_numeric_beta_becomes_none(self, tmp_path: Path):
        """Non-numeric beta values should become None."""
        csv_content = (
            "probe_id,chr,pos,CD4T\n"
            "cg00000001,chr1,10000,invalid\n"
        )
        csv_file = tmp_path / "bad_beta.csv"
        csv_file.write_text(csv_content)

        data = read_methylation_matrix(csv_file)
        assert data["cg00000001"]["CD4T"] is None

    def test_chrx_supported(self, tmp_path: Path):
        """chrX probes should be parsed correctly."""
        csv_content = (
            "probe_id,chr,pos,CD4T\n"
            "cg00000001,chrX,10000,0.85\n"
        )
        csv_file = tmp_path / "chrx.csv"
        csv_file.write_text(csv_content)

        data = read_methylation_matrix(csv_file)
        assert data["cg00000001"]["chr_id"] == 23

    def test_empty_csv_header_only(self, tmp_path: Path):
        """CSV with header only (no data rows) should return empty dict."""
        csv_content = "probe_id,chr,pos,CD4T\n"
        csv_file = tmp_path / "header_only.csv"
        csv_file.write_text(csv_content)

        data = read_methylation_matrix(csv_file)
        assert data == {}


# ── Tests: create_cell_type_parquet ──────────────────────────────────────────


class TestCreateCellTypeParquet:
    """Tests for per-cell-type Parquet file generation."""

    def test_creates_valid_parquet(self, sample_probe_data: dict, tmp_path: Path):
        """Generated Parquet should be readable and have correct schema."""
        path = create_cell_type_parquet(sample_probe_data, "CD4T", tmp_path)

        assert Path(path).exists()
        table = pq.read_table(path)

        # Check schema.
        assert "probe_id" in table.column_names
        assert "chr" in table.column_names
        assert "chr_id" in table.column_names
        assert "pos" in table.column_names
        assert "beta" in table.column_names

    def test_correct_row_count(self, sample_probe_data: dict, tmp_path: Path):
        """All probes with valid beta for this cell type should be included."""
        path = create_cell_type_parquet(sample_probe_data, "CD4T", tmp_path)
        table = pq.read_table(path)

        # All 5 probes have CD4T values.
        assert len(table) == 5

    def test_beta_values_correct(self, sample_probe_data: dict, tmp_path: Path):
        """Beta values in Parquet should match input."""
        path = create_cell_type_parquet(sample_probe_data, "CD4T", tmp_path)
        table = pq.read_table(path)

        # Table is sorted by probe_id.
        probe_ids = table.column("probe_id").to_pylist()
        betas = table.column("beta").to_pylist()

        idx = probe_ids.index("cg00000001")
        assert betas[idx] == pytest.approx(0.85, abs=1e-5)

    def test_excludes_none_betas(self, tmp_path: Path):
        """Probes with None beta values should be excluded."""
        probe_data = {
            "cg001": {"chr": "chr1", "chr_id": 1, "pos": 100, "CD4T": 0.5},
            "cg002": {"chr": "chr1", "chr_id": 1, "pos": 200, "CD4T": None},
            "cg003": {"chr": "chr1", "chr_id": 1, "pos": 300, "CD4T": 0.8},
        }
        path = create_cell_type_parquet(probe_data, "CD4T", tmp_path)
        table = pq.read_table(path)

        assert len(table) == 2

    def test_invalid_cell_type_raises(self, sample_probe_data: dict, tmp_path: Path):
        """Unknown cell type should raise ValueError."""
        with pytest.raises(ValueError, match="Unknown cell type"):
            create_cell_type_parquet(sample_probe_data, "InvalidType", tmp_path)

    def test_output_filename(self, sample_probe_data: dict, tmp_path: Path):
        """Output file should be named {cell_type}.parquet."""
        path = create_cell_type_parquet(sample_probe_data, "Bcell", tmp_path)
        assert Path(path).name == "Bcell.parquet"

    def test_creates_output_directory(self, sample_probe_data: dict, tmp_path: Path):
        """Should create the output directory if it does not exist."""
        nested = tmp_path / "a" / "b" / "c"
        path = create_cell_type_parquet(sample_probe_data, "CD4T", nested)
        assert Path(path).exists()

    def test_empty_probe_data(self, tmp_path: Path):
        """Empty probe data should produce a valid Parquet with 0 rows."""
        path = create_cell_type_parquet({}, "CD4T", tmp_path)
        table = pq.read_table(path)
        assert len(table) == 0

    def test_all_cell_types_produce_valid_files(
        self, sample_probe_data: dict, tmp_path: Path
    ):
        """Each of the 6 standard cell types should produce a valid Parquet."""
        for ct in CELL_TYPES:
            path = create_cell_type_parquet(sample_probe_data, ct, tmp_path / ct)
            assert Path(path).exists()
            table = pq.read_table(path)
            assert len(table) > 0

    def test_parquet_types(self, sample_probe_data: dict, tmp_path: Path):
        """Parquet column types should be correct."""
        path = create_cell_type_parquet(sample_probe_data, "CD4T", tmp_path)
        table = pq.read_table(path)

        assert table.schema.field("probe_id").type == pa.string()
        assert table.schema.field("chr").type == pa.string()
        assert table.schema.field("chr_id").type == pa.int16()
        assert table.schema.field("pos").type == pa.int32()
        assert table.schema.field("beta").type == pa.float32()


# ── Tests: create_summary_bins ───────────────────────────────────────────────


class TestCreateSummaryBins:
    """Tests for 10kb summary bin computation."""

    def test_basic_binning(self, sample_probe_data: dict):
        """Summary bins should aggregate probes into genomic windows."""
        table = create_summary_bins(sample_probe_data, "CD4T")

        assert len(table) > 0
        assert "chr" in table.column_names
        assert "chr_id" in table.column_names
        assert "bin_start" in table.column_names
        assert "bin_end" in table.column_names
        assert "mean_beta" in table.column_names
        assert "n_probes" in table.column_names

    def test_bin_boundaries(self, sample_probe_data: dict):
        """bin_end should always be bin_start + bin_size."""
        table = create_summary_bins(sample_probe_data, "CD4T")

        starts = table.column("bin_start").to_pylist()
        ends = table.column("bin_end").to_pylist()

        for s, e in zip(starts, ends):
            assert e == s + DEFAULT_BIN_SIZE

    def test_known_bin_calculation(self):
        """Test with known data for exact bin values."""
        # Two probes in the same 10kb bin on chr1: [0, 10000)
        probe_data = {
            "cg001": {"chr": "chr1", "chr_id": 1, "pos": 1000, "CD4T": 0.40},
            "cg002": {"chr": "chr1", "chr_id": 1, "pos": 5000, "CD4T": 0.60},
        }
        table = create_summary_bins(probe_data, "CD4T")

        assert len(table) == 1
        assert table.column("bin_start").to_pylist() == [0]
        assert table.column("bin_end").to_pylist() == [DEFAULT_BIN_SIZE]
        assert table.column("mean_beta").to_pylist()[0] == pytest.approx(0.50, abs=1e-5)
        assert table.column("n_probes").to_pylist() == [2]

    def test_probes_in_different_bins(self):
        """Probes in different bins should produce separate summary rows."""
        probe_data = {
            "cg001": {"chr": "chr1", "chr_id": 1, "pos": 5000, "CD4T": 0.40},
            "cg002": {"chr": "chr1", "chr_id": 1, "pos": 15000, "CD4T": 0.80},
        }
        table = create_summary_bins(probe_data, "CD4T")

        assert len(table) == 2
        starts = table.column("bin_start").to_pylist()
        assert 0 in starts
        assert 10000 in starts

    def test_probes_on_different_chromosomes(self):
        """Probes on different chromosomes get separate bins."""
        probe_data = {
            "cg001": {"chr": "chr1", "chr_id": 1, "pos": 5000, "CD4T": 0.40},
            "cg002": {"chr": "chr2", "chr_id": 2, "pos": 5000, "CD4T": 0.80},
        }
        table = create_summary_bins(probe_data, "CD4T")

        assert len(table) == 2
        chr_ids = table.column("chr_id").to_pylist()
        assert 1 in chr_ids
        assert 2 in chr_ids

    def test_skips_none_betas(self):
        """Probes with None beta should not contribute to bins."""
        probe_data = {
            "cg001": {"chr": "chr1", "chr_id": 1, "pos": 5000, "CD4T": 0.40},
            "cg002": {"chr": "chr1", "chr_id": 1, "pos": 6000, "CD4T": None},
        }
        table = create_summary_bins(probe_data, "CD4T")

        assert len(table) == 1
        assert table.column("n_probes").to_pylist() == [1]
        assert table.column("mean_beta").to_pylist()[0] == pytest.approx(0.40, abs=1e-5)

    def test_custom_bin_size(self):
        """Custom bin size should be respected."""
        probe_data = {
            "cg001": {"chr": "chr1", "chr_id": 1, "pos": 500, "CD4T": 0.40},
            "cg002": {"chr": "chr1", "chr_id": 1, "pos": 1500, "CD4T": 0.60},
        }
        # With 1000bp bins, these should be in different bins.
        table = create_summary_bins(probe_data, "CD4T", bin_size=1000)

        assert len(table) == 2
        starts = table.column("bin_start").to_pylist()
        ends = table.column("bin_end").to_pylist()
        assert 0 in starts
        assert 1000 in starts
        for s, e in zip(starts, ends):
            assert e == s + 1000

    def test_empty_probe_data(self):
        """Empty probe data should produce an empty table."""
        table = create_summary_bins({}, "CD4T")
        assert len(table) == 0

    def test_sorted_output(self, sample_probe_data: dict):
        """Output should be sorted by (chr_id, bin_start)."""
        table = create_summary_bins(sample_probe_data, "CD4T")

        chr_ids = table.column("chr_id").to_pylist()
        starts = table.column("bin_start").to_pylist()

        pairs = list(zip(chr_ids, starts))
        assert pairs == sorted(pairs)

    def test_summary_table_types(self, sample_probe_data: dict):
        """Summary table column types should be correct."""
        table = create_summary_bins(sample_probe_data, "CD4T")

        assert table.schema.field("chr").type == pa.string()
        assert table.schema.field("chr_id").type == pa.int16()
        assert table.schema.field("bin_start").type == pa.int32()
        assert table.schema.field("bin_end").type == pa.int32()
        assert table.schema.field("mean_beta").type == pa.float32()
        assert table.schema.field("n_probes").type == pa.int32()


# ── Tests: write_summary_parquet ─────────────────────────────────────────────


class TestWriteSummaryParquet:
    """Tests for writing summary bins to Parquet."""

    def test_creates_file(self, sample_probe_data: dict, tmp_path: Path):
        """Should create a readable Parquet file."""
        path = write_summary_parquet(sample_probe_data, "CD4T", tmp_path)

        assert Path(path).exists()
        table = pq.read_table(path)
        assert len(table) > 0

    def test_output_filename(self, sample_probe_data: dict, tmp_path: Path):
        """Output filename should include cell type and bin size."""
        path = write_summary_parquet(sample_probe_data, "CD4T", tmp_path)
        assert Path(path).name == f"CD4T_summary_{DEFAULT_BIN_SIZE}bp.parquet"

    def test_custom_bin_size_in_filename(self, sample_probe_data: dict, tmp_path: Path):
        """Custom bin size should appear in filename."""
        path = write_summary_parquet(
            sample_probe_data, "CD4T", tmp_path, bin_size=5000
        )
        assert Path(path).name == "CD4T_summary_5000bp.parquet"


# ── Tests: compute_file_hash ────────────────────────────────────────────────


class TestComputeFileHash:
    """Tests for SHA-256 file hashing."""

    def test_known_content(self, tmp_path: Path):
        """SHA-256 of known content should be deterministic."""
        test_file = tmp_path / "test.txt"
        test_file.write_text("hello world\n")

        result = compute_file_hash(test_file)

        assert result.startswith("sha256:")
        # sha256("hello world\n") is well-known.
        import hashlib

        expected = hashlib.sha256(b"hello world\n").hexdigest()
        assert result == f"sha256:{expected}"

    def test_deterministic(self, tmp_path: Path):
        """Same file should always produce the same hash."""
        test_file = tmp_path / "test.txt"
        test_file.write_bytes(b"deterministic content")

        hash1 = compute_file_hash(test_file)
        hash2 = compute_file_hash(test_file)

        assert hash1 == hash2

    def test_different_content_different_hash(self, tmp_path: Path):
        """Different files should produce different hashes."""
        file_a = tmp_path / "a.txt"
        file_b = tmp_path / "b.txt"
        file_a.write_text("content A")
        file_b.write_text("content B")

        hash_a = compute_file_hash(file_a)
        hash_b = compute_file_hash(file_b)

        assert hash_a != hash_b

    def test_file_not_found(self):
        """Non-existent file should raise FileNotFoundError."""
        with pytest.raises(FileNotFoundError):
            compute_file_hash("/nonexistent/file.txt")

    def test_empty_file(self, tmp_path: Path):
        """Empty file should produce the hash of empty bytes."""
        test_file = tmp_path / "empty.txt"
        test_file.write_bytes(b"")

        result = compute_file_hash(test_file)

        expected = hashlib.sha256(b"").hexdigest()
        assert result == f"sha256:{expected}"

    def test_binary_file(self, tmp_path: Path):
        """Binary files should be hashed correctly."""
        test_file = tmp_path / "binary.bin"
        test_file.write_bytes(bytes(range(256)))

        result = compute_file_hash(test_file)
        assert result.startswith("sha256:")
        assert len(result) == 7 + 64  # "sha256:" + 64 hex chars

    def test_parquet_file_hash(self, tmp_path: Path):
        """Parquet files should be hashable."""
        table = pa.table({"x": [1, 2, 3]})
        pq_path = tmp_path / "test.parquet"
        pq.write_table(table, pq_path)

        result = compute_file_hash(pq_path)
        assert result.startswith("sha256:")


# ── Tests: Constants ─────────────────────────────────────────────────────────


class TestConstants:
    """Verify module-level constants."""

    def test_cell_types(self):
        """Standard 6 hematopoietic cell types should be defined."""
        assert CELL_TYPES == ["CD4T", "CD8T", "NK", "Bcell", "Mono", "Gran"]

    def test_default_bin_size(self):
        """Default bin size should be 10kb."""
        assert DEFAULT_BIN_SIZE == 10_000

    def test_required_columns(self):
        """Required CSV columns should include probe_id, chr, pos."""
        assert "probe_id" in REQUIRED_COLUMNS
        assert "chr" in REQUIRED_COLUMNS
        assert "pos" in REQUIRED_COLUMNS


# ── Tests: Integration (CSV -> Parquet -> Summary) ───────────────────────────


class TestEndToEnd:
    """Integration tests combining read, parquet generation, and summary."""

    def test_csv_to_parquet_round_trip(self, sample_csv: Path, tmp_path: Path):
        """Full pipeline: read CSV, generate Parquet, verify content."""
        probe_data = read_methylation_matrix(sample_csv)
        path = create_cell_type_parquet(probe_data, "Gran", tmp_path)
        table = pq.read_table(path)

        # All 5 probes should have Gran values.
        assert len(table) == 5

        # Verify a specific beta value.
        probe_ids = table.column("probe_id").to_pylist()
        betas = table.column("beta").to_pylist()
        idx = probe_ids.index("cg00000001")
        assert betas[idx] == pytest.approx(0.60, abs=1e-5)

    def test_csv_to_summary_bins(self, sample_csv: Path):
        """Full pipeline: read CSV, compute summary bins, verify."""
        probe_data = read_methylation_matrix(sample_csv)
        table = create_summary_bins(probe_data, "NK")

        # 5 probes across chr1 (pos 10000, 20000, 25000) and chr2 (pos 5000, 15000)
        # With 10kb bins:
        #   chr1: [10000,20000) has 1 probe, [20000,30000) has 2 probes
        #   chr2: [0,10000) has 1 probe, [10000,20000) has 1 probe
        assert len(table) == 4

        n_probes = table.column("n_probes").to_pylist()

        # Check that all probe counts add up to 5.
        assert sum(n_probes) == 5

    def test_multiple_cell_types_independent(
        self, sample_csv: Path, tmp_path: Path
    ):
        """Each cell type should produce independent Parquet files."""
        probe_data = read_methylation_matrix(sample_csv)

        paths = {}
        for ct in CELL_TYPES:
            ct_dir = tmp_path / ct
            paths[ct] = create_cell_type_parquet(probe_data, ct, ct_dir)

        # Each should be a separate file.
        all_paths = set(paths.values())
        assert len(all_paths) == 6

        # Read back and verify different beta values.
        cd4t_table = pq.read_table(paths["CD4T"])
        bcell_table = pq.read_table(paths["Bcell"])

        cd4t_betas = set(
            round(b, 2) for b in cd4t_table.column("beta").to_pylist()
        )
        bcell_betas = set(
            round(b, 2) for b in bcell_table.column("beta").to_pylist()
        )

        # Beta values should differ between cell types.
        assert cd4t_betas != bcell_betas
