"""Biophysical reference constants ingestion.

Populates the ``reference`` schema tables with canonical published values
from peer-reviewed biophysics literature. Unlike other ingest modules, the
values are embedded inline — these are physical/chemical constants, not
external datasets.

Usage::

    uv run python -m polymer_genomics.ingest.reference_constants
"""

from __future__ import annotations

import asyncio

import asyncpg

from polymer_genomics.ingest._connection import get_ingest_connection
from polymer_genomics.ingest._transaction import ingest_transaction


# ═══════════════════════════════════════════════════════════════════════════════
# I. NEAREST-NEIGHBOR THERMODYNAMIC PARAMETERS
# ═══════════════════════════════════════════════════════════════════════════════

# SantaLucia J Jr. PNAS 1998;95(4):1460-1465. doi:10.1073/pnas.95.4.1460
# Table 2: Unified nearest-neighbor parameters in 1 M NaCl, 37°C.
# Format: (dinucleotide_5to3, ΔH° kcal/mol, ΔS° cal/mol·K, ΔG°₃₇ kcal/mol)
# The dinucleotide XY means 5'-XY-3' / 3'-X'Y'-5' (Watson-Crick complement).
_SANTALUCIA_1998_DNA_DNA = [
    ("AA", -7.9, -22.2, -1.0),
    ("AT", -7.2, -20.4, -0.88),
    ("TA", -7.2, -21.3, -0.58),
    ("CA", -8.5, -22.7, -1.45),
    ("GT", -8.4, -22.4, -1.44),
    ("CT", -7.8, -21.0, -1.28),
    ("GA", -8.2, -22.2, -1.30),
    ("CG", -10.6, -27.2, -2.17),
    ("GC", -9.8, -24.4, -2.24),
    ("GG", -8.0, -19.9, -1.84),
    # Complements (reverse complement pairs give the same ΔG by symmetry,
    # but we store both orientations for direct lookup convenience)
    ("TT", -7.9, -22.2, -1.0),   # = AA complement
    ("TG", -8.5, -22.7, -1.45),   # = CA complement
    ("AC", -8.4, -22.4, -1.44),   # = GT complement
    ("AG", -7.8, -21.0, -1.28),   # = CT complement
    ("TC", -8.2, -22.2, -1.30),   # = GA complement
    ("CC", -8.0, -19.9, -1.84),   # = GG complement
]
_SANTALUCIA_CITATION = "SantaLucia 1998 PNAS 95:1460-1465"

# Xia T, SantaLucia J Jr, et al. Biochemistry 1998;37(42):14719-14735.
# doi:10.1021/bi9809425
# Table 2: RNA/RNA nearest-neighbor parameters in 1 M NaCl, 37°C.
_XIA_TURNER_1998_RNA_RNA = [
    ("AA", -6.82, -19.0, -0.93),
    ("AC", -11.40, -29.5, -2.24),
    ("AG", -10.48, -27.1, -2.08),
    ("AU", -9.38, -26.7, -1.10),
    ("CA", -10.44, -26.9, -2.11),
    ("CC", -13.39, -32.7, -3.26),
    ("CG", -10.64, -26.7, -2.36),
    ("CU", -10.48, -27.1, -2.08),
    ("GA", -12.44, -32.5, -2.35),
    ("GC", -14.88, -36.9, -3.42),
    ("GG", -13.39, -32.7, -3.26),
    ("GU", -11.40, -29.5, -2.24),
    ("UA", -7.69, -20.5, -1.33),
    ("UC", -12.44, -32.5, -2.35),
    ("UG", -10.44, -26.9, -2.11),
    ("UU", -6.82, -19.0, -0.93),
]
_XIA_TURNER_CITATION = "Xia & Turner 1998 Biochemistry 37:14719-14735"

# Sugimoto N, et al. Biochemistry 1995;34(35):11211-11216.
# doi:10.1021/bi00035a029
# Table 2: RNA/DNA hybrid nearest-neighbor parameters in 1 M NaCl, 37°C.
# Notation: rX/dY means RNA strand 5'-rX-3' paired with DNA strand 3'-dY'-5'.
_SUGIMOTO_1995_RNA_DNA = [
    ("AA", -7.8, -21.9, -1.0),
    ("AC", -5.9, -12.3, -2.1),
    ("AG", -9.1, -23.5, -1.8),
    ("AU", -8.3, -23.9, -0.9),
    ("CA", -9.0, -26.1, -0.9),
    ("CC", -9.3, -23.2, -2.1),
    ("CG", -16.3, -47.1, -1.7),
    ("CU", -7.0, -19.7, -0.9),
    ("GA", -5.5, -13.5, -1.3),
    ("GC", -8.0, -17.1, -2.7),
    ("GG", -12.8, -31.9, -2.9),
    ("GU", -7.8, -21.6, -1.1),
    ("UA", -7.8, -23.2, -0.6),
    ("UC", -8.6, -22.9, -1.5),
    ("UG", -10.4, -28.4, -1.6),
    ("UU", -11.5, -36.4, -0.2),
]
_SUGIMOTO_CITATION = "Sugimoto 1995 Biochemistry 34:11211-11216"


# ═══════════════════════════════════════════════════════════════════════════════
# II. DINUCLEOTIDE PROPERTIES
# ═══════════════════════════════════════════════════════════════════════════════

# Tataurov AV, You Y, Owczarzy R. Biophys Chem 2008;133(1-3):66-70.
# doi:10.1016/j.bpc.2007.12.004
# Nearest-neighbor extinction coefficients at 260 nm (L/mol·cm).
# These are ε₂₆₀ for the dinucleotide in single-stranded context.
_TATAUROV_EXTINCTION = {
    "AA": 27400, "AC": 21200, "AG": 25000, "AT": 22800,
    "CA": 21200, "CC": 14600, "CG": 18000, "CT": 15200,
    "GA": 25200, "GC": 17600, "GG": 21600, "GT": 20000,
    "TA": 23400, "TC": 19000, "TG": 19000, "TT": 16800,
}
_TATAUROV_CITATION = "Tataurov 2008 Biophys Chem 133:66-70"

# Ho PS, et al. EMBO J 1986;5:2737-2744 + Ellison MJ, et al. PNAS
# 1985;82:8320-8324. Z-form propensity: B→Z free energy penalty (kcal/mol per
# dinucleotide step, AS-AS conformation from Z-Hunt source code).
# LOWER = more Z-favorable. CG is most Z-prone (0.66), AT least (6.20).
_Z_FORM_PROPENSITY = {
    "CG": 0.66,  "CA": 1.40,  "TG": 1.40,  "CC": 2.40,
    "GG": 2.40,  "TA": 2.50,  "GA": 3.30,  "TC": 3.30,
    "AG": 3.40,  "CT": 3.40,  "GC": 4.20,  "AA": 4.40,
    "TT": 4.40,  "AC": 5.20,  "GT": 5.20,  "AT": 6.20,
}
_Z_FORM_CITATION = "Ho 1986 EMBO J 5:2737-2744; Ellison 1985 PNAS 82:8320-8324; Z-Hunt source (Ho Lab, Colorado State)"

# El Hassan MA, Calladine CR. J Mol Biol 1996;259(1):95-103.
# doi:10.1006/jmbi.1996.0304
# A-form propensity based on crystal structure statistics: fraction of
# times the step adopts A-like geometry (slide < -1.0 Å). Higher = more A-like.
_A_FORM_PROPENSITY = {
    "GG": 0.92, "GC": 0.89, "CC": 0.88, "CG": 0.85,
    "GA": 0.74, "TC": 0.74, "AG": 0.68, "CT": 0.68,
    "AC": 0.60, "GT": 0.60, "CA": 0.52, "TG": 0.52,
    "AT": 0.42, "TA": 0.34, "AA": 0.28, "TT": 0.28,
}
_A_FORM_CITATION = "El Hassan & Calladine 1996 J Mol Biol 259:95-103"

# Groove geometry — average from high-resolution B-DNA crystal structures.
# Compiled from El Hassan & Calladine 1997, Fratini 1982, Prive 1991.
# Width = cross-strand P-P distance minus 5.8 Å (van der Waals radii).
# Depth = distance from helical axis to groove floor.
# (dinucleotide, major_w, major_d, minor_w, minor_d) in Angstroms
_GROOVE_GEOMETRY = {
    "AA": (11.7, 8.5, 5.7, 7.5),
    "AC": (11.5, 8.5, 5.4, 7.5),
    "AG": (11.8, 8.5, 5.5, 7.5),
    "AT": (11.6, 8.5, 4.8, 8.0),
    "CA": (11.0, 8.5, 6.0, 7.0),
    "CC": (10.8, 8.5, 5.8, 7.0),
    "CG": (11.2, 8.5, 5.5, 7.5),
    "CT": (11.8, 8.5, 5.5, 7.5),
    "GA": (11.8, 8.5, 5.3, 7.5),
    "GC": (11.0, 8.5, 5.0, 7.5),
    "GG": (10.8, 8.5, 5.8, 7.0),
    "GT": (11.5, 8.5, 5.4, 7.5),
    "TA": (12.0, 8.0, 6.2, 7.0),
    "TC": (11.8, 8.5, 5.3, 7.5),
    "TG": (11.0, 8.5, 6.0, 7.0),
    "TT": (11.7, 8.5, 5.7, 7.5),
}
_GROOVE_CITATION = "El Hassan & Calladine 1997; Fratini 1982; Prive 1991"


# ═══════════════════════════════════════════════════════════════════════════════
# III. AMINO ACID PROPERTIES
# ═══════════════════════════════════════════════════════════════════════════════

# Sources:
#   MW: NIST Standard Reference Database (residue mass, minus water)
#   Volume: Zamyatnin 1972 Prog Biophys Mol Biol 24:107-123
#   SASA: Tien et al. 2013 PLoS ONE 8:e80635 (Gly-X-Gly extended)
#   Kyte-Doolittle: Kyte & Doolittle 1982 J Mol Biol 157:105-132
#   Wimley-White: Wimley & White 1996 Nat Struct Biol 3:842-848 (POPC interface)
#   Eisenberg: Eisenberg et al. 1984 J Mol Biol 179:125-142 (consensus)
#   pKa: Lehninger Principles of Biochemistry (standard values)
#   ECPA: Akashi & Gojobori 2002 PNAS 99:3695, Barton 2010 weights
#
# Format: (1-letter, 3-letter, name, MW, volume, SASA,
#          KD, WW, Eisenberg, pKa_side, charge_pH7, ECPA_B20)
_AMINO_ACID_DATA = [
    ("G", "Gly", "Glycine",       57.02,  60,  75, -0.4,  -0.01,  0.62, None,  0.0, 11.7),
    ("A", "Ala", "Alanine",       71.08,  88, 115,  1.8,   0.17,  0.62, None,  0.0, 11.7),
    ("V", "Val", "Valine",        99.13, 140, 155,  4.2,  -0.07,  0.84, None,  0.0, 23.3),
    ("L", "Leu", "Leucine",      113.16, 166, 170,  3.8,  -0.56,  0.94, None,  0.0, 27.3),
    ("I", "Ile", "Isoleucine",   113.16, 169, 175,  4.5,  -0.31,  0.88, None,  0.0, 32.3),
    ("P", "Pro", "Proline",       97.12, 112, 145, -1.6,  -0.45,  0.12, None,  0.0, 20.3),
    ("F", "Phe", "Phenylalanine",147.18, 189, 210,  2.8,   1.13,  1.19, None,  0.0, 52.0),
    ("W", "Trp", "Tryptophan",   186.21, 228, 255, -0.9,   1.85,  0.81, None,  0.0, 74.3),
    ("M", "Met", "Methionine",   131.20, 163, 185,  1.9,  -0.23,  0.74, None,  0.0, 34.3),
    ("S", "Ser", "Serine",        87.08,  89, 115, -0.8,   0.13,  0.18, None,  0.0, 11.7),
    ("T", "Thr", "Threonine",    101.10, 116, 140, -0.7,  -0.14,  0.05, None,  0.0, 18.7),
    ("C", "Cys", "Cysteine",     103.14, 108, 135,  2.5,  -0.24,  0.29,  8.3,  0.0, 24.7),
    ("Y", "Tyr", "Tyrosine",     163.18, 194, 230, -1.3,   0.94,  0.26, 10.1,  0.0, 50.0),
    ("H", "His", "Histidine",    137.14, 153, 195, -3.2,   0.11, -0.40,  6.0,  0.1, 38.3),
    ("D", "Asp", "Aspartate",    115.09, 111, 150, -3.5,  -1.23, -0.90,  3.65,-1.0, 12.7),
    ("E", "Glu", "Glutamate",    129.12, 138, 190, -3.5,  -2.02, -0.74,  4.25,-1.0, 15.3),
    ("N", "Asn", "Asparagine",   114.10, 114, 160, -3.5,  -0.42, -0.78, None,  0.0, 14.7),
    ("Q", "Gln", "Glutamine",    128.13, 143, 180, -3.5,  -0.58, -0.85, None,  0.0, 16.3),
    ("K", "Lys", "Lysine",       128.17, 168, 200, -3.9,  -0.99, -1.50, 10.5,  1.0, 30.3),
    ("R", "Arg", "Arginine",     156.19, 173, 225, -4.5,  -0.81, -2.53, 12.5,  1.0, 27.3),
]
_AA_CITATION = (
    "MW: NIST; Volume: Zamyatnin 1972; SASA: Tien 2013; "
    "KD: Kyte-Doolittle 1982; WW: Wimley-White 1996; "
    "Eisenberg 1984; pKa: Lehninger; ECPA: Akashi-Gojobori 2002/Barton 2010"
)


# ═══════════════════════════════════════════════════════════════════════════════
# IV. PHYSICAL CONSTANTS
# ═══════════════════════════════════════════════════════════════════════════════

# Format: (name, symbol, value, units, category, description, context, citation)
_PHYSICAL_CONSTANTS = [
    # --- DNA Mechanics ---
    ("lp_bdna_physiological_nm", "Lp", 50.0, "nm", "mechanics",
     "Persistence length of bare B-DNA",
     "150 mM NaCl, 37°C",
     "Hagerman 1988 Annu Rev Biophys Biophys Chem 17:265"),
    ("lp_bdna_low_gc_nm", "Lp", 49.0, "nm", "mechanics",
     "Persistence length of unmethylated B-DNA, low GC (~30%)",
     "100 mM NaCl, 25°C, ~30% GC",
     "Lee & Bhatt 2019 Sci Adv 5:eaav1697"),
    ("lp_bdna_high_gc_nm", "Lp", 77.0, "nm", "mechanics",
     "Persistence length of unmethylated B-DNA, high GC (~64%)",
     "100 mM NaCl, 25°C, ~64% GC",
     "Lee & Bhatt 2019 Sci Adv 5:eaav1697"),
    ("lp_bdna_cpg_methylated_nm", "Lp", 50.0, "nm", "mechanics",
     "Persistence length of CpG-methylated B-DNA (converged, GC-independent)",
     "100 mM NaCl, 25°C, any GC content",
     "Lee & Bhatt 2019 Sci Adv 5:eaav1697"),
    ("lp_bdna_non_cpg_methylated_nm", "Lp", 23.0, "nm", "mechanics",
     "Persistence length of non-CpG methylated DNA",
     "Optical tweezers, 10 mM Tris pH 7.5",
     "Ngo 2016 Nat Commun 7:10813"),
    ("lp_ssdna_nm", "Lp", 0.75, "nm", "mechanics",
     "Persistence length of single-stranded DNA",
     "150 mM NaCl",
     "Smith 1996 Science 271:795"),
    ("lp_dsrna_nm", "Lp", 63.0, "nm", "mechanics",
     "Persistence length of double-stranded RNA (A-form)",
     "Physiological conditions",
     "Abels 2005 Biophys J 88:2737"),
    ("stretch_modulus_pn", "S", 1200.0, "pN", "mechanics",
     "Stretch modulus of B-DNA",
     "Optical tweezers, physiological buffer",
     "Smith 1996 Science 271:795; Wang 1997 Biophys J 72:1335"),
    ("torsional_rigidity_erg_cm", "C", 2.4e-19, "erg·cm", "mechanics",
     "Torsional rigidity of B-DNA",
     "Magnetic tweezers",
     "Strick 1996 Science 271:1835"),
    ("twist_persistence_length_nm", "Lt", 75.0, "nm", "mechanics",
     "Twist persistence length of B-DNA",
     "Physiological salt",
     "Moroz & Nelson 1997 PNAS 94:14418"),
    ("overstretching_force_pn", "Fos", 65.0, "pN", "mechanics",
     "Force for B→S overstretching transition",
     "Optical tweezers, 150 mM NaCl",
     "Smith 1996 Science 271:795; Cluzel 1996 Science 271:792"),
    ("unzipping_force_pn", "Fuz", 12.5, "pN", "mechanics",
     "Average force to unzip dsDNA",
     "Optical tweezers, 10 mM phosphate buffer",
     "Essevaz-Roulet 1999 PNAS 96:11399"),

    # --- DNA Electrostatics ---
    ("manning_xi_bdna", "ξ", 4.2, "dimensionless", "electrostatics",
     "Manning condensation parameter for B-DNA (both strands)",
     "Monovalent salt, 25°C",
     "Manning 1978 Q Rev Biophys 11:179"),
    ("manning_theta_monovalent", "θ", 0.76, "dimensionless", "electrostatics",
     "Fraction of DNA charge neutralized by condensed monovalent counterions",
     "Monovalent salt, 25°C, θ = 1 - 1/ξ",
     "Manning 1978 Q Rev Biophys 11:179"),
    ("charge_spacing_bdna_a", "b", 1.7, "Å", "electrostatics",
     "Linear charge spacing along one strand of B-DNA",
     "B-form, 3.4 Å rise / 2 strands",
     "Manning 1978 Q Rev Biophys 11:179"),
    ("dielectric_constant_dna", "ε_DNA", 8.0, "dimensionless", "electrostatics",
     "Intrinsic dielectric constant of DNA (low frequency)",
     "AFM dielectric measurement, dry + humid",
     "Cuervo 2014 PNAS 111:E3624"),

    # --- DNA Geometry ---
    ("rise_per_bp_bdna_a", "h", 3.4, "Å", "geometry",
     "Rise per base pair in B-form DNA",
     "Fiber diffraction consensus; crystal avg 3.32-3.46 Å depending on sequence",
     "Saenger 1984 Principles of Nucleic Acid Structure; Mandelkern 1981 J Mol Biol 152:153"),
    ("twist_per_bp_bdna_deg", "Ω", 36.0, "degrees", "geometry",
     "Twist per base pair step in B-form DNA", "Crystal structures",
     "Saenger 1984 Principles of Nucleic Acid Structure"),
    ("diameter_bdna_a", "d", 20.0, "Å", "geometry",
     "Diameter of B-form DNA helix", "Crystal structures",
     "Saenger 1984 Principles of Nucleic Acid Structure"),
    ("helical_repeat_bdna_bp", "n", 10.0, "bp/turn", "geometry",
     "Helical repeat of B-form DNA in solution (~10.5 in vivo)",
     "Crystal structures (10.0); solution (10.4-10.5)",
     "Wang 1979 PNAS 76:200"),
    ("mw_per_bp_dsdna_da", "MW_bp", 649.0, "Da", "geometry",
     "Average molecular weight per base pair of dsDNA (Na salt)",
     "Standard biochemistry reference",
     "Lehninger Principles of Biochemistry"),
    ("contour_length_per_kb_nm", "L/kb", 340.0, "nm", "geometry",
     "Contour length per kilobase of B-DNA",
     "= 1000 bp × 0.34 nm/bp",
     "Standard calculation from B-DNA rise"),

    # --- DNA Spectroscopy ---
    ("hypochromicity_duplex_fraction", "H", 0.37, "dimensionless", "spectroscopy",
     "Fractional decrease in A₂₆₀ upon duplex formation (average)",
     "Depends on sequence; range 0.30-0.40",
     "Tinoco 1960 J Am Chem Soc 82:4785"),
    ("extinction_dsdna_per_bp", "ε_bp", 6600.0, "M⁻¹cm⁻¹/bp", "spectroscopy",
     "Average molar extinction coefficient per base pair of dsDNA at 260 nm",
     "Standard biochemistry reference, 1 OD₂₆₀ = 50 µg/mL",
     "Sambrook & Russell, Molecular Cloning"),

    # --- DNA Hydration ---
    ("hydration_waters_per_nt", "n_w", 20.0, "waters/nucleotide", "hydration",
     "Average number of water molecules in first + second hydration shell per nucleotide",
     "X-ray crystallography + MD simulation",
     "Schneider & Berman 1998 Biophys J 75:2422"),
    ("spine_hydration_energy_at_kcal", "ΔG_spine", -2.0, "kcal/mol/bp", "hydration",
     "Free energy contribution of spine of hydration per AT base pair",
     "A-tract minor groove",
     "Drew & Dickerson 1981 J Mol Biol 151:535"),

    # --- Nucleosome Thermodynamics ---
    ("nucleosome_wrap_length_bp", "L_nuc", 147.0, "bp", "nucleosome",
     "Length of DNA wrapped around the histone octamer",
     "X-ray crystal structure 1AOI",
     "Luger 1997 Nature 389:251"),
    ("nucleosome_wrap_dg_601_kcal", "ΔG_wrap", -14.5, "kcal/mol", "nucleosome",
     "Total wrapping free energy for 601 positioning sequence",
     "Competitive reconstitution, 150 mM NaCl",
     "Thastrom 2004; Polach & Widom 1995 J Mol Biol 254:130"),
    ("nucleosome_breathing_time_ms", "τ_br", 25.0, "ms", "nucleosome",
     "Characteristic time for 10-20 bp nucleosome breathing (site exposure)",
     "FRET, physiological salt",
     "Polach & Widom 1995; Li 2005 Nat Struct Mol Biol 12:46"),

    # --- Central Dogma Kinetics ---
    ("pol_delta_speed_nt_per_s", "v_polδ", 40.0, "nt/s", "kinetics",
     "DNA Polymerase δ elongation rate (human)",
     "In vitro with PCNA",
     "Kunkel 2004 J Biol Chem 279:16895"),
    ("pol_epsilon_speed_nt_per_s", "v_polε", 50.0, "nt/s", "kinetics",
     "DNA Polymerase ε elongation rate (human)",
     "In vitro",
     "Pursell 2007 Mol Cell 28:29"),
    ("dna_error_rate_after_mmr", "e_DNA", 1e-10, "errors/bp/replication", "kinetics",
     "DNA replication error rate after mismatch repair",
     "Human cells",
     "Kunkel 2004 J Biol Chem 279:16895"),
    ("rnapol2_speed_kb_per_min", "v_RNAPII", 2.5, "kb/min", "kinetics",
     "RNA Polymerase II average elongation rate (human)",
     "4sUDRB-seq, range 1.3-4.3 kb/min across genes",
     "Fuchs 2014 Genome Biol 15:R69"),
    ("rnapol2_error_rate", "e_RNAPII", 1e-5, "errors/nt", "kinetics",
     "RNA Polymerase II transcription error rate",
     "Human cells",
     "Gout 2013 PNAS 110:18584"),
    ("ribosome_speed_aa_per_s", "v_ribo", 5.5, "aa/s", "kinetics",
     "Eukaryotic ribosome translation elongation rate",
     "Ribosome profiling, mammalian cells",
     "Ingolia 2011 Cell 147:789"),
    ("ribosome_footprint_nt", "L_ribo", 29.0, "nt", "kinetics",
     "Ribosome footprint length on mRNA",
     "Ribosome profiling",
     "Ingolia 2009 Science 324:218"),
    ("translation_error_rate", "e_ribo", 3e-4, "errors/codon", "kinetics",
     "Ribosomal mistranslation rate per codon",
     "E. coli and yeast measurements",
     "Drummond & Wilke 2009 Nat Rev Genet 10:715"),

    # --- Protein Thermodynamics ---
    ("protein_marginal_stability_kcal_per_res", "ΔG/res", 0.1, "kcal/mol/residue", "protein",
     "Average stabilizing free energy per residue in globular proteins",
     "Typical globular protein, ΔG_total = -5 to -15 kcal/mol",
     "Pace 1975 CRC Crit Rev Biochem 3:1"),
    ("protein_dcp_per_res", "ΔCp/res", 14.0, "cal/mol·K/residue", "protein",
     "Heat capacity change of unfolding per residue (hydrophobic effect)",
     "DSC measurements on globular proteins",
     "Privalov 1979 Adv Protein Chem 33:167"),
    ("protein_partial_specific_vol", "v̄", 0.73, "cm³/g", "protein",
     "Average partial specific volume of globular proteins",
     "Density measurement, 25°C",
     "Zamyatnin 1972 Prog Biophys Mol Biol 24:107"),
]


# ═══════════════════════════════════════════════════════════════════════════════
# V. CATALOG ENTRIES
# ═══════════════════════════════════════════════════════════════════════════════

_CATALOG_ENTRIES = [
    ("nn_thermodynamics",
     "Nearest-Neighbor Thermodynamics",
     "ΔH, ΔS, ΔG₃₇ for DNA/DNA, RNA/RNA, and RNA/DNA dinucleotide steps",
     "SantaLucia 1998; Xia/Turner 1998; Sugimoto 1995"),
    ("dinucleotide_properties",
     "Dinucleotide Biophysical Properties",
     "Extinction coefficients, A/Z-form propensity, groove geometry per dinucleotide",
     "Tataurov 2008; Ho 1986; El Hassan 1996"),
    ("amino_acid_properties",
     "Amino Acid Reference Properties",
     "MW, volume, SASA, hydrophobicity (3 scales), pKa, biosynthetic cost for 20 AAs",
     "Zamyatnin 1972; Kyte-Doolittle 1982; Wimley-White 1996; Akashi-Gojobori 2002"),
    ("physical_constants",
     "Biophysical Constants",
     "Scalar constants: persistence length, Manning parameter, elastic moduli, enzymatic rates",
     "Hagerman 1988; Manning 1978; Smith 1996; Kunkel 2004; Ingolia 2009"),
]


# ═══════════════════════════════════════════════════════════════════════════════
# INGEST FUNCTIONS
# ═══════════════════════════════════════════════════════════════════════════════

async def _ensure_catalog(conn: asyncpg.Connection) -> None:
    """Populate reference.catalog if empty."""
    count = await conn.fetchval("SELECT count(*) FROM reference.catalog")
    if count > 0:
        print(f"  reference.catalog already has {count} entries, skipping.")
        return
    for table_name, display_name, description, citation in _CATALOG_ENTRIES:
        await conn.execute(
            """INSERT INTO reference.catalog
               (table_name, display_name, description, source_citation)
               VALUES ($1, $2, $3, $4)
               ON CONFLICT (table_name) DO NOTHING""",
            table_name, display_name, description, citation,
        )
    print(f"  Inserted {len(_CATALOG_ENTRIES)} catalog entries.")


async def _load_nn_thermodynamics(conn: asyncpg.Connection) -> None:
    """Load all three NN parameter sets."""
    count = await conn.fetchval("SELECT count(*) FROM reference.nn_thermodynamics")
    if count > 0:
        print(f"  nn_thermodynamics already has {count} rows, skipping.")
        return

    loaded = 0
    for duplex_type, data, citation in [
        ("dna_dna", _SANTALUCIA_1998_DNA_DNA, _SANTALUCIA_CITATION),
        ("rna_rna", _XIA_TURNER_1998_RNA_RNA, _XIA_TURNER_CITATION),
        ("rna_dna", _SUGIMOTO_1995_RNA_DNA, _SUGIMOTO_CITATION),
    ]:
        for dinuc, dh, ds, dg in data:
            await conn.execute(
                """INSERT INTO reference.nn_thermodynamics
                   (duplex_type, dinucleotide, delta_h, delta_s, delta_g_37, source_citation)
                   VALUES ($1, $2, $3, $4, $5, $6)
                   ON CONFLICT DO NOTHING""",
                duplex_type, dinuc, dh, ds, dg, citation,
            )
            loaded += 1
    print(f"  Inserted {loaded} nearest-neighbor parameter rows.")

    # Update catalog row count
    await conn.execute(
        "UPDATE reference.catalog SET row_count = $1 WHERE table_name = 'nn_thermodynamics'",
        loaded,
    )


async def _load_dinucleotide_properties(conn: asyncpg.Connection) -> None:
    """Load per-dinucleotide optical, structural, and form propensity data."""
    count = await conn.fetchval("SELECT count(*) FROM reference.dinucleotide_properties")
    if count > 0:
        print(f"  dinucleotide_properties already has {count} rows, skipping.")
        return

    dinucs = sorted(set(
        list(_TATAUROV_EXTINCTION.keys()) +
        list(_Z_FORM_PROPENSITY.keys()) +
        list(_A_FORM_PROPENSITY.keys()) +
        list(_GROOVE_GEOMETRY.keys())
    ))

    citation_parts = [_TATAUROV_CITATION, _Z_FORM_CITATION, _A_FORM_CITATION, _GROOVE_CITATION]
    citation = "; ".join(citation_parts)

    for dinuc in dinucs:
        ext = _TATAUROV_EXTINCTION.get(dinuc)
        z_prop = _Z_FORM_PROPENSITY.get(dinuc)
        a_prop = _A_FORM_PROPENSITY.get(dinuc)
        groove = _GROOVE_GEOMETRY.get(dinuc, (None, None, None, None))

        await conn.execute(
            """INSERT INTO reference.dinucleotide_properties
               (dinucleotide, extinction_coeff_260, a_form_propensity, z_form_propensity,
                major_groove_width, major_groove_depth, minor_groove_width, minor_groove_depth,
                source_citation)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
               ON CONFLICT DO NOTHING""",
            dinuc, ext, a_prop, z_prop,
            groove[0], groove[1], groove[2], groove[3],
            citation,
        )

    print(f"  Inserted {len(dinucs)} dinucleotide property rows.")
    await conn.execute(
        "UPDATE reference.catalog SET row_count = $1 WHERE table_name = 'dinucleotide_properties'",
        len(dinucs),
    )


async def _load_amino_acid_properties(conn: asyncpg.Connection) -> None:
    """Load the 20 standard amino acid reference properties."""
    count = await conn.fetchval("SELECT count(*) FROM reference.amino_acid_properties")
    if count > 0:
        print(f"  amino_acid_properties already has {count} rows, skipping.")
        return

    for (one, three, name, mw, vol, sasa, kd, ww, eis, pka, charge, ecpa) in _AMINO_ACID_DATA:
        await conn.execute(
            """INSERT INTO reference.amino_acid_properties
               (one_letter, three_letter, full_name, mw_da, volume_a3, sasa_a2,
                kd_hydrophobicity, ww_hydrophobicity, eisenberg_hydrophobicity,
                pka_side_chain, charge_at_ph7, ecpa_b20, source_citation)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
               ON CONFLICT DO NOTHING""",
            one, three, name, mw, float(vol), float(sasa),
            kd, ww, eis, pka, charge, ecpa, _AA_CITATION,
        )

    print(f"  Inserted {len(_AMINO_ACID_DATA)} amino acid property rows.")
    await conn.execute(
        "UPDATE reference.catalog SET row_count = $1 WHERE table_name = 'amino_acid_properties'",
        len(_AMINO_ACID_DATA),
    )


async def _load_physical_constants(conn: asyncpg.Connection) -> None:
    """Load scalar physical constants."""
    count = await conn.fetchval("SELECT count(*) FROM reference.physical_constants")
    if count > 0:
        print(f"  physical_constants already has {count} rows, skipping.")
        return

    for (name, symbol, value, units, category, desc, context, citation) in _PHYSICAL_CONSTANTS:
        await conn.execute(
            """INSERT INTO reference.physical_constants
               (name, symbol, value, units, category, description, context, source_citation)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
               ON CONFLICT DO NOTHING""",
            name, symbol, value, units, category, desc, context, citation,
        )

    print(f"  Inserted {len(_PHYSICAL_CONSTANTS)} physical constant rows.")
    await conn.execute(
        "UPDATE reference.catalog SET row_count = $1 WHERE table_name = 'physical_constants'",
        len(_PHYSICAL_CONSTANTS),
    )


async def main() -> None:
    """Populate all reference tables."""
    conn = await get_ingest_connection(admin=False)

    try:
        async with ingest_transaction(conn):
            print("Loading biophysical reference constants...")
            await _ensure_catalog(conn)
            await _load_nn_thermodynamics(conn)
            await _load_dinucleotide_properties(conn)
            await _load_amino_acid_properties(conn)
            await _load_physical_constants(conn)
            print("Done. All reference tables populated.")
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
