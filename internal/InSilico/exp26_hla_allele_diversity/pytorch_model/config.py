"""Central configuration for the HLA expression CNN.

All hyperparameters, paths, and constants live here. No magic numbers in other files.
"""
from pathlib import Path

# ---------------------------------------------------------------
# Paths
# ---------------------------------------------------------------
PROJECT_ROOT = Path(__file__).resolve().parent.parent  # exp26_hla_allele_diversity/
EXP_ROOT = PROJECT_ROOT
IMGT_DIR = PROJECT_ROOT.parent.parent.parent / "data" / "imgt_hla"  # PolymerGenomicsAPI/data/imgt_hla/

GEUVADIS_TSV = (
    PROJECT_ROOT
    / "external_data"
    / "hlaexpression"
    / "geuvadis_reanalysis"
    / "expression"
    / "3-map_to_transcriptome"
    / "hla_personalized"
    / "quantifications"
    / "processed_imgt_quants.tsv"
)
BETTENS_TSV = PROJECT_ROOT / "data" / "Data_HLA-RNAseq_no_culture.txt"

MODEL_DIR = PROJECT_ROOT / "pytorch_model"
CACHE_DIR = MODEL_DIR / "cache"
RESULTS_DIR = PROJECT_ROOT / "pytorch_results"

# ---------------------------------------------------------------
# Loci
# ---------------------------------------------------------------
LOCI = ["A", "B", "C", "DRB1", "DQB1", "DPB1"]
LOCUS_TO_IDX = {locus: i for i, locus in enumerate(LOCI)}
N_LOCI = len(LOCI)

# ---------------------------------------------------------------
# Feature configuration
# ---------------------------------------------------------------
N_POSITION_FEATURES = 15  # see features.py
FEATURE_NAMES = [
    "stacking_dG37",
    "stacking_dH",
    "stacking_dS",
    "twist",
    "roll",
    "tilt",
    "shift",
    "slide",
    "rise",
    "major_groove_width",
    "minor_groove_width",
    "a_form_propensity",
    "z_form_propensity",
    "cpg_indicator",
    "purine_pyrimidine_alternation",
]
assert len(FEATURE_NAMES) == N_POSITION_FEATURES

# ---------------------------------------------------------------
# Training hyperparameters
# ---------------------------------------------------------------
BATCH_SIZE = 32
LEARNING_RATE = 1e-3
WEIGHT_DECAY = 1e-5
MAX_EPOCHS = 100
EARLY_STOPPING_PATIENCE = 15
VAL_SPLIT = 0.2
RANDOM_SEED = 42
DROPOUT = 0.3

# ---------------------------------------------------------------
# Model architecture
# ---------------------------------------------------------------
CONV1_OUT = 64
CONV2_OUT = 64
CONV3_OUT = 128
CONV4_OUT = 128
CONV_KERNEL_LARGE = 7
CONV_KERNEL_SMALL = 5
MAX_POOL = 4
FC_HIDDEN = 64
