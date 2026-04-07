"""Source and license metadata for each data layer type.

License classes:
  - "open": Unrestricted commercial use (Public Domain, CC0, CC BY 4.0, MIT, Apache 2.0)
  - "copyleft": Commercial use with share-alike obligations (ODbL, CC BY-SA)
  - "patent_encumbered": Published data with patent restrictions on derived computation
  - "non_commercial": Commercial use requires separate license from data provider

See DATA_LICENSE.md for the full 5-tier commercial use classification.
"""

LAYER_SOURCE_INFO = {
    # ── Computed by Polymer (MIT / Public Domain) ─────────────────────────
    "cpg": {
        "source": "Computed from GRCh38 (Gardiner-Garden & Frommer 1987)",
        "license": "MIT",
        "commercial_use": True,
    },
    "biophysics": {
        "source": "Polymer Evolution L0 (computed from SantaLucia 1998/2004)",
        "license": "MIT",
        "commercial_use": True,
    },
    "nonb_dna": {
        "source": "Computed (G4/Z-DNA/cruciform motifs)",
        "license": "MIT",
        "commercial_use": True,
    },
    "fragility": {
        "source": "Computed composite (non-B DNA + stacking energy + curvature)",
        "license": "MIT",
        "commercial_use": True,
    },
    "sbs": {
        "source": "SantaLucia 1998 nearest-neighbor thermodynamics (96-channel SBS spectrum)",
        "license": "MIT",
        "commercial_use": True,
    },
    "isochore": {
        "source": "Computed from GRCh38",
        "license": "Public Domain",
        "commercial_use": True,
    },

    # ── Public Domain / CC0 ───────────────────────────────────────────────
    "sequence": {
        "source": "GRCh38 / GRCh37",
        "license": "Public Domain",
        "commercial_use": True,
    },
    "gene_model": {
        "source": "GENCODE v44",
        "license": "CC0 1.0",
        "commercial_use": True,
    },
    "gwas": {
        "source": "EBI GWAS Catalog",
        "license": "CC0 1.0",
        "commercial_use": True,
    },
    "gene_alias": {
        "source": "NCBI Gene",
        "license": "Public Domain",
        "commercial_use": True,
    },
    "chromatin_state": {
        "source": "Roadmap Epigenomics / ChromHMM",
        "license": "Public Domain (NIH)",
        "commercial_use": True,
    },

    # ── CC BY 4.0 (attribution required) ──────────────────────────────────
    "regulatory": {
        "source": "ENCODE cCREs v4",
        "license": "CC BY 4.0",
        "commercial_use": True,
    },
    "histone_mark": {
        "source": "ENCODE v3 ChIP-seq",
        "license": "CC BY 4.0",
        "commercial_use": True,
    },
    "tfbs": {
        "source": "ENCODE TF ChIP-seq (ENCODE Consortium 2020)",
        "license": "CC BY 4.0",
        "commercial_use": True,
    },
    "tad_domain": {
        "source": "ENCODE 4 Hi-C, Aiden Lab, Arrowhead v2.13.06",
        "license": "CC BY 4.0",
        "commercial_use": True,
    },
    "hic_compartment": {
        "source": "4D Nucleome + Rao et al. 2014",
        "license": "CC BY 4.0",
        "commercial_use": True,
    },
    "insulation_score": {
        "source": "4D Nucleome, cooltools v0.2.0",
        "license": "CC BY 4.0",
        "commercial_use": True,
    },
    "protein_abundance": {
        "source": "PaxDb v5.0",
        "license": "CC BY 4.0",
        "commercial_use": True,
    },
    "protein_properties": {
        "source": "UniProt ProtParam",
        "license": "CC BY 4.0",
        "commercial_use": True,
    },
    "gene_set": {
        "source": "MSigDB Hallmark",
        "license": "CC BY 4.0",
        "commercial_use": True,
    },
    "pathway": {
        "source": "Reactome",
        "license": "CC BY 4.0",
        "commercial_use": True,
    },

    # ── Other open licenses ───────────────────────────────────────────────
    "probe": {
        "source": "Illumina Manifests (coordinates only, via sesameData)",
        "license": "Factual data (coordinates + IDs only)",
        "commercial_use": True,
    },
    "conservation": {
        "source": "Zoonomia/Cactus 447-way phyloP + 470-way phastCons",
        "license": "Freely usable for any purpose",
        "commercial_use": True,
    },
    "repeat": {
        "source": "RepeatMasker (open source) + Dfam (CC0)",
        "license": "MIT (self-computed)",
        "commercial_use": True,
    },
    "protein_evolution": {
        "source": "Ensembl Compara v112",
        "license": "Apache 2.0",
        "commercial_use": True,
    },
    "expression": {
        "source": "GTEx v10",
        "license": "Open access (summary statistics)",
        "commercial_use": True,
    },
    "methylation": {
        "source": "FlowSorted.Blood.EPIC (Salas 2018)",
        "license": "Artistic License 2.0",
        "commercial_use": True,
    },
    "gene_cost": {
        "source": "Akashi-Gojobori 2002 / GTEx v10",
        "license": "Published literature / Open access",
        "commercial_use": True,
    },
    "tcga_methylation": {
        "source": "TCGA Pan-Cancer (GDC/Xena)",
        "license": "Open access",
        "commercial_use": True,
    },

    # ── Copyleft (commercial use with obligations) ────────────────────────
    "constraint": {
        "source": "gnomAD v4.1",
        "license": "ODC-ODbL 1.0",
        "commercial_use": True,
        "copyleft": True,
        "note": "Derivative databases must remain open under ODbL.",
    },
    "structural_variant": {
        "source": "gnomAD v4.1 SVs (Collins et al. 2020)",
        "license": "ODC-ODbL 1.0",
        "commercial_use": True,
        "copyleft": True,
        "note": "Derivative databases must remain open under ODbL.",
    },
    "protein_atlas": {
        "source": "Human Protein Atlas v23",
        "license": "CC BY-SA 3.0",
        "commercial_use": True,
        "copyleft": True,
        "note": "Derivative works must be shared under CC BY-SA 3.0.",
    },

    # ── Published literature (factual data) ───────────────────────────────
    "protein_turnover": {
        "source": "Mathieson et al. 2018",
        "license": "Published literature (factual data)",
        "commercial_use": True,
    },
    "herv": {
        "source": "Telescope / HervQuant (HERV annotation)",
        "license": "Published literature",
        "commercial_use": True,
    },
    "breakpoint": {
        "source": "HumCFS (Mrasek 2010) + Mitelman Database",
        "license": "Published literature (factual coordinates)",
        "commercial_use": True,
    },
    "gene_profile": {
        "source": "Derived composite (expression + constraint + cost)",
        "license": "Derived",
        "commercial_use": True,
    },

    # ── Patent-encumbered (factual data, computation may be restricted) ───
    "clock": {
        "source": "Published literature (see polymerbio.org/data-sources)",
        "license": "Published literature; patent restrictions may apply",
        "commercial_use": True,
        "patent_notice": "GrimAge (US 10,706,957), DunedinPACE (potential IP). "
                         "Coefficients are factual data; computing epigenetic age "
                         "may require patent license.",
    },

    # ── GPL (copyleft on software, data may differ) ───────────────────────
    "dnashape": {
        "source": "DNAshapeR / GBshape",
        "license": "GPL-2.0",
        "commercial_use": True,
        "note": "GPL applies to the software; derived predictions from "
                "published parameters are factual data.",
    },
}
