"""Tests for GENCODE v44 gene model ingestion (parsing only, no DB or downloads)."""

from __future__ import annotations

from polymer_genomics.ingest.genes import (
    FEATURE_TYPE_MAP,
    parse_attributes,
    parse_gtf_line,
)

# ── Sample GTF lines ─────────────────────────────────────────────────────────

# Real GENCODE v44 GTF lines (representative examples).
GENE_LINE = (
    'chr1\tHAVANA\tgene\t11869\t14409\t.\t+\t.\t'
    'gene_id "ENSG00000290825.1"; gene_type "lncRNA"; '
    'gene_name "DDX11L2"; level 2; tag "overlapping_locus";'
)

TRANSCRIPT_LINE = (
    'chr1\tHAVANA\ttranscript\t11869\t14409\t.\t+\t.\t'
    'gene_id "ENSG00000290825.1"; transcript_id "ENST00000456328.2"; '
    'gene_type "lncRNA"; gene_name "DDX11L2"; transcript_type "lncRNA"; '
    'transcript_name "DDX11L2-202"; level 2;'
)

EXON_LINE = (
    'chr1\tHAVANA\texon\t11869\t12227\t.\t+\t.\t'
    'gene_id "ENSG00000290825.1"; transcript_id "ENST00000456328.2"; '
    'gene_type "lncRNA"; gene_name "DDX11L2"; transcript_type "lncRNA"; '
    'transcript_name "DDX11L2-202"; exon_number 1; exon_id "ENSE00002234944.1"; '
    'level 2;'
)

CDS_LINE = (
    'chr16\tHAVANA\tCDS\t70699930\t70700050\t.\t+\t0\t'
    'gene_id "ENSG00000130164.18"; transcript_id "ENST00000355500.9"; '
    'gene_type "protein_coding"; gene_name "VAC14"; '
    'transcript_type "protein_coding"; transcript_name "VAC14-201"; '
    'exon_number 3; exon_id "ENSE00001059866.1"; level 2;'
)

UTR5_LINE = (
    'chr17\tHAVANA\tfive_prime_utr\t7687490\t7687550\t.\t-\t.\t'
    'gene_id "ENSG00000141510.18"; transcript_id "ENST00000269305.9"; '
    'gene_type "protein_coding"; gene_name "TP53"; '
    'transcript_type "protein_coding"; transcript_name "TP53-201"; level 2;'
)

UTR3_LINE = (
    'chr17\tHAVANA\tthree_prime_utr\t7668402\t7669690\t.\t-\t.\t'
    'gene_id "ENSG00000141510.18"; transcript_id "ENST00000269305.9"; '
    'gene_type "protein_coding"; gene_name "TP53"; '
    'transcript_type "protein_coding"; transcript_name "TP53-201"; level 2;'
)

START_CODON_LINE = (
    'chr17\tHAVANA\tstart_codon\t7687547\t7687549\t.\t-\t0\t'
    'gene_id "ENSG00000141510.18"; transcript_id "ENST00000269305.9"; '
    'gene_type "protein_coding"; gene_name "TP53"; '
    'transcript_type "protein_coding"; transcript_name "TP53-201"; level 2;'
)

STOP_CODON_LINE = (
    'chr17\tHAVANA\tstop_codon\t7669609\t7669611\t.\t-\t0\t'
    'gene_id "ENSG00000141510.18"; transcript_id "ENST00000269305.9"; '
    'gene_type "protein_coding"; gene_name "TP53"; '
    'transcript_type "protein_coding"; transcript_name "TP53-201"; level 2;'
)

MINUS_STRAND_LINE = (
    'chr7\tENSEMBL\tgene\t55019017\t55211628\t.\t-\t.\t'
    'gene_id "ENSG00000146648.20"; gene_type "protein_coding"; '
    'gene_name "EGFR"; level 1;'
)

# Lines that should be skipped.
COMMENT_LINE = "##description: evidence-based annotation of the human genome (GRCh38)"

SELENOCYSTEINE_LINE = (
    'chr3\tHAVANA\tSelenocysteine\t49395643\t49395645\t.\t-\t.\t'
    'gene_id "ENSG00000091137.12"; transcript_id "ENST00000361547.6"; '
    'gene_type "protein_coding"; gene_name "SLC25A36"; level 2;'
)

SCAFFOLD_LINE = (
    'chrUn_gl000220\tHAVANA\tgene\t100\t500\t.\t+\t.\t'
    'gene_id "ENSG00000999999.1"; gene_name "FAKE"; level 2;'
)

NO_GENE_NAME_LINE = (
    'chr1\tHAVANA\tgene\t1000\t2000\t.\t+\t.\t'
    'gene_id "ENSG00000000001.1"; gene_type "lncRNA"; level 2;'
)


# ── Tests: parse_attributes ──────────────────────────────────────────────────


class TestParseAttributes:
    """Tests for GTF attribute string parsing."""

    def test_basic_attributes(self):
        attr_str = 'gene_id "ENSG00000223972.6"; gene_name "DDX11L1"; gene_type "lncRNA";'
        attrs = parse_attributes(attr_str)
        assert attrs["gene_id"] == "ENSG00000223972.6"
        assert attrs["gene_name"] == "DDX11L1"
        assert attrs["gene_type"] == "lncRNA"

    def test_with_transcript_id(self):
        attr_str = (
            'gene_id "ENSG00000223972.6"; transcript_id "ENST00000456328.2"; '
            'gene_name "DDX11L1";'
        )
        attrs = parse_attributes(attr_str)
        assert attrs["transcript_id"] == "ENST00000456328.2"
        assert attrs["gene_name"] == "DDX11L1"

    def test_empty_string(self):
        attrs = parse_attributes("")
        assert attrs == {}

    def test_extra_whitespace(self):
        attr_str = '  gene_id "ENSG00000223972.6" ;  gene_name "DDX11L1" ;  '
        attrs = parse_attributes(attr_str)
        assert attrs["gene_id"] == "ENSG00000223972.6"
        assert attrs["gene_name"] == "DDX11L1"

    def test_numeric_attribute_value(self):
        attr_str = 'exon_number "3"; level "2";'
        attrs = parse_attributes(attr_str)
        assert attrs["exon_number"] == "3"
        assert attrs["level"] == "2"


# ── Tests: parse_gtf_line ────────────────────────────────────────────────────


class TestParseGtfLine:
    """Tests for GTF line parsing and coordinate conversion."""

    # --- Gene features ---

    def test_parse_gene(self):
        result = parse_gtf_line(GENE_LINE)
        assert result is not None
        assert result["chr_id"] == 1
        assert result["gene_symbol"] == "DDX11L2"
        assert result["gene_id"] == "ENSG00000290825.1"
        assert result["transcript_id"] is None  # gene-level has no transcript_id
        assert result["feature_type"] == "gene"
        assert result["strand"] == "+"

    def test_parse_transcript(self):
        result = parse_gtf_line(TRANSCRIPT_LINE)
        assert result is not None
        assert result["feature_type"] == "transcript"
        assert result["transcript_id"] == "ENST00000456328.2"
        assert result["gene_symbol"] == "DDX11L2"

    def test_parse_exon(self):
        result = parse_gtf_line(EXON_LINE)
        assert result is not None
        assert result["feature_type"] == "exon"
        assert result["transcript_id"] == "ENST00000456328.2"

    def test_parse_cds(self):
        result = parse_gtf_line(CDS_LINE)
        assert result is not None
        assert result["feature_type"] == "cds"
        assert result["gene_symbol"] == "VAC14"
        assert result["chr_id"] == 16

    def test_parse_utr5(self):
        result = parse_gtf_line(UTR5_LINE)
        assert result is not None
        assert result["feature_type"] == "utr5"
        assert result["gene_symbol"] == "TP53"

    def test_parse_utr3(self):
        result = parse_gtf_line(UTR3_LINE)
        assert result is not None
        assert result["feature_type"] == "utr3"

    def test_parse_start_codon(self):
        result = parse_gtf_line(START_CODON_LINE)
        assert result is not None
        assert result["feature_type"] == "start_codon"

    def test_parse_stop_codon(self):
        result = parse_gtf_line(STOP_CODON_LINE)
        assert result is not None
        assert result["feature_type"] == "stop_codon"

    def test_parse_minus_strand(self):
        result = parse_gtf_line(MINUS_STRAND_LINE)
        assert result is not None
        assert result["strand"] == "-"
        assert result["gene_symbol"] == "EGFR"
        assert result["chr_id"] == 7

    # --- Coordinate conversion (1-based closed -> 0-based half-open) ---

    def test_coordinate_conversion_gene(self):
        """GTF start=11869, end=14409 -> start_pos=11868, end_pos=14409."""
        result = parse_gtf_line(GENE_LINE)
        assert result is not None
        # 1-based start 11869 -> 0-based start 11868
        assert result["start_pos"] == 11868
        # 1-based closed end 14409 -> 0-based half-open end 14409 (unchanged)
        assert result["end_pos"] == 14409

    def test_coordinate_conversion_exon(self):
        """GTF start=11869, end=12227 -> start_pos=11868, end_pos=12227."""
        result = parse_gtf_line(EXON_LINE)
        assert result is not None
        assert result["start_pos"] == 11868
        assert result["end_pos"] == 12227

    def test_coordinate_conversion_cds(self):
        """GTF start=70699930, end=70700050 -> start_pos=70699929, end_pos=70700050."""
        result = parse_gtf_line(CDS_LINE)
        assert result is not None
        assert result["start_pos"] == 70699929
        assert result["end_pos"] == 70700050

    def test_coordinate_conversion_small_feature(self):
        """Start codon: GTF start=7687547, end=7687549 -> 7687546, 7687549 (3bp)."""
        result = parse_gtf_line(START_CODON_LINE)
        assert result is not None
        assert result["start_pos"] == 7687546
        assert result["end_pos"] == 7687549
        # Length should be 3 (a codon).
        assert result["end_pos"] - result["start_pos"] == 3

    # --- Skipped lines ---

    def test_skip_comment(self):
        assert parse_gtf_line(COMMENT_LINE) is None

    def test_skip_empty_line(self):
        assert parse_gtf_line("") is None

    def test_skip_blank_line(self):
        assert parse_gtf_line("\n") is None

    def test_skip_selenocysteine(self):
        """Selenocysteine is not in our feature_type enum."""
        assert parse_gtf_line(SELENOCYSTEINE_LINE) is None

    def test_skip_scaffold_chromosome(self):
        """Non-standard chromosomes (chrUn_*, etc.) should be skipped."""
        assert parse_gtf_line(SCAFFOLD_LINE) is None

    def test_skip_no_gene_name(self):
        """Lines without gene_name attribute should be skipped."""
        assert parse_gtf_line(NO_GENE_NAME_LINE) is None

    def test_skip_short_line(self):
        """Lines with fewer than 9 tab-separated fields should be skipped."""
        assert parse_gtf_line("chr1\tHAVANA\tgene\t100\t200") is None


# ── Tests: Feature type mapping ──────────────────────────────────────────────


class TestFeatureTypeMap:
    """Verify the feature type mapping is complete and correct."""

    def test_all_mapped_types(self):
        expected = {
            "gene", "transcript", "exon", "cds",
            "utr5", "utr3", "start_codon", "stop_codon",
        }
        assert set(FEATURE_TYPE_MAP.values()) == expected

    def test_case_sensitive_cds(self):
        """GENCODE uses uppercase 'CDS'; our enum uses lowercase 'cds'."""
        assert FEATURE_TYPE_MAP["CDS"] == "cds"

    def test_utr_mapping(self):
        assert FEATURE_TYPE_MAP["five_prime_utr"] == "utr5"
        assert FEATURE_TYPE_MAP["three_prime_utr"] == "utr3"

    def test_unmapped_returns_none(self):
        """Features not in the map should not appear."""
        assert FEATURE_TYPE_MAP.get("Selenocysteine") is None
        assert FEATURE_TYPE_MAP.get("UTR") is None


# ── Tests: Chromosome filtering ──────────────────────────────────────────────


class TestChromosomeFiltering:
    """Verify that only standard chromosomes (chr1-22, X, Y, M) are accepted."""

    def test_chrx_accepted(self):
        line = (
            'chrX\tHAVANA\tgene\t100\t500\t.\t+\t.\t'
            'gene_id "ENSG00000000001.1"; gene_name "XIST"; level 2;'
        )
        result = parse_gtf_line(line)
        assert result is not None
        assert result["chr_id"] == 23

    def test_chry_accepted(self):
        line = (
            'chrY\tHAVANA\tgene\t100\t500\t.\t+\t.\t'
            'gene_id "ENSG00000000002.1"; gene_name "SRY"; level 2;'
        )
        result = parse_gtf_line(line)
        assert result is not None
        assert result["chr_id"] == 24

    def test_chrm_accepted(self):
        line = (
            'chrM\tHAVANA\tgene\t100\t500\t.\t+\t.\t'
            'gene_id "ENSG00000000003.1"; gene_name "MT-ND1"; level 2;'
        )
        result = parse_gtf_line(line)
        assert result is not None
        assert result["chr_id"] == 25

    def test_random_chr_rejected(self):
        line = (
            'chr1_random\tHAVANA\tgene\t100\t500\t.\t+\t.\t'
            'gene_id "ENSG00000000004.1"; gene_name "FAKE"; level 2;'
        )
        assert parse_gtf_line(line) is None

    def test_alt_chr_rejected(self):
        line = (
            'chr6_GL000250v2_alt\tHAVANA\tgene\t100\t500\t.\t+\t.\t'
            'gene_id "ENSG00000000005.1"; gene_name "FAKE"; level 2;'
        )
        assert parse_gtf_line(line) is None

    def test_fix_chr_rejected(self):
        line = (
            'chrUn_KI270442v1\tHAVANA\tgene\t100\t500\t.\t+\t.\t'
            'gene_id "ENSG00000000006.1"; gene_name "FAKE"; level 2;'
        )
        assert parse_gtf_line(line) is None


# ── Tests: Edge cases ────────────────────────────────────────────────────────


class TestEdgeCases:
    """Edge cases for GTF parsing robustness."""

    def test_gene_without_transcript_id(self):
        """Gene-level features lack transcript_id; should be None."""
        result = parse_gtf_line(GENE_LINE)
        assert result is not None
        assert result["transcript_id"] is None

    def test_trailing_newline(self):
        """Lines with trailing newlines should parse correctly."""
        result = parse_gtf_line(GENE_LINE + "\n")
        assert result is not None
        assert result["gene_symbol"] == "DDX11L2"

    def test_trailing_carriage_return(self):
        """Lines with CRLF should parse correctly."""
        result = parse_gtf_line(GENE_LINE + "\r\n")
        assert result is not None
        assert result["gene_symbol"] == "DDX11L2"

    def test_position_1_converts_to_0(self):
        """GTF position 1 should convert to 0-based position 0."""
        line = (
            'chr1\tHAVANA\tgene\t1\t100\t.\t+\t.\t'
            'gene_id "ENSG00000000001.1"; gene_name "FIRST"; level 2;'
        )
        result = parse_gtf_line(line)
        assert result is not None
        assert result["start_pos"] == 0
        assert result["end_pos"] == 100
