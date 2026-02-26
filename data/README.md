# Data Directory

This directory holds downloaded reference data files used by ingestion scripts.
Files here are **not tracked in git** (large binary/compressed files).

## Data Sources

### GENCODE v44 (Gene Models)

- **hg38**: `gencode.v44.annotation.gtf.gz`
  - URL: <https://ftp.ebi.ac.uk/pub/databases/gencode/Gencode_human/release_44/gencode.v44.annotation.gtf.gz>
  - Reference: GENCODE Release 44 (GRCh38.p14)
  - License: [GENCODE license](https://www.gencodegenes.org/pages/data_access.html) (free for academic and commercial use)
  - ~50 MB compressed, ~1.5 GB uncompressed
  - ~2.7M feature rows (gene, transcript, exon, CDS, UTR, start/stop codon)

- **hg37 (GRCh37 liftover)**: `gencode.v44lift37.annotation.gtf.gz`
  - URL: <https://ftp.ebi.ac.uk/pub/databases/gencode/Gencode_human/release_44/GRCh37_mapping/gencode.v44lift37.annotation.gtf.gz>
  - Same annotation lifted to GRCh37/hg19 coordinates
  - ~45 MB compressed

### Coordinate Convention

GTF files use **1-based, closed** coordinates (both start and end are inclusive).
On ingestion, coordinates are converted to **0-based, half-open** (start -= 1, end unchanged)
to match the database schema and standard bioinformatics conventions (BED format).
