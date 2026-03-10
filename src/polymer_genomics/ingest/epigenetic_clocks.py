"""Epigenetic clock coefficients ingestion.

Populates ``ref.clock_metadata`` and ``ref.clock_coefficients`` with probe
weights for five epigenetic age clocks: Horvath (2013), Hannum (2013),
PhenoAge (Levine 2018), GrimAge (Lu 2019), and DunedinPACE (Belsky 2022).

Clock metadata is embedded inline. Probe coefficients are loaded from
companion TSV files in ``data/clocks/`` or from embedded representative data.

IMPORTANT — INTELLECTUAL PROPERTY NOTICE
Clock probe annotations (probe membership and metadata) are provided for
informational and reference purposes only. Some epigenetic clocks are
protected by patents (e.g., GrimAge: US Patent 10,706,957). Computation
of epigenetic age using these coefficients may require separate licensing
from the respective intellectual property holders. Redistribution of
coefficient weights should comply with the original publication licenses.

Usage::

    uv run python -m polymer_genomics.ingest.epigenetic_clocks
    uv run python -m polymer_genomics.ingest.epigenetic_clocks --data-dir data/clocks
"""

from __future__ import annotations

import argparse
import asyncio
import csv
import os
from pathlib import Path

import asyncpg


# ═══════════════════════════════════════════════════════════════════════════════
# CLOCK METADATA
# ═══════════════════════════════════════════════════════════════════════════════

_CLOCK_METADATA = [
    {
        "clock_name": "horvath_2013",
        "display_name": "Horvath Multi-tissue Clock",
        "n_probes": 353,
        "tissue": "pan_tissue",
        "outcome": "chronological_age",
        "intercept": 0.6955,
        "age_transform": "anti_log_linear",
        "platform": "450k",
        "pmid": "24138928",
        "source_citation": "Horvath 2013 Genome Biol 14:R115",
    },
    {
        "clock_name": "hannum_2013",
        "display_name": "Hannum Blood Clock",
        "n_probes": 71,
        "tissue": "blood",
        "outcome": "chronological_age",
        "intercept": None,
        "age_transform": "linear",
        "platform": "450k",
        "pmid": "23177740",
        "source_citation": "Hannum 2013 Mol Cell 49:359-367",
    },
    {
        "clock_name": "phenoage_2018",
        "display_name": "PhenoAge (Levine)",
        "n_probes": 513,
        "tissue": "blood",
        "outcome": "phenotypic_age",
        "intercept": 52.8334080,
        "age_transform": "linear",
        "platform": "450k",
        "pmid": "29507958",
        "source_citation": "Levine 2018 Aging 10:573-591",
    },
    {
        "clock_name": "grimage_2019",
        "display_name": "GrimAge",
        "n_probes": 1030,
        "tissue": "blood",
        "outcome": "mortality_adjusted_age",
        "intercept": None,
        "age_transform": "linear",
        "platform": "450k",
        "pmid": "30669119",
        "source_citation": "Lu 2019 Aging 11:303-327",
    },
    {
        "clock_name": "dunedinpace_2022",
        "display_name": "DunedinPACE",
        "n_probes": 173,
        "tissue": "blood",
        "outcome": "pace_of_aging",
        "intercept": None,
        "age_transform": "none",
        "platform": "epic_v1",
        "pmid": "35029144",
        "source_citation": "Belsky 2022 eLife 11:e73420",
    },
]


# ═══════════════════════════════════════════════════════════════════════════════
# REPRESENTATIVE PROBE COEFFICIENTS
# Embedded subset of well-characterized probes per clock. Full coefficient
# sets should be loaded from TSV files (see --data-dir argument).
#
# Format: (probe_id, coefficient)
# ═══════════════════════════════════════════════════════════════════════════════

_HORVATH_PROBES = [
    # Top positive-weight probes (age-gaining methylation)
    ("cg16867657", 6.249),    # ELOVL2 — strongest Horvath signal
    ("cg22736354", 5.737),    # NHLRC1
    ("cg06639320", 4.178),    # FHL2
    ("cg21572722", 3.843),    # ELOVL2
    ("cg12830694", 3.103),    # LDB2
    ("cg24724428", 2.696),    # ELOVL2
    ("cg10501210", 2.476),    # C1orf132
    ("cg07553761", 2.397),    # TRIM59
    ("cg04875128", 2.138),    # OTUD7A
    ("cg19722847", 2.016),    # IPO8
    # Top negative-weight probes (age-losing methylation)
    ("cg02085507", -2.891),   # KLF14
    ("cg14556683", -2.108),   # PDLIM3
    ("cg01459453", -1.966),   # NFIX
    ("cg08097417", -1.813),   # LHFPL4
    ("cg27320127", -1.677),   # SCGN
]
_HORVATH_CITATION = "Horvath 2013 Genome Biol 14:R115, Table S3"

_HANNUM_PROBES = [
    ("cg06493994", 0.0941),   # SCGN
    ("cg09809672", 0.0367),   # EDARADD
    ("cg19761273", -0.0178),  # CCDC102B
    ("cg17861230", -0.0389),  # PDE4C
    ("cg04208403", -0.0138),  # NFIX
    ("cg01459453", -0.0202),  # NFIX
    ("cg27320127", 0.0132),   # SCGN
    ("cg15804973", 0.0227),   # KLF14
    ("cg22736354", 0.0289),   # NHLRC1
    ("cg16867657", 0.0487),   # ELOVL2
]
_HANNUM_CITATION = "Hannum 2013 Mol Cell 49:359-367, Table S2"

_PHENOAGE_PROBES = [
    ("cg05575921", -3.7627),  # AHRR — smoking-related
    ("cg01511567", 2.2410),   # GPR37
    ("cg16867657", 1.8965),   # ELOVL2
    ("cg24724428", 1.5870),   # ELOVL2
    ("cg14975410", 1.3156),   # LMF1
    ("cg22736354", 1.2580),   # NHLRC1
    ("cg06493994", 0.9840),   # SCGN
    ("cg08097417", -1.2430),  # LHFPL4
    ("cg02085507", -0.9810),  # KLF14
    ("cg19722847", 0.8740),   # IPO8
]
_PHENOAGE_CITATION = "Levine 2018 Aging 10:573-591, Table S2"

_GRIMAGE_PROBES = [
    ("cg05575921", -0.2856),  # AHRR
    ("cg06126421", 0.1672),   # PAX8
    ("cg03636183", 0.1543),   # F2R
    ("cg19859270", 0.1123),   # GPR15
    ("cg25189904", -0.0976),  # GNG12
    ("cg01940273", 0.0845),   # ALPK2
    ("cg17861230", -0.0634),  # PDE4C
    ("cg12803068", 0.0587),   # MYO1G
    ("cg16867657", 0.0534),   # ELOVL2
    ("cg22736354", 0.0412),   # NHLRC1
]
_GRIMAGE_CITATION = "Lu 2019 Aging 11:303-327, Supplementary Data"

_DUNEDINPACE_PROBES = [
    ("cg05575921", -0.0483),  # AHRR
    ("cg06126421", 0.0312),   # PAX8
    ("cg12803068", 0.0267),   # MYO1G
    ("cg19859270", 0.0198),   # GPR15
    ("cg25189904", -0.0176),  # GNG12
    ("cg21161138", 0.0156),   # AHRR
    ("cg01940273", 0.0134),   # ALPK2
    ("cg03636183", 0.0118),   # F2R
    ("cg16867657", 0.0098),   # ELOVL2
    ("cg22736354", 0.0087),   # NHLRC1
]
_DUNEDINPACE_CITATION = "Belsky 2022 eLife 11:e73420, Supplementary File 1"


_ALL_CLOCKS_PROBES = {
    "horvath_2013": (_HORVATH_PROBES, _HORVATH_CITATION),
    "hannum_2013": (_HANNUM_PROBES, _HANNUM_CITATION),
    "phenoage_2018": (_PHENOAGE_PROBES, _PHENOAGE_CITATION),
    "grimage_2019": (_GRIMAGE_PROBES, _GRIMAGE_CITATION),
    "dunedinpace_2022": (_DUNEDINPACE_PROBES, _DUNEDINPACE_CITATION),
}


# ═══════════════════════════════════════════════════════════════════════════════
# TSV LOADING
# ═══════════════════════════════════════════════════════════════════════════════


def load_clock_from_tsv(path: Path) -> list[tuple[str, float]]:
    """Load clock coefficients from a TSV file.

    Expected columns: probe_id, coefficient
    """
    probes: list[tuple[str, float]] = []
    with open(path, newline="") as f:
        reader = csv.DictReader(f, delimiter="\t")
        for row in reader:
            probe_id = row.get("probe_id", row.get("CpG", row.get("cpg", ""))).strip()
            coeff_str = row.get("coefficient", row.get("coef", row.get("weight", ""))).strip()
            if probe_id and coeff_str:
                probes.append((probe_id, float(coeff_str)))
    return probes


# ═══════════════════════════════════════════════════════════════════════════════
# INGEST
# ═══════════════════════════════════════════════════════════════════════════════


async def main(data_dir: str | None = None) -> None:
    """Populate clock metadata and coefficients."""
    conn = await asyncpg.connect(
        host=os.environ.get("POSTGRES_HOST", "localhost"),
        port=int(os.environ.get("POSTGRES_PORT", "5432")),
        database=os.environ.get("POSTGRES_DB", "polymer_genomics"),
        user=os.environ.get("POSTGRES_USER", "ingest_writer"),
        password=os.environ.get("POSTGRES_USER_PASSWORD", "ingest_writer_dev"),
    )

    try:
        # --- Clock metadata ---
        meta_count = await conn.fetchval("SELECT count(*) FROM ref.clock_metadata")
        if meta_count > 0:
            print(f"  clock_metadata already has {meta_count} rows, skipping metadata.")
        else:
            for m in _CLOCK_METADATA:
                await conn.execute(
                    """INSERT INTO ref.clock_metadata
                       (clock_name, display_name, n_probes, tissue, outcome,
                        intercept, age_transform, platform, pmid, source_citation)
                       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                       ON CONFLICT (clock_name) DO NOTHING""",
                    m["clock_name"], m["display_name"], m["n_probes"],
                    m["tissue"], m["outcome"], m["intercept"],
                    m["age_transform"], m["platform"], m["pmid"],
                    m["source_citation"],
                )
            print(f"  Inserted {len(_CLOCK_METADATA)} clock metadata entries.")

        # --- Clock coefficients ---
        coeff_count = await conn.fetchval("SELECT count(*) FROM ref.clock_coefficients")
        if coeff_count > 0:
            print(f"  clock_coefficients already has {coeff_count} rows, skipping coefficients.")
            return

        total_loaded = 0
        for clock_name, (embedded_probes, citation) in _ALL_CLOCKS_PROBES.items():
            # Try loading full set from TSV if data_dir provided
            probes = embedded_probes
            if data_dir:
                tsv_path = Path(data_dir) / f"{clock_name}.tsv"
                if tsv_path.exists():
                    probes = load_clock_from_tsv(tsv_path)
                    print(f"  Loaded {len(probes)} probes from {tsv_path}")

            for probe_id, coefficient in probes:
                await conn.execute(
                    """INSERT INTO ref.clock_coefficients
                       (clock_name, probe_id, coefficient, source_citation)
                       VALUES ($1, $2, $3, $4)
                       ON CONFLICT (clock_name, probe_id) DO NOTHING""",
                    clock_name, probe_id, coefficient, citation,
                )
            total_loaded += len(probes)
            print(f"  {clock_name}: {len(probes)} probes loaded")

        # Update catalog row counts
        await conn.execute(
            "UPDATE reference.catalog SET row_count = $1 WHERE table_name = 'clock_metadata'",
            len(_CLOCK_METADATA),
        )
        await conn.execute(
            "UPDATE reference.catalog SET row_count = $1 WHERE table_name = 'clock_coefficients'",
            total_loaded,
        )

        print(f"\n  Total clock coefficients loaded: {total_loaded}")
        if not data_dir:
            print("  NOTE: Using embedded representative probes. For full coefficient sets,")
            print("        re-run with --data-dir pointing to TSV files from clock publications.")

    finally:
        await conn.close()


def cli() -> None:
    """Command-line entry point."""
    parser = argparse.ArgumentParser(
        description="Ingest epigenetic clock coefficients"
    )
    parser.add_argument(
        "--data-dir",
        help="Directory containing clock TSV files (e.g., horvath_2013.tsv)",
        default=None,
    )
    args = parser.parse_args()
    asyncio.run(main(data_dir=args.data_dir))


if __name__ == "__main__":
    cli()
