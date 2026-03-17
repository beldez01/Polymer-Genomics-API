# polymer-genomics

Python client for the [Polymer Genomics API](https://api.polymerbio.org/docs) — DNA biophysical properties and curated genomic reference data.

## Install

```bash
pip install polymer-genomics
```

## Quick Start

```python
from polymer_genomics import PolymerClient

client = PolymerClient(api_key="pk_live_...")

# Evaluate a DNA sequence (physics linter)
report = client.evaluate("ATGCGATCGATCGATCG" * 20)
print(report["flag_counts"])
print(report["summary"]["mean_dG37"])

# Compare wild-type vs mutant
delta = client.compare({
    "wt":  "ATGCGATCGATCG" * 20,
    "mut": "ATGCGATCAATCG" * 20,
})
print(delta["deltas_vs_reference"])

# Look up a gene
tp53 = client.gene("hg38", "TP53")
print(tp53["symbol"], tp53["chr"], tp53["start"])

# GTEx expression
expr = client.gene_expression("hg38", "BRCA1")
print(expr["tissues"]["Breast - Mammary Tissue"])

# Query a genomic region
features = client.region("hg38", "chr17:7668402-7687550", layers=["cpg_islands"])

# Methylation probes
probe = client.probe("hg38", "cg00000029")
batch = client.batch_probes("hg38", ["cg00000029", "cg00000108"])

# Biophysical properties of a genomic region
bp = client.biophysics("hg38", "chr17:7668402-7669000")

# Batch evaluate up to 100 sequences
batch = client.batch_evaluate({
    "v1": "ATGCGATCGATCG" * 20,
    "v2": "ATGCAATCGATCG" * 20,
    "v3": "ATGCGATCAATCG" * 20,
})
print(batch["summary"])  # GC range, warning counts

# Region profile — everything about a region in one call
profile = client.region_profile("hg38", "chr17:7668402-7687550")
print(profile["summary"])  # layers with/without features
print(profile["flags"])    # significance flags

# Platform statistics
stats = client.platform_summary()
print(stats["platform"]["total_rows"])

# Cross-layer query recipes
recipes = client.recipes()
recipe = client.recipe("silencing_prone_regions")
# Use recipe filters with client.intersect()

# Reference data
nn = client.nn_parameters()          # nearest-neighbor thermodynamics
aa = client.amino_acid_properties()  # amino acid physicochemical data
pc = client.physical_constants()     # DNA/protein physical constants
```

## Authentication

Pass your API key to the constructor:

```python
client = PolymerClient(api_key="pk_live_...")
```

Or omit it for local development:

```python
client = PolymerClient(base_url="http://localhost:8000")
```

## Error Handling

```python
from polymer_genomics import (
    PolymerAPIError,
    PolymerAuthError,
    PolymerNotFoundError,
    PolymerValidationError,
    PolymerRateLimitError,
)

try:
    client.gene("hg38", "NOTREAL")
except PolymerNotFoundError:
    print("Gene not found")
except PolymerRateLimitError:
    print("Slow down")
except PolymerAPIError as e:
    print(f"API error {e.status_code}: {e.message}")
```

## API Reference

See the full API docs at [api.polymerbio.org/docs](https://api.polymerbio.org/docs).

## License

MIT
