"""SBS Thermodynamic Spectrum ingestion.

Computes the 96-channel trinucleotide mutation spectrum with nearest-neighbor
stacking energy perturbation from SantaLucia 1998 parameters.

Each of the 96 channels represents a single-nucleotide substitution in its
trinucleotide context (pyrimidine convention). For each channel, we compute:

    δΔG = ΔG_mutant − ΔG_wildtype

where ΔG is the sum of the two nearest-neighbor stacking free energies
spanning the mutated position. Positive δΔG = destabilizing mutation.

Usage::

    uv run python -m polymer_genomics.ingest.sbs_spectrum
"""

from __future__ import annotations

import asyncio

from polymer_genomics.ingest._connection import get_ingest_connection
from polymer_genomics.ingest._transaction import ingest_transaction


# ═══════════════════════════════════════════════════════════════════════════════
# SantaLucia 1998 NN stacking free energies (ΔG°₃₇, kcal/mol, 1 M NaCl)
# ═══════════════════════════════════════════════════════════════════════════════

_NN_DG: dict[str, float] = {
    "AA": -1.00, "AT": -0.88, "TA": -0.58, "CA": -1.45,
    "GT": -1.44, "CT": -1.28, "GA": -1.30, "CG": -2.17,
    "GC": -2.24, "GG": -1.84, "TT": -1.00, "TG": -1.45,
    "AC": -1.44, "AG": -1.28, "TC": -1.30, "CC": -1.84,
}

_CITATION = "SantaLucia 1998 PNAS 95:1460-1465; SantaLucia & Hicks 2004 Annu Rev Biophys 33:415-440"

# Pyrimidine convention: reference base is always C or T
_MUTATION_TYPES = [
    ("C", "A"), ("C", "G"), ("C", "T"),
    ("T", "A"), ("T", "C"), ("T", "G"),
]

_BASES = ["A", "C", "G", "T"]


def compute_sbs_spectrum() -> list[dict]:
    """Compute all 96 SBS channels with stacking energy perturbation.

    Returns list of dicts with keys: channel, mutation_type, ref_base, alt_base,
    flanking_5, flanking_3, trinuc_ref, trinuc_alt, dg_wt, dg_mut, delta_dg.
    """
    rows: list[dict] = []

    for ref_base, alt_base in _MUTATION_TYPES:
        mutation_type = f"{ref_base}>{alt_base}"

        for f5 in _BASES:
            for f3 in _BASES:
                channel = f"{f5}[{mutation_type}]{f3}"
                trinuc_ref = f"{f5}{ref_base}{f3}"
                trinuc_alt = f"{f5}{alt_base}{f3}"

                # Wildtype stacking: two NN steps spanning the central base
                dg_wt = _NN_DG[f"{f5}{ref_base}"] + _NN_DG[f"{ref_base}{f3}"]

                # Mutant stacking: same positions but with substituted base
                dg_mut = _NN_DG[f"{f5}{alt_base}"] + _NN_DG[f"{alt_base}{f3}"]

                # Perturbation energy (positive = destabilizing)
                delta_dg = round(dg_mut - dg_wt, 4)

                rows.append({
                    "channel": channel,
                    "mutation_type": mutation_type,
                    "ref_base": ref_base,
                    "alt_base": alt_base,
                    "flanking_5": f5,
                    "flanking_3": f3,
                    "trinuc_ref": trinuc_ref,
                    "trinuc_alt": trinuc_alt,
                    "dg_wt": round(dg_wt, 4),
                    "dg_mut": round(dg_mut, 4),
                    "delta_dg": delta_dg,
                })

    return rows


async def main() -> None:
    """Populate mutation.sbs_spectrum table."""
    conn = await get_ingest_connection(admin=False)

    try:
        async with ingest_transaction(conn):
            # Check for existing data
            count = await conn.fetchval("SELECT count(*) FROM mutation.sbs_spectrum")
            if count > 0:
                print(f"  sbs_spectrum already has {count} rows, skipping.")
                return

            print("Computing 96-channel SBS thermodynamic spectrum...")
            spectrum = compute_sbs_spectrum()
            assert len(spectrum) == 96, f"Expected 96 channels, got {len(spectrum)}"

            for row in spectrum:
                await conn.execute(
                    """INSERT INTO mutation.sbs_spectrum
                       (channel, mutation_type, ref_base, alt_base, flanking_5, flanking_3,
                        trinuc_ref, trinuc_alt, dg_wt, dg_mut, delta_dg, source_citation)
                       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                       ON CONFLICT (channel) DO NOTHING""",
                    row["channel"], row["mutation_type"],
                    row["ref_base"], row["alt_base"],
                    row["flanking_5"], row["flanking_3"],
                    row["trinuc_ref"], row["trinuc_alt"],
                    row["dg_wt"], row["dg_mut"], row["delta_dg"],
                    _CITATION,
                )

            # Update catalog row count
            await conn.execute(
                "UPDATE reference.catalog SET row_count = $1 WHERE table_name = 'sbs_spectrum'",
                len(spectrum),
            )

            print(f"  Inserted {len(spectrum)} SBS channels.")

            # Summary statistics
            max_destab = max(spectrum, key=lambda r: r["delta_dg"])
            max_stab = min(spectrum, key=lambda r: r["delta_dg"])
            print(f"  Most destabilizing: {max_destab['channel']} (δΔG = {max_destab['delta_dg']:+.4f} kcal/mol)")
            print(f"  Most stabilizing:   {max_stab['channel']} (δΔG = {max_stab['delta_dg']:+.4f} kcal/mol)")

    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
