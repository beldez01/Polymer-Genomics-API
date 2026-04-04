# Four New Data Layers: TFBS, gnomAD SVs, TCGA Pan-Cancer, ABC Enhancer-Gene

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add four high-value data layers to PolymerGenomicsAPI — ENCODE TFBS peaks, gnomAD structural variants, TCGA pan-cancer methylation summaries, and ABC model enhancer-gene links — then expose them through the query registry and MCP tools.

**Architecture:** Each layer follows the established 5-step pattern: (1) SQL migration with partitioned table + GiST index, (2) Python ingestion module parsing source data → COPY protocol, (3) query function + GRanges converter in `queries/`, (4) registry entry in `_registry.py`, (5) license entry. The ABC enhancer-gene layer reuses the **existing** `regulatory.enhancer_gene_links` table and ingestion script — it only needs data to be downloaded and the existing script run. The other three are new tables.

**Tech Stack:** PostgreSQL 16 (partitioned tables, GiST indexes), asyncpg COPY protocol, FastAPI, Python 3.12

**Prerequisites:** Extend Fly volume to 40 GB: `fly volumes extend <vol_id> -s 40 -a polymer-genomics-api`

---

## File Map

### Layer 1: ENCODE TFBS ChIP-seq Peaks
| Action | File |
|--------|------|
| Create | `docker/postgres/migrations/065_tfbs_peaks.sql` |
| Create | `src/polymer_genomics/ingest/tfbs_peaks.py` |
| Modify | `src/polymer_genomics/queries/regulatory.py` — add `region_tfbs_query` + `_convert_tfbs` |
| Modify | `src/polymer_genomics/queries/_registry.py` — add `"tfbs"` entry |
| Modify | `src/polymer_genomics/layer_licenses.py` — add `"tfbs"` entry |
| Modify | `scripts/ingest_all.sh` — add step in Tier 4 |

### Layer 2: gnomAD Structural Variants
| Action | File |
|--------|------|
| Create | `docker/postgres/migrations/066_gnomad_sv.sql` |
| Create | `src/polymer_genomics/ingest/gnomad_sv.py` |
| Create | `src/polymer_genomics/queries/structural_variation.py` |
| Modify | `src/polymer_genomics/queries/_registry.py` — add `"structural_variant"` entry |
| Modify | `src/polymer_genomics/layer_licenses.py` — add `"structural_variant"` entry |
| Modify | `scripts/ingest_all.sh` — add step in Tier 4 |

### Layer 3: TCGA Pan-Cancer Methylation Summaries
| Action | File |
|--------|------|
| Create | `docker/postgres/migrations/067_tcga_pan_cancer.sql` |
| Create | `src/polymer_genomics/ingest/tcga_pan_cancer.py` |
| Create | `src/polymer_genomics/queries/tcga.py` |
| Modify | `src/polymer_genomics/queries/_registry.py` — add `"tcga_methylation"` entry |
| Modify | `src/polymer_genomics/layer_licenses.py` — add `"tcga_methylation"` entry |
| Modify | `scripts/ingest_all.sh` — add step in Tier 6 |

### Layer 4: ABC Enhancer-Gene Links (data only — schema + code already exist)
| Action | File |
|--------|------|
| None | `docker/postgres/migrations/063_enhancer_gene_links.sql` — already applied |
| None | `src/polymer_genomics/ingest/enhancer_gene_links.py` — already written |
| None | `src/polymer_genomics/queries/regulatory.py` — already has `region_enhancer_gene_query` |
| None | `src/polymer_genomics/queries/_registry.py` — already has `"enhancer_gene"` entry |

---

## Task 1: Extend Fly Volume to 40 GB

**Files:** None (infrastructure only)

- [ ] **Step 1: Get current volume ID**

```bash
fly volumes list -a polymer-genomics-api
```

Expected: One volume listed with ~20 GB size.

- [ ] **Step 2: Extend volume to 40 GB**

```bash
fly volumes extend <vol_id> -s 40 -a polymer-genomics-api
```

Expected: "Volume vol_xxx extended to 40GB" — no downtime.

- [ ] **Step 3: Verify**

```bash
fly ssh console -a polymer-genomics-api -C "df -h /data"
```

Expected: ~40 GB total, ~14 GB used.

---

## Task 2: ENCODE TFBS — Migration

**Files:**
- Create: `docker/postgres/migrations/065_tfbs_peaks.sql`

- [ ] **Step 1: Write the migration SQL**

```sql
-- 065_tfbs_peaks.sql
-- ENCODE TF binding site (TFBS) ChIP-seq peaks.
-- ~5-15M peaks across ~700 experiments.
-- Source: ENCODE portal (encodeproject.org), CC BY 4.0.

BEGIN;
ALTER TYPE layer_type ADD VALUE IF NOT EXISTS 'tfbs';
COMMIT;

BEGIN;

CREATE TABLE IF NOT EXISTS regulatory.tfbs_peaks (
    id              bigint GENERATED ALWAYS AS IDENTITY,
    layer_id        uuid NOT NULL REFERENCES registry.layers(id),
    build           genome_build NOT NULL,
    chr_id          smallint NOT NULL REFERENCES ref.chromosomes(chr_id),
    start_pos       int NOT NULL,
    end_pos         int NOT NULL,
    coord           int4range GENERATED ALWAYS AS (int4range(start_pos, end_pos)) STORED,
    tf_name         text NOT NULL,
    cell_type       text NOT NULL,
    signal_value    real,
    p_value         real,
    q_value         real,
    peak_offset     int,
    experiment_id   text,
    PRIMARY KEY (build, chr_id, id)
) PARTITION BY LIST (build);

CREATE TABLE IF NOT EXISTS regulatory.tfbs_peaks_hg38
    PARTITION OF regulatory.tfbs_peaks FOR VALUES IN ('hg38')
    PARTITION BY HASH (chr_id);

CREATE TABLE IF NOT EXISTS regulatory.tfbs_peaks_hg38_p0
    PARTITION OF regulatory.tfbs_peaks_hg38
    FOR VALUES WITH (MODULUS 4, REMAINDER 0);
CREATE TABLE IF NOT EXISTS regulatory.tfbs_peaks_hg38_p1
    PARTITION OF regulatory.tfbs_peaks_hg38
    FOR VALUES WITH (MODULUS 4, REMAINDER 1);
CREATE TABLE IF NOT EXISTS regulatory.tfbs_peaks_hg38_p2
    PARTITION OF regulatory.tfbs_peaks_hg38
    FOR VALUES WITH (MODULUS 4, REMAINDER 2);
CREATE TABLE IF NOT EXISTS regulatory.tfbs_peaks_hg38_p3
    PARTITION OF regulatory.tfbs_peaks_hg38
    FOR VALUES WITH (MODULUS 4, REMAINDER 3);

CREATE INDEX IF NOT EXISTS idx_tfbs_range
    ON regulatory.tfbs_peaks USING GiST (chr_id, coord);
CREATE INDEX IF NOT EXISTS idx_tfbs_tf_cell
    ON regulatory.tfbs_peaks (tf_name, cell_type);
CREATE INDEX IF NOT EXISTS idx_tfbs_layer_build
    ON regulatory.tfbs_peaks (layer_id, build);

GRANT SELECT ON regulatory.tfbs_peaks TO api_reader;
GRANT SELECT, INSERT, UPDATE ON regulatory.tfbs_peaks TO ingest_writer;
GRANT SELECT ON regulatory.tfbs_peaks_hg38 TO api_reader;
GRANT SELECT, INSERT, UPDATE ON regulatory.tfbs_peaks_hg38 TO ingest_writer;
GRANT SELECT ON regulatory.tfbs_peaks_hg38_p0 TO api_reader;
GRANT SELECT, INSERT, UPDATE ON regulatory.tfbs_peaks_hg38_p0 TO ingest_writer;
GRANT SELECT ON regulatory.tfbs_peaks_hg38_p1 TO api_reader;
GRANT SELECT, INSERT, UPDATE ON regulatory.tfbs_peaks_hg38_p1 TO ingest_writer;
GRANT SELECT ON regulatory.tfbs_peaks_hg38_p2 TO api_reader;
GRANT SELECT, INSERT, UPDATE ON regulatory.tfbs_peaks_hg38_p2 TO ingest_writer;
GRANT SELECT ON regulatory.tfbs_peaks_hg38_p3 TO api_reader;
GRANT SELECT, INSERT, UPDATE ON regulatory.tfbs_peaks_hg38_p3 TO ingest_writer;

COMMIT;
```

- [ ] **Step 2: Run migration against local Docker DB**

```bash
cd /Users/zbb2/Desktop/PolymerGenomicsAPI
docker compose exec postgres psql -U admin -d polymer_genomics -f /docker-entrypoint-initdb.d/migrations/065_tfbs_peaks.sql
```

Expected: `ALTER TYPE`, `CREATE TABLE` (×6), `CREATE INDEX` (×3), `GRANT` (×12), `COMMIT` — no errors.

- [ ] **Step 3: Verify table exists**

```bash
docker compose exec postgres psql -U admin -d polymer_genomics -c "\d regulatory.tfbs_peaks"
```

Expected: Table columns listed: id, layer_id, build, chr_id, start_pos, end_pos, coord, tf_name, cell_type, signal_value, p_value, q_value, peak_offset, experiment_id.

- [ ] **Step 4: Commit**

```bash
git add docker/postgres/migrations/065_tfbs_peaks.sql
git commit -m "feat: add TFBS peaks migration (065)"
```

---

## Task 3: ENCODE TFBS — Ingestion Script

**Files:**
- Create: `src/polymer_genomics/ingest/tfbs_peaks.py`

The ENCODE portal provides a metadata TSV at `https://www.encodeproject.org/metadata/` that lists all experiments + file download URLs. We'll use a curated approach: download narrowPeak files for a set of key TFs × cell types (same cell types as histone marks: GM12878, K562, H1-hESC), parse the BED format identically to `histone_marks.py`.

- [ ] **Step 1: Write the ingestion module**

```python
"""ENCODE TFBS ChIP-seq peak ingestion into regulatory.tfbs_peaks.

Reads ENCODE narrowPeak BED files for transcription factor ChIP-seq data.
Same BED parsing logic as histone_marks.py.

Source data: ENCODE portal (encodeproject.org), GRCh38 aligned, IDR-filtered.
Download narrowPeak.gz files to data/downloads/tfbs/ with naming convention:
    <TF_NAME>_<CELL_TYPE>.narrowPeak.gz

Usage::

    uv run python -m polymer_genomics.ingest.tfbs_peaks
    uv run python -m polymer_genomics.ingest.tfbs_peaks --build hg38
"""

from __future__ import annotations

import argparse
import asyncio
import gzip
import os
from pathlib import Path

import asyncpg

from polymer_genomics.constants import CHR_NAME_TO_ID
from polymer_genomics.ingest._connection import get_ingest_connection
from polymer_genomics.ingest._transaction import ingest_transaction

BATCH_SIZE = 10_000

COLUMNS: list[str] = [
    "layer_id", "build",
    "chr_id", "start_pos", "end_pos",
    "tf_name", "cell_type",
    "signal_value", "p_value", "q_value", "peak_offset",
    "experiment_id",
]

# Directory containing downloaded narrowPeak.gz files
DEFAULT_DATA_DIR = "/Users/zbb2/Desktop/PolymerGenomicsAPI/data/downloads/tfbs"


def read_narrowpeak(
    bed_path: str | Path,
    tf_name: str,
    cell_type: str,
    experiment_id: str | None = None,
) -> list[dict]:
    """Parse an ENCODE narrowPeak BED file.

    narrowPeak format (10 columns):
        chr, start, end, name, score, strand, signalValue, pValue, qValue, peak

    Coordinates are 0-based half-open (BED format = internal DB format).
    """
    path = Path(bed_path)
    rows: list[dict] = []

    opener = gzip.open if path.name.endswith(".gz") else open
    with opener(path, "rt") as f:
        for line in f:
            if line.startswith("#") or line.startswith("track") or line.startswith("browser"):
                continue
            fields = line.rstrip("\n").split("\t")
            if len(fields) < 10:
                continue

            chrom = fields[0]
            chr_id = CHR_NAME_TO_ID.get(chrom)
            if chr_id is None:
                continue

            try:
                start = int(fields[1])
                end = int(fields[2])
                signal = float(fields[6]) if fields[6] != "." else None
                pval = float(fields[7]) if fields[7] != "-1" and fields[7] != "." else None
                qval = float(fields[8]) if fields[8] != "-1" and fields[8] != "." else None
                peak = int(fields[9]) if fields[9] != "-1" else None
            except ValueError:
                continue

            rows.append({
                "chr_id": chr_id,
                "start_pos": start,
                "end_pos": end,
                "tf_name": tf_name,
                "cell_type": cell_type,
                "signal_value": signal,
                "p_value": pval,
                "q_value": qval,
                "peak_offset": peak,
                "experiment_id": experiment_id,
            })

    return rows


def discover_files(data_dir: str | Path) -> list[tuple[Path, str, str, str | None]]:
    """Discover narrowPeak files and extract TF name + cell type from filename.

    Expected naming: <TF>_<CELLTYPE>.narrowPeak.gz  or  <TF>_<CELLTYPE>_<ENCID>.narrowPeak.gz
    Returns list of (path, tf_name, cell_type, experiment_id).
    """
    data_path = Path(data_dir)
    files: list[tuple[Path, str, str, str | None]] = []

    for f in sorted(data_path.glob("*.narrowPeak*")):
        stem = f.name.split(".narrowPeak")[0]
        parts = stem.split("_")
        if len(parts) >= 2:
            tf_name = parts[0]
            cell_type = parts[1]
            exp_id = parts[2] if len(parts) >= 3 else None
            files.append((f, tf_name, cell_type, exp_id))
        else:
            print(f"  WARNING: skipping {f.name} (cannot parse TF_CELLTYPE)")

    return files


async def register_layer(conn: asyncpg.Connection, build: str) -> str:
    layer_key = "encode_tfbs_v1"
    version = f"1.0.{build}"

    existing = await conn.fetchval(
        "SELECT id FROM registry.layers WHERE layer_key = $1 AND version = $2",
        layer_key, version,
    )
    if existing is not None:
        print(f"  Layer already registered: {layer_key} -> {existing}")
        return existing

    layer_id = await conn.fetchval(
        """INSERT INTO registry.layers
            (layer_key, version, name, layer_type, genome_build,
             source, license_class, storage_type, is_active, is_default)
           VALUES ($1, $2, $3, 'tfbs', $4,
                   'ENCODE TF ChIP-seq (ENCODE Consortium 2020 Nature 583:699)',
                   'cc_by_4', 'postgres', true, true)
           RETURNING id""",
        layer_key, version, f"ENCODE TFBS ChIP-seq Peaks ({build})", build,
    )
    print(f"  Registered layer: {layer_key} -> {layer_id}")
    return layer_id


def _build_row(layer_id: str, build: str, rec: dict) -> tuple:
    return (
        layer_id, build,
        rec["chr_id"], rec["start_pos"], rec["end_pos"],
        rec["tf_name"], rec["cell_type"],
        rec["signal_value"], rec["p_value"], rec["q_value"], rec["peak_offset"],
        rec["experiment_id"],
    )


async def main(builds: list[str] | None = None) -> None:
    if builds is None:
        builds = ["hg38"]

    data_dir = os.environ.get("TFBS_DIR", DEFAULT_DATA_DIR)

    if not Path(data_dir).is_dir():
        print(f"ERROR: TFBS data directory not found: {data_dir}")
        print("Download ENCODE narrowPeak files to data/downloads/tfbs/")
        print("Naming: <TF>_<CELLTYPE>.narrowPeak.gz")
        return

    files = discover_files(data_dir)
    if not files:
        print(f"ERROR: No narrowPeak files found in {data_dir}")
        return

    print(f"Found {len(files)} narrowPeak files")

    conn = await get_ingest_connection(admin=True)
    try:
        for build in builds:
            print(f"\n{'='*60}")
            print(f"Ingesting ENCODE TFBS Peaks - {build}")
            print(f"{'='*60}")

            layer_id = await register_layer(conn, build)

            existing = await conn.fetchval(
                "SELECT count(*) FROM regulatory.tfbs_peaks WHERE layer_id = $1",
                layer_id,
            )
            if existing > 0:
                print(f"  Already loaded: {existing:,} rows. Skipping.")
                continue

            grand_total = 0
            async with ingest_transaction(conn):
                for filepath, tf_name, cell_type, exp_id in files:
                    print(f"\n  {tf_name} / {cell_type}...", end="", flush=True)
                    records = read_narrowpeak(filepath, tf_name, cell_type, exp_id)
                    print(f" {len(records):,} peaks")

                    batch: list[tuple] = []
                    file_total = 0
                    for rec in records:
                        batch.append(_build_row(layer_id, build, rec))
                        if len(batch) >= BATCH_SIZE:
                            await conn.copy_records_to_table(
                                "tfbs_peaks", records=batch,
                                columns=COLUMNS, schema_name="regulatory",
                            )
                            file_total += len(batch)
                            batch = []
                    if batch:
                        await conn.copy_records_to_table(
                            "tfbs_peaks", records=batch,
                            columns=COLUMNS, schema_name="regulatory",
                        )
                        file_total += len(batch)

                    grand_total += file_total

            print(f"\n  Total TFBS peaks loaded: {grand_total:,}")

        print("\nDone.")
    finally:
        await conn.close()


def cli() -> None:
    parser = argparse.ArgumentParser(description="Ingest ENCODE TFBS ChIP-seq peaks")
    parser.add_argument("--build", choices=["hg38", "hg37"], default=None)
    args = parser.parse_args()
    asyncio.run(main([args.build] if args.build else None))


if __name__ == "__main__":
    cli()
```

- [ ] **Step 2: Commit**

```bash
git add src/polymer_genomics/ingest/tfbs_peaks.py
git commit -m "feat: add TFBS peaks ingestion module"
```

---

## Task 4: ENCODE TFBS — Query + Registry + License

**Files:**
- Modify: `src/polymer_genomics/queries/regulatory.py` — append after `_convert_enhancer_gene`
- Modify: `src/polymer_genomics/queries/_registry.py` — add import + registry entry
- Modify: `src/polymer_genomics/layer_licenses.py` — add entry

- [ ] **Step 1: Add query and converter to `regulatory.py`**

Append to the end of `src/polymer_genomics/queries/regulatory.py`:

```python
# ---------------------------------------------------------------------------
# TFBS peaks (ENCODE TF ChIP-seq)
# ---------------------------------------------------------------------------


def region_tfbs_query() -> str:
    """ENCODE transcription factor binding site ChIP-seq peaks."""
    return """
        SELECT t.start_pos, t.end_pos,
               t.tf_name, t.cell_type,
               t.signal_value, t.p_value, t.q_value,
               t.peak_offset, t.experiment_id
        FROM regulatory.tfbs_peaks t
        WHERE t.build = $1::genome_build
          AND t.chr_id = $2
          AND t.coord && int4range($3, $4)
          AND t.layer_id = $5
        ORDER BY t.start_pos
        LIMIT $6
    """


def _convert_tfbs(rows: list, chr_name: str) -> dict:
    starts, ends, widths = [], [], []
    tf_names, cell_types = [], []
    signals, pvals, qvals, offsets, exp_ids = [], [], [], [], []
    for r in rows:
        api = db_to_api(r["start_pos"], r["end_pos"])
        starts.append(api["start"])
        ends.append(api["end"])
        widths.append(api["width"])
        tf_names.append(r["tf_name"])
        cell_types.append(r["cell_type"])
        signals.append(r["signal_value"])
        pvals.append(r["p_value"])
        qvals.append(r["q_value"])
        offsets.append(r["peak_offset"])
        exp_ids.append(r["experiment_id"])
    return {
        "class": "GRanges",
        "seqnames": [chr_name] * len(rows),
        "ranges": {"start": starts, "end": ends, "width": widths},
        "strand": ["*"] * len(rows),
        "mcols": {
            "tf_name": tf_names, "cell_type": cell_types,
            "signal_value": signals, "p_value": pvals,
            "q_value": qvals, "peak_offset": offsets,
            "experiment_id": exp_ids,
        },
        "n": len(rows),
    }
```

- [ ] **Step 2: Add import to `_registry.py`**

In `src/polymer_genomics/queries/_registry.py`, add to the `from polymer_genomics.queries.regulatory import` block:

```python
    region_tfbs_query, _convert_tfbs,
```

- [ ] **Step 3: Add registry entry to `_registry.py`**

In the `TRACK_REGISTRY` dict in `_registry.py`, add after the `"enhancer_gene"` entry:

```python
    "tfbs": {
        "query_fn": region_tfbs_query,
        "convert_fn": _convert_tfbs,
    },
```

- [ ] **Step 4: Add license entry**

In `src/polymer_genomics/layer_licenses.py`, add to `LAYER_SOURCE_INFO`:

```python
    "tfbs": {"source": "ENCODE TF ChIP-seq (ENCODE Consortium 2020)", "license": "CC BY 4.0"},
```

- [ ] **Step 5: Commit**

```bash
git add src/polymer_genomics/queries/regulatory.py src/polymer_genomics/queries/_registry.py src/polymer_genomics/layer_licenses.py
git commit -m "feat: add TFBS query, registry entry, and license"
```

---

## Task 5: gnomAD SVs — Migration

**Files:**
- Create: `docker/postgres/migrations/066_gnomad_sv.sql`

- [ ] **Step 1: Write the migration SQL**

```sql
-- 066_gnomad_sv.sql
-- gnomAD v4 structural variants.
-- ~800K SVs with allele frequency, type, and consequence annotations.
-- Source: gnomad.broadinstitute.org, ODC-ODbL 1.0.

BEGIN;
ALTER TYPE layer_type ADD VALUE IF NOT EXISTS 'structural_variant';
COMMIT;

BEGIN;

CREATE TABLE IF NOT EXISTS variation.structural_variants (
    id              bigint GENERATED ALWAYS AS IDENTITY,
    layer_id        uuid NOT NULL REFERENCES registry.layers(id),
    build           genome_build NOT NULL,
    chr_id          smallint NOT NULL REFERENCES ref.chromosomes(chr_id),
    start_pos       int NOT NULL,
    end_pos         int NOT NULL,
    coord           int4range GENERATED ALWAYS AS (int4range(start_pos, end_pos)) STORED,
    sv_id           text,
    sv_type         text NOT NULL,          -- DEL, DUP, INV, INS, BND, CNV, CPX
    sv_length       int,                    -- absolute length (NULL for BND)
    allele_count    int,
    allele_number   int,
    allele_freq     real,
    homozygote_count int,
    popmax_af       real,                   -- max AF across populations
    popmax_pop      text,                   -- population with max AF
    filter_status   text,                   -- PASS or filter name
    consequence     text,                   -- most severe VEP consequence
    gene_symbol     text,                   -- affected gene (if any)
    PRIMARY KEY (build, chr_id, id)
) PARTITION BY LIST (build);

CREATE TABLE IF NOT EXISTS variation.structural_variants_hg38
    PARTITION OF variation.structural_variants FOR VALUES IN ('hg38')
    PARTITION BY LIST (chr_id);

DO $$ BEGIN
FOR i IN 1..25 LOOP
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS variation.structural_variants_hg38_chr%s
         PARTITION OF variation.structural_variants_hg38 FOR VALUES IN (%s)',
        i, i
    );
END LOOP;
END $$;

CREATE INDEX IF NOT EXISTS idx_sv_range
    ON variation.structural_variants USING GiST (chr_id, coord);
CREATE INDEX IF NOT EXISTS idx_sv_type
    ON variation.structural_variants (sv_type);
CREATE INDEX IF NOT EXISTS idx_sv_gene
    ON variation.structural_variants (gene_symbol);
CREATE INDEX IF NOT EXISTS idx_sv_layer_build
    ON variation.structural_variants (layer_id, build);

GRANT SELECT ON ALL TABLES IN SCHEMA variation TO api_reader;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA variation TO ingest_writer;

COMMIT;
```

- [ ] **Step 2: Run migration against local Docker DB**

```bash
cd /Users/zbb2/Desktop/PolymerGenomicsAPI
docker compose exec postgres psql -U admin -d polymer_genomics -f /docker-entrypoint-initdb.d/migrations/066_gnomad_sv.sql
```

Expected: No errors.

- [ ] **Step 3: Verify**

```bash
docker compose exec postgres psql -U admin -d polymer_genomics -c "\d variation.structural_variants"
```

- [ ] **Step 4: Commit**

```bash
git add docker/postgres/migrations/066_gnomad_sv.sql
git commit -m "feat: add gnomAD structural variants migration (066)"
```

---

## Task 6: gnomAD SVs — Ingestion Script

**Files:**
- Create: `src/polymer_genomics/ingest/gnomad_sv.py`

gnomAD v4 SVs are distributed as a single VCF (sites-only). Key INFO fields: SVTYPE, SVLEN, AC, AN, AF, N_HOMALT, POPMAX_AF, POPMAX, FILTER, CSQ (VEP).

- [ ] **Step 1: Write the ingestion module**

```python
"""gnomAD v4 structural variant ingestion into variation.structural_variants.

Parses the gnomAD v4 SV sites VCF (GRCh38). Keeps all PASS + non-PASS SVs
for completeness (filter_status stored for downstream filtering).

Source: https://gnomad.broadinstitute.org/downloads#v4-structural-variants
Download: gnomad.v4.1.sv.sites.vcf.gz (~1.2 GB)

Usage::

    uv run python -m polymer_genomics.ingest.gnomad_sv
    GNOMAD_SV_FILE=/path/to/file.vcf.gz uv run python -m polymer_genomics.ingest.gnomad_sv
"""

from __future__ import annotations

import argparse
import asyncio
import gzip
import os
from pathlib import Path

import asyncpg

from polymer_genomics.constants import CHR_NAME_TO_ID
from polymer_genomics.ingest._connection import get_ingest_connection
from polymer_genomics.ingest._transaction import ingest_transaction

BATCH_SIZE = 10_000

COLUMNS: list[str] = [
    "layer_id", "build",
    "chr_id", "start_pos", "end_pos",
    "sv_id", "sv_type", "sv_length",
    "allele_count", "allele_number", "allele_freq", "homozygote_count",
    "popmax_af", "popmax_pop", "filter_status",
    "consequence", "gene_symbol",
]

GNOMAD_SV_URL = "https://storage.googleapis.com/gcp-public-data--gnomad/release/4.1/genome_sv/gnomad.v4.1.sv.sites.vcf.gz"

_VCF_CHR_MAP: dict[str, int] = {}
for _i in range(1, 23):
    _VCF_CHR_MAP[f"chr{_i}"] = CHR_NAME_TO_ID[f"chr{_i}"]
    _VCF_CHR_MAP[str(_i)] = CHR_NAME_TO_ID[f"chr{_i}"]
_VCF_CHR_MAP["chrX"] = CHR_NAME_TO_ID["chrX"]
_VCF_CHR_MAP["X"] = CHR_NAME_TO_ID["chrX"]
_VCF_CHR_MAP["chrY"] = CHR_NAME_TO_ID["chrY"]
_VCF_CHR_MAP["Y"] = CHR_NAME_TO_ID["chrY"]


def _parse_info(info_str: str) -> dict[str, str]:
    """Parse VCF INFO field into a dict."""
    result: dict[str, str] = {}
    for item in info_str.split(";"):
        if "=" in item:
            k, v = item.split("=", 1)
            result[k] = v
        else:
            result[item] = ""
    return result


def _safe_int(val: str | None) -> int | None:
    if not val:
        return None
    try:
        return int(val)
    except ValueError:
        return None


def _safe_float(val: str | None) -> float | None:
    if not val:
        return None
    try:
        return float(val)
    except ValueError:
        return None


def _extract_vep_gene(csq: str | None) -> tuple[str | None, str | None]:
    """Extract most severe consequence and gene from VEP CSQ field.

    CSQ format: Allele|Consequence|IMPACT|SYMBOL|Gene|...
    Returns (consequence, gene_symbol).
    """
    if not csq:
        return None, None
    first_transcript = csq.split(",")[0]
    parts = first_transcript.split("|")
    consequence = parts[1] if len(parts) > 1 else None
    gene = parts[3] if len(parts) > 3 and parts[3] else None
    return consequence, gene


def read_gnomad_sv_vcf(vcf_path: str | Path) -> list[dict]:
    """Parse gnomAD SV VCF."""
    rows: list[dict] = []
    skipped_chr = 0

    opener = gzip.open if str(vcf_path).endswith(".gz") else open

    with opener(vcf_path, "rt") as f:
        for line in f:
            if line.startswith("#"):
                continue

            fields = line.rstrip("\n").split("\t")
            if len(fields) < 8:
                continue

            chrom, pos_str, sv_id, _ref, _alt, _qual, filt, info_str = fields[:8]

            chr_id = _VCF_CHR_MAP.get(chrom)
            if chr_id is None:
                skipped_chr += 1
                continue

            info = _parse_info(info_str)

            sv_type = info.get("SVTYPE", "UNK")

            # Coordinates: VCF POS is 1-based → 0-based half-open
            pos = _safe_int(pos_str)
            if pos is None:
                continue
            start_pos = pos - 1

            # END from INFO (or compute from SVLEN)
            end_raw = _safe_int(info.get("END"))
            svlen_raw = _safe_int(info.get("SVLEN"))
            sv_length = abs(svlen_raw) if svlen_raw is not None else None

            if end_raw is not None:
                end_pos = end_raw  # VCF END is 1-based inclusive → 0-based half-open is same numeric value
            elif sv_length is not None:
                end_pos = start_pos + sv_length
            else:
                end_pos = start_pos + 1  # point variant fallback (BND)

            consequence, gene_symbol = _extract_vep_gene(info.get("CSQ"))

            rows.append({
                "chr_id": chr_id,
                "start_pos": start_pos,
                "end_pos": end_pos,
                "sv_id": sv_id if sv_id != "." else None,
                "sv_type": sv_type,
                "sv_length": sv_length,
                "allele_count": _safe_int(info.get("AC")),
                "allele_number": _safe_int(info.get("AN")),
                "allele_freq": _safe_float(info.get("AF")),
                "homozygote_count": _safe_int(info.get("N_HOMALT") or info.get("nhomalt")),
                "popmax_af": _safe_float(info.get("POPMAX_AF") or info.get("popmax_AF")),
                "popmax_pop": info.get("POPMAX") or info.get("popmax") or None,
                "filter_status": filt,
                "consequence": consequence,
                "gene_symbol": gene_symbol,
            })

    print(f"  Parsed {len(rows):,} structural variants")
    print(f"  Skipped: {skipped_chr:,} (unrecognized chr)")
    return rows


async def register_layer(conn: asyncpg.Connection, build: str) -> str:
    layer_key = "gnomad_sv_v4"
    version = f"4.1.{build}"

    existing = await conn.fetchval(
        "SELECT id FROM registry.layers WHERE layer_key = $1 AND version = $2",
        layer_key, version,
    )
    if existing is not None:
        print(f"  Layer already registered: {layer_key} -> {existing}")
        return existing

    layer_id = await conn.fetchval(
        """INSERT INTO registry.layers
            (layer_key, version, name, layer_type, genome_build,
             source, license_class, storage_type, is_active, is_default)
           VALUES ($1, $2, $3, 'structural_variant', $4,
                   'gnomAD v4.1 Structural Variants (Collins et al. 2020 Nature 581:444)',
                   'odc_odbl', 'postgres', true, true)
           RETURNING id""",
        layer_key, version, f"gnomAD v4.1 Structural Variants ({build})", build,
    )
    print(f"  Registered layer: {layer_key} -> {layer_id}")
    return layer_id


def _build_row(layer_id: str, build: str, rec: dict) -> tuple:
    return (
        layer_id, build,
        rec["chr_id"], rec["start_pos"], rec["end_pos"],
        rec["sv_id"], rec["sv_type"], rec["sv_length"],
        rec["allele_count"], rec["allele_number"], rec["allele_freq"],
        rec["homozygote_count"],
        rec["popmax_af"], rec["popmax_pop"], rec["filter_status"],
        rec["consequence"], rec["gene_symbol"],
    )


async def main(builds: list[str] | None = None) -> None:
    if builds is None:
        builds = ["hg38"]

    vcf_path = os.environ.get(
        "GNOMAD_SV_FILE",
        "/Users/zbb2/Desktop/PolymerGenomicsAPI/data/downloads/gnomad.v4.1.sv.sites.vcf.gz",
    )

    if not Path(vcf_path).is_file():
        print(f"ERROR: gnomAD SV VCF not found at {vcf_path}")
        print(f"Download from: {GNOMAD_SV_URL}")
        return

    conn = await get_ingest_connection(admin=True)
    try:
        for build in builds:
            print(f"\n{'='*60}")
            print(f"Ingesting gnomAD v4.1 SVs - {build}")
            print(f"{'='*60}")

            layer_id = await register_layer(conn, build)

            existing = await conn.fetchval(
                "SELECT count(*) FROM variation.structural_variants WHERE layer_id = $1",
                layer_id,
            )
            if existing > 0:
                print(f"  Already loaded: {existing:,} rows. Skipping.")
                continue

            print(f"\n  Reading gnomAD SV VCF: {vcf_path}")
            records = read_gnomad_sv_vcf(vcf_path)
            if not records:
                print("  ERROR: No records parsed")
                continue

            total = 0
            batch: list[tuple] = []
            async with ingest_transaction(conn):
                for rec in records:
                    batch.append(_build_row(layer_id, build, rec))
                    if len(batch) >= BATCH_SIZE:
                        await conn.copy_records_to_table(
                            "structural_variants", records=batch,
                            columns=COLUMNS, schema_name="variation",
                        )
                        total += len(batch)
                        if total % 100_000 == 0:
                            print(f"    Loaded {total:,}...", flush=True)
                        batch = []
                if batch:
                    await conn.copy_records_to_table(
                        "structural_variants", records=batch,
                        columns=COLUMNS, schema_name="variation",
                    )
                    total += len(batch)

            print(f"\n  Total SVs loaded: {total:,}")

        print("\nDone.")
    finally:
        await conn.close()


def cli() -> None:
    parser = argparse.ArgumentParser(description="Ingest gnomAD v4.1 structural variants")
    parser.add_argument("--build", choices=["hg38", "hg37"], default=None)
    args = parser.parse_args()
    asyncio.run(main([args.build] if args.build else None))


if __name__ == "__main__":
    cli()
```

- [ ] **Step 2: Commit**

```bash
git add src/polymer_genomics/ingest/gnomad_sv.py
git commit -m "feat: add gnomAD SV ingestion module"
```

---

## Task 7: gnomAD SVs — Query + Registry + License

**Files:**
- Create: `src/polymer_genomics/queries/structural_variation.py`
- Modify: `src/polymer_genomics/queries/_registry.py`
- Modify: `src/polymer_genomics/layer_licenses.py`

- [ ] **Step 1: Create query module**

```python
"""Structural variant queries: gnomAD SVs."""

from polymer_genomics.queries._common import db_to_api


def region_structural_variant_query() -> str:
    """gnomAD v4.1 structural variants."""
    return """
        SELECT sv.start_pos, sv.end_pos,
               sv.sv_id, sv.sv_type, sv.sv_length,
               sv.allele_count, sv.allele_number, sv.allele_freq,
               sv.homozygote_count,
               sv.popmax_af, sv.popmax_pop, sv.filter_status,
               sv.consequence, sv.gene_symbol
        FROM variation.structural_variants sv
        WHERE sv.build = $1::genome_build
          AND sv.chr_id = $2
          AND sv.coord && int4range($3, $4)
          AND sv.layer_id = $5
        ORDER BY sv.start_pos
        LIMIT $6
    """


def _convert_structural_variant(rows: list, chr_name: str) -> dict:
    starts, ends, widths = [], [], []
    sv_ids, sv_types, sv_lengths = [], [], []
    acs, ans, afs, homs = [], [], [], []
    popmax_afs, popmax_pops, filters = [], [], []
    consequences, genes = [], []
    for r in rows:
        api = db_to_api(r["start_pos"], r["end_pos"])
        starts.append(api["start"])
        ends.append(api["end"])
        widths.append(api["width"])
        sv_ids.append(r["sv_id"])
        sv_types.append(r["sv_type"])
        sv_lengths.append(r["sv_length"])
        acs.append(r["allele_count"])
        ans.append(r["allele_number"])
        afs.append(r["allele_freq"])
        homs.append(r["homozygote_count"])
        popmax_afs.append(r["popmax_af"])
        popmax_pops.append(r["popmax_pop"])
        filters.append(r["filter_status"])
        consequences.append(r["consequence"])
        genes.append(r["gene_symbol"])
    return {
        "class": "GRanges",
        "seqnames": [chr_name] * len(rows),
        "ranges": {"start": starts, "end": ends, "width": widths},
        "strand": ["*"] * len(rows),
        "mcols": {
            "sv_id": sv_ids, "sv_type": sv_types, "sv_length": sv_lengths,
            "allele_count": acs, "allele_number": ans, "allele_freq": afs,
            "homozygote_count": homs,
            "popmax_af": popmax_afs, "popmax_pop": popmax_pops,
            "filter_status": filters,
            "consequence": consequences, "gene_symbol": genes,
        },
        "n": len(rows),
    }
```

- [ ] **Step 2: Add import + registry entry in `_registry.py`**

Add import block:

```python
from polymer_genomics.queries.structural_variation import (
    region_structural_variant_query, _convert_structural_variant,
)
```

Add to `TRACK_REGISTRY`:

```python
    "structural_variant": {
        "query_fn": region_structural_variant_query,
        "convert_fn": _convert_structural_variant,
    },
```

- [ ] **Step 3: Add license entry**

```python
    "structural_variant": {"source": "gnomAD v4.1 SVs (Collins et al. 2020)", "license": "ODC-ODbL 1.0"},
```

- [ ] **Step 4: Commit**

```bash
git add src/polymer_genomics/queries/structural_variation.py src/polymer_genomics/queries/_registry.py src/polymer_genomics/layer_licenses.py
git commit -m "feat: add gnomAD SV query, registry entry, and license"
```

---

## Task 8: TCGA Pan-Cancer — Migration

**Files:**
- Create: `docker/postgres/migrations/067_tcga_pan_cancer.sql`

This stores **per-probe summary statistics** (mean delta-beta, p-value, direction) for each TCGA cancer type. One row per (probe × cancer_type) pair. This is the summary layer, not raw betas.

- [ ] **Step 1: Write the migration SQL**

```sql
-- 067_tcga_pan_cancer.sql
-- TCGA Pan-Cancer methylation summaries.
-- Pre-computed tumor vs normal delta-betas per probe per cancer type.
-- ~485K probes × 33 cancer types = ~16M rows.
-- Source: GDC / UCSC Xena (Goldman et al. 2020 Nature Biotechnology).

BEGIN;
ALTER TYPE layer_type ADD VALUE IF NOT EXISTS 'tcga_methylation';
COMMIT;

BEGIN;

CREATE SCHEMA IF NOT EXISTS methylation;
GRANT USAGE ON SCHEMA methylation TO api_reader, ingest_writer;
ALTER DEFAULT PRIVILEGES IN SCHEMA methylation
    GRANT SELECT ON TABLES TO api_reader;
ALTER DEFAULT PRIVILEGES IN SCHEMA methylation
    GRANT SELECT, INSERT, UPDATE ON TABLES TO ingest_writer;

CREATE TABLE IF NOT EXISTS methylation.tcga_pan_cancer (
    id              bigint GENERATED ALWAYS AS IDENTITY,
    layer_id        uuid NOT NULL REFERENCES registry.layers(id),
    build           genome_build NOT NULL,
    chr_id          smallint NOT NULL REFERENCES ref.chromosomes(chr_id),
    start_pos       int NOT NULL,
    end_pos         int NOT NULL,
    coord           int4range GENERATED ALWAYS AS (int4range(start_pos, end_pos)) STORED,
    probe_id        text NOT NULL,
    cancer_type     text NOT NULL,          -- TCGA abbreviation (LAML, GBM, BRCA, etc.)
    n_tumor         smallint,
    n_normal        smallint,
    mean_tumor      real,                   -- mean beta in tumors
    mean_normal     real,                   -- mean beta in normals
    delta_beta      real NOT NULL,          -- mean_tumor - mean_normal
    p_value         real,                   -- Wilcoxon or t-test p-value
    fdr             real,                   -- BH-adjusted p-value
    direction       text NOT NULL,          -- 'hyper' or 'hypo'
    PRIMARY KEY (build, chr_id, id)
) PARTITION BY LIST (build);

CREATE TABLE IF NOT EXISTS methylation.tcga_pan_cancer_hg38
    PARTITION OF methylation.tcga_pan_cancer FOR VALUES IN ('hg38')
    PARTITION BY HASH (chr_id);

CREATE TABLE IF NOT EXISTS methylation.tcga_pan_cancer_hg38_p0
    PARTITION OF methylation.tcga_pan_cancer_hg38
    FOR VALUES WITH (MODULUS 4, REMAINDER 0);
CREATE TABLE IF NOT EXISTS methylation.tcga_pan_cancer_hg38_p1
    PARTITION OF methylation.tcga_pan_cancer_hg38
    FOR VALUES WITH (MODULUS 4, REMAINDER 1);
CREATE TABLE IF NOT EXISTS methylation.tcga_pan_cancer_hg38_p2
    PARTITION OF methylation.tcga_pan_cancer_hg38
    FOR VALUES WITH (MODULUS 4, REMAINDER 2);
CREATE TABLE IF NOT EXISTS methylation.tcga_pan_cancer_hg38_p3
    PARTITION OF methylation.tcga_pan_cancer_hg38
    FOR VALUES WITH (MODULUS 4, REMAINDER 3);

CREATE INDEX IF NOT EXISTS idx_tcga_pancan_range
    ON methylation.tcga_pan_cancer USING GiST (chr_id, coord);
CREATE INDEX IF NOT EXISTS idx_tcga_pancan_probe
    ON methylation.tcga_pan_cancer (probe_id);
CREATE INDEX IF NOT EXISTS idx_tcga_pancan_cancer
    ON methylation.tcga_pan_cancer (cancer_type);
CREATE INDEX IF NOT EXISTS idx_tcga_pancan_layer_build
    ON methylation.tcga_pan_cancer (layer_id, build);

GRANT SELECT ON ALL TABLES IN SCHEMA methylation TO api_reader;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA methylation TO ingest_writer;

COMMIT;
```

- [ ] **Step 2: Run migration locally**

```bash
docker compose exec postgres psql -U admin -d polymer_genomics -f /docker-entrypoint-initdb.d/migrations/067_tcga_pan_cancer.sql
```

- [ ] **Step 3: Verify**

```bash
docker compose exec postgres psql -U admin -d polymer_genomics -c "\d methylation.tcga_pan_cancer"
```

- [ ] **Step 4: Commit**

```bash
git add docker/postgres/migrations/067_tcga_pan_cancer.sql
git commit -m "feat: add TCGA pan-cancer methylation migration (067)"
```

---

## Task 9: TCGA Pan-Cancer — Ingestion Script

**Files:**
- Create: `src/polymer_genomics/ingest/tcga_pan_cancer.py`

Source: UCSC Xena provides pre-summarized tumor vs normal methylation per cancer type. The key file is `GDC-PANCAN.methylation450.tsv.gz` (450K probes × ~11K samples). We'll pre-compute delta-betas per cancer type during ingestion rather than storing raw betas.

Alternatively, Wanderer/MEXPRESS provide pre-computed summaries. For this ingestion, we use the Xena pan-cancer methylation matrix + phenotype file to compute per-cancer summaries on the fly.

The ingestion script expects pre-computed summary TSVs (one per cancer type) in `data/downloads/tcga_methylation/` with columns: `probe_id, n_tumor, n_normal, mean_tumor, mean_normal, delta_beta, p_value, fdr, direction`. A separate helper script (`scripts/compute_tcga_summaries.R`) generates these from raw Xena data.

- [ ] **Step 1: Write the ingestion module**

```python
"""TCGA Pan-Cancer methylation summary ingestion into methylation.tcga_pan_cancer.

Reads pre-computed per-cancer-type summary TSVs containing tumor vs normal
delta-betas for each probe. One TSV per cancer type in data/downloads/tcga_methylation/.

Expected TSV format (tab-separated, with header):
    probe_id  n_tumor  n_normal  mean_tumor  mean_normal  delta_beta  p_value  fdr  direction

Probe coordinates are resolved from the probe.coordinates table (must be loaded first).

Usage::

    uv run python -m polymer_genomics.ingest.tcga_pan_cancer
    uv run python -m polymer_genomics.ingest.tcga_pan_cancer --build hg38
"""

from __future__ import annotations

import argparse
import asyncio
import os
from pathlib import Path

import asyncpg

from polymer_genomics.ingest._connection import get_ingest_connection
from polymer_genomics.ingest._transaction import ingest_transaction

BATCH_SIZE = 50_000

COLUMNS: list[str] = [
    "layer_id", "build",
    "chr_id", "start_pos", "end_pos",
    "probe_id", "cancer_type",
    "n_tumor", "n_normal",
    "mean_tumor", "mean_normal", "delta_beta",
    "p_value", "fdr", "direction",
]

DEFAULT_DATA_DIR = "/Users/zbb2/Desktop/PolymerGenomicsAPI/data/downloads/tcga_methylation"

# 33 TCGA cancer types
TCGA_CANCER_TYPES = [
    "ACC", "BLCA", "BRCA", "CESC", "CHOL", "COAD", "DLBC", "ESCA",
    "GBM", "HNSC", "KICH", "KIRC", "KIRP", "LAML", "LGG", "LIHC",
    "LUAD", "LUSC", "MESO", "OV", "PAAD", "PCPG", "PRAD", "READ",
    "SARC", "SKCM", "STAD", "TGCT", "THCA", "THYM", "UCEC", "UCS", "UVM",
]


async def _load_probe_coords(
    conn: asyncpg.Connection, build: str,
) -> dict[str, tuple[int, int, int]]:
    """Load probe_id -> (chr_id, start_pos, end_pos) from probe.coordinates."""
    rows = await conn.fetch(
        """SELECT probe_id, chr_id, start_pos, end_pos
           FROM probe.coordinates
           WHERE build = $1::genome_build""",
        build,
    )
    return {r["probe_id"]: (r["chr_id"], r["start_pos"], r["end_pos"]) for r in rows}


def read_summary_tsv(tsv_path: str | Path) -> list[dict]:
    """Parse a per-cancer summary TSV."""
    rows: list[dict] = []
    with open(tsv_path) as f:
        header = f.readline().rstrip("\n").split("\t")
        col = {h.strip(): i for i, h in enumerate(header)}

        for line in f:
            fields = line.rstrip("\n").split("\t")
            if len(fields) < 6:
                continue

            try:
                delta_beta = float(fields[col["delta_beta"]])
            except (ValueError, KeyError):
                continue

            probe_id = fields[col["probe_id"]].strip()
            direction = fields[col.get("direction", -1)].strip() if "direction" in col else (
                "hyper" if delta_beta > 0 else "hypo"
            )

            def _get_float(name: str) -> float | None:
                if name not in col:
                    return None
                try:
                    return float(fields[col[name]])
                except (ValueError, IndexError):
                    return None

            def _get_int(name: str) -> int | None:
                if name not in col:
                    return None
                try:
                    return int(fields[col[name]])
                except (ValueError, IndexError):
                    return None

            rows.append({
                "probe_id": probe_id,
                "n_tumor": _get_int("n_tumor"),
                "n_normal": _get_int("n_normal"),
                "mean_tumor": _get_float("mean_tumor"),
                "mean_normal": _get_float("mean_normal"),
                "delta_beta": delta_beta,
                "p_value": _get_float("p_value"),
                "fdr": _get_float("fdr"),
                "direction": direction,
            })

    return rows


async def register_layer(conn: asyncpg.Connection, build: str) -> str:
    layer_key = "tcga_pan_cancer_meth_v1"
    version = f"1.0.{build}"

    existing = await conn.fetchval(
        "SELECT id FROM registry.layers WHERE layer_key = $1 AND version = $2",
        layer_key, version,
    )
    if existing is not None:
        print(f"  Layer already registered: {layer_key} -> {existing}")
        return existing

    layer_id = await conn.fetchval(
        """INSERT INTO registry.layers
            (layer_key, version, name, layer_type, genome_build,
             source, license_class, storage_type, is_active, is_default)
           VALUES ($1, $2, $3, 'tcga_methylation', $4,
                   'TCGA Pan-Cancer (GDC/Xena, Goldman et al. 2020 Nature Biotechnology)',
                   'open_access', 'postgres', true, true)
           RETURNING id""",
        layer_key, version, f"TCGA Pan-Cancer Methylation Summaries ({build})", build,
    )
    print(f"  Registered layer: {layer_key} -> {layer_id}")
    return layer_id


async def main(builds: list[str] | None = None) -> None:
    if builds is None:
        builds = ["hg38"]

    data_dir = os.environ.get("TCGA_METH_DIR", DEFAULT_DATA_DIR)

    if not Path(data_dir).is_dir():
        print(f"ERROR: TCGA methylation directory not found: {data_dir}")
        print("Expected: one TSV per cancer type, e.g. LAML.tsv, GBM.tsv, ...")
        return

    conn = await get_ingest_connection(admin=True)
    try:
        for build in builds:
            print(f"\n{'='*60}")
            print(f"Ingesting TCGA Pan-Cancer Methylation - {build}")
            print(f"{'='*60}")

            layer_id = await register_layer(conn, build)

            existing = await conn.fetchval(
                "SELECT count(*) FROM methylation.tcga_pan_cancer WHERE layer_id = $1",
                layer_id,
            )
            if existing > 0:
                print(f"  Already loaded: {existing:,} rows. Skipping.")
                continue

            # Load probe coordinates for coordinate resolution
            print("  Loading probe coordinates...")
            probe_coords = await _load_probe_coords(conn, build)
            print(f"  {len(probe_coords):,} probes with coordinates")

            grand_total = 0
            skipped_probes = 0

            async with ingest_transaction(conn):
                for cancer_type in TCGA_CANCER_TYPES:
                    tsv_path = Path(data_dir) / f"{cancer_type}.tsv"
                    if not tsv_path.is_file():
                        # Try .tsv.gz
                        tsv_path = Path(data_dir) / f"{cancer_type}.tsv.gz"
                    if not tsv_path.is_file():
                        print(f"  WARNING: {cancer_type}.tsv not found, skipping")
                        continue

                    print(f"\n  {cancer_type}...", end="", flush=True)
                    records = read_summary_tsv(tsv_path)
                    print(f" {len(records):,} probes", end="", flush=True)

                    batch: list[tuple] = []
                    cancer_total = 0
                    cancer_skipped = 0

                    for rec in records:
                        coords = probe_coords.get(rec["probe_id"])
                        if coords is None:
                            cancer_skipped += 1
                            continue

                        chr_id, start_pos, end_pos = coords
                        row = (
                            layer_id, build,
                            chr_id, start_pos, end_pos,
                            rec["probe_id"], cancer_type,
                            rec["n_tumor"], rec["n_normal"],
                            rec["mean_tumor"], rec["mean_normal"], rec["delta_beta"],
                            rec["p_value"], rec["fdr"], rec["direction"],
                        )
                        batch.append(row)

                        if len(batch) >= BATCH_SIZE:
                            await conn.copy_records_to_table(
                                "tcga_pan_cancer", records=batch,
                                columns=COLUMNS, schema_name="methylation",
                            )
                            cancer_total += len(batch)
                            batch = []

                    if batch:
                        await conn.copy_records_to_table(
                            "tcga_pan_cancer", records=batch,
                            columns=COLUMNS, schema_name="methylation",
                        )
                        cancer_total += len(batch)

                    skipped_probes += cancer_skipped
                    grand_total += cancer_total
                    print(f" -> {cancer_total:,} loaded ({cancer_skipped:,} no coords)")

            print(f"\n\n  Total loaded: {grand_total:,}")
            print(f"  Total skipped (no probe coords): {skipped_probes:,}")

        print("\nDone.")
    finally:
        await conn.close()


def cli() -> None:
    parser = argparse.ArgumentParser(description="Ingest TCGA pan-cancer methylation summaries")
    parser.add_argument("--build", choices=["hg38", "hg37"], default=None)
    args = parser.parse_args()
    asyncio.run(main([args.build] if args.build else None))


if __name__ == "__main__":
    cli()
```

- [ ] **Step 2: Commit**

```bash
git add src/polymer_genomics/ingest/tcga_pan_cancer.py
git commit -m "feat: add TCGA pan-cancer methylation ingestion module"
```

---

## Task 10: TCGA Pan-Cancer — Query + Registry + License

**Files:**
- Create: `src/polymer_genomics/queries/tcga.py`
- Modify: `src/polymer_genomics/queries/_registry.py`
- Modify: `src/polymer_genomics/layer_licenses.py`

- [ ] **Step 1: Create query module**

```python
"""TCGA Pan-Cancer methylation queries."""

from polymer_genomics.queries._common import db_to_api


def region_tcga_methylation_query() -> str:
    """TCGA pan-cancer tumor vs normal methylation summaries."""
    return """
        SELECT tc.start_pos, tc.end_pos,
               tc.probe_id, tc.cancer_type,
               tc.n_tumor, tc.n_normal,
               tc.mean_tumor, tc.mean_normal, tc.delta_beta,
               tc.p_value, tc.fdr, tc.direction
        FROM methylation.tcga_pan_cancer tc
        WHERE tc.build = $1::genome_build
          AND tc.chr_id = $2
          AND tc.coord && int4range($3, $4)
          AND tc.layer_id = $5
        ORDER BY tc.start_pos
        LIMIT $6
    """


def _convert_tcga_methylation(rows: list, chr_name: str) -> dict:
    starts, ends, widths = [], [], []
    probes, cancers = [], []
    n_tumors, n_normals = [], []
    mean_tumors, mean_normals, delta_betas = [], [], []
    pvals, fdrs, directions = [], [], []
    for r in rows:
        api = db_to_api(r["start_pos"], r["end_pos"])
        starts.append(api["start"])
        ends.append(api["end"])
        widths.append(api["width"])
        probes.append(r["probe_id"])
        cancers.append(r["cancer_type"])
        n_tumors.append(r["n_tumor"])
        n_normals.append(r["n_normal"])
        mean_tumors.append(r["mean_tumor"])
        mean_normals.append(r["mean_normal"])
        delta_betas.append(r["delta_beta"])
        pvals.append(r["p_value"])
        fdrs.append(r["fdr"])
        directions.append(r["direction"])
    return {
        "class": "GRanges",
        "seqnames": [chr_name] * len(rows),
        "ranges": {"start": starts, "end": ends, "width": widths},
        "strand": ["*"] * len(rows),
        "mcols": {
            "probe_id": probes, "cancer_type": cancers,
            "n_tumor": n_tumors, "n_normal": n_normals,
            "mean_tumor": mean_tumors, "mean_normal": mean_normals,
            "delta_beta": delta_betas,
            "p_value": pvals, "fdr": fdrs, "direction": directions,
        },
        "n": len(rows),
    }
```

- [ ] **Step 2: Add import + registry entry in `_registry.py`**

Add import block:

```python
from polymer_genomics.queries.tcga import (
    region_tcga_methylation_query, _convert_tcga_methylation,
)
```

Add to `TRACK_REGISTRY`:

```python
    "tcga_methylation": {
        "query_fn": region_tcga_methylation_query,
        "convert_fn": _convert_tcga_methylation,
    },
```

- [ ] **Step 3: Add license entry**

```python
    "tcga_methylation": {"source": "TCGA Pan-Cancer (GDC/Xena)", "license": "Open access"},
```

- [ ] **Step 4: Commit**

```bash
git add src/polymer_genomics/queries/tcga.py src/polymer_genomics/queries/_registry.py src/polymer_genomics/layer_licenses.py
git commit -m "feat: add TCGA pan-cancer methylation query, registry, and license"
```

---

## Task 11: ABC Enhancer-Gene Links — Download Data and Ingest

The schema, ingestion script, query, and registry entry all already exist. This task only needs the source data downloaded and the existing script run.

**Files:** None (data download + existing script execution)

- [ ] **Step 1: Download ABC predictions**

```bash
mkdir -p /Users/zbb2/Desktop/PolymerGenomicsAPI/data/downloads
# Nasser et al. 2021 ABC predictions (hg19, ~400 MB)
curl -L -o /Users/zbb2/Desktop/PolymerGenomicsAPI/data/downloads/abc_predictions.txt.gz \
    "https://mitra.stanford.edu/engreitz/oak/public/Nasser2021/AllPredictions.AvgHiC.ABC0.015.minus150.ForABCPaperV3.txt.gz"
```

- [ ] **Step 2: Ensure liftOver binary is available**

```bash
# Check if liftOver exists
ls /tmp/liftOver 2>/dev/null || (
    curl -L -o /tmp/liftOver https://hgdownload.cse.ucsc.edu/admin/exe/macOSX.x86_64/liftOver &&
    chmod +x /tmp/liftOver
)

# Check if chain file exists
ls /Users/zbb2/Desktop/PolymerGenomicsAPI/data/downloads/hg19ToHg38.over.chain.gz 2>/dev/null || (
    curl -L -o /Users/zbb2/Desktop/PolymerGenomicsAPI/data/downloads/hg19ToHg38.over.chain.gz \
        https://hgdownload.cse.ucsc.edu/goldenPath/hg19/liftOver/hg19ToHg38.over.chain.gz
)
```

- [ ] **Step 3: Run existing ingestion script**

```bash
cd /Users/zbb2/Desktop/PolymerGenomicsAPI
uv run python -m polymer_genomics.ingest.enhancer_gene_links --build hg38
```

Expected: ~4-6M enhancer-gene links loaded after liftOver.

- [ ] **Step 4: Verify row count**

```bash
docker compose exec postgres psql -U admin -d polymer_genomics -c \
    "SELECT count(*) FROM regulatory.enhancer_gene_links"
```

Expected: 4-6M rows.

---

## Task 12: Update `ingest_all.sh` Pipeline

**Files:**
- Modify: `scripts/ingest_all.sh`

- [ ] **Step 1: Add TFBS and gnomAD SV to Tier 4 (Annotation layers)**

After step 28 (herv_loci), add:

```bash
run_step 29 4 "tfbs_peaks"      "30-90 min" \
    "uv run python -m polymer_genomics.ingest.tfbs_peaks --build ${BUILD}"

run_step 30 4 "gnomad_sv"       "10-30 min" \
    "uv run python -m polymer_genomics.ingest.gnomad_sv --build ${BUILD}"
```

**Note:** This will require renumbering all subsequent steps (29→31, 30→32, etc.) and updating tier headers. The renumbering is mechanical — increment every step number after 28 by 2, and update the tier range comments (e.g., "Steps 29-39" → "Steps 31-41").

- [ ] **Step 2: Add TCGA Pan-Cancer to Tier 6 (Cross-references)**

After the existing Tier 6 steps (probe_repeat_xref, metabolic_burden, gene_profiles), add:

```bash
run_step NN 6 "tcga_pan_cancer"  "30-60 min" \
    "uv run python -m polymer_genomics.ingest.tcga_pan_cancer --build ${BUILD}"
```

(Where NN is the renumbered step after prior renumbering.)

- [ ] **Step 3: Commit**

```bash
git add scripts/ingest_all.sh
git commit -m "feat: add TFBS, gnomAD SV, and TCGA to ingest pipeline"
```

---

## Task 13: Run Migrations on Production (Fly)

**Files:** None (production operations)

- [ ] **Step 1: Start Fly proxy**

```bash
fly proxy 15432:5432 -a polymer-db
```

- [ ] **Step 2: Run all three migrations**

In a second terminal:

```bash
cd /Users/zbb2/Desktop/PolymerGenomicsAPI

PGPASSWORD=<admin_password> psql -h localhost -p 15432 -U admin -d polymer_genomics \
    -f docker/postgres/migrations/065_tfbs_peaks.sql

PGPASSWORD=<admin_password> psql -h localhost -p 15432 -U admin -d polymer_genomics \
    -f docker/postgres/migrations/066_gnomad_sv.sql

PGPASSWORD=<admin_password> psql -h localhost -p 15432 -U admin -d polymer_genomics \
    -f docker/postgres/migrations/067_tcga_pan_cancer.sql
```

- [ ] **Step 3: Verify tables exist on production**

```bash
PGPASSWORD=<admin_password> psql -h localhost -p 15432 -U admin -d polymer_genomics -c \
    "SELECT table_schema, table_name FROM information_schema.tables WHERE table_name IN ('tfbs_peaks', 'structural_variants', 'tcga_pan_cancer')"
```

Expected: 3 rows.

---

## Task 14: Deploy API with New Query Modules

**Files:** None (deployment)

- [ ] **Step 1: Deploy API to Fly**

```bash
cd /Users/zbb2/Desktop/PolymerGenomicsAPI
fly deploy
```

Expected: Successful deployment with new query modules available.

- [ ] **Step 2: Verify health**

```bash
curl https://api.polymerbio.org/health | python -m json.tool
```

Expected: 200 OK with layer count incremented.

---

## Task 15: Download Source Data and Run Ingestion

This is the longest task — actual data download and ingestion against production.

- [ ] **Step 1: Download gnomAD SV VCF (~1.2 GB)**

```bash
mkdir -p /Users/zbb2/Desktop/PolymerGenomicsAPI/data/downloads
curl -L -o /Users/zbb2/Desktop/PolymerGenomicsAPI/data/downloads/gnomad.v4.1.sv.sites.vcf.gz \
    "https://storage.googleapis.com/gcp-public-data--gnomad/release/4.1/genome_sv/gnomad.v4.1.sv.sites.vcf.gz"
```

- [ ] **Step 2: Download ENCODE TFBS narrowPeak files**

Use the ENCODE portal REST API to get file URLs for the top ~20 TFs across GM12878/K562/H1-hESC:

```bash
mkdir -p /Users/zbb2/Desktop/PolymerGenomicsAPI/data/downloads/tfbs
# Example for CTCF in GM12878 (repeat for each TF × cell type):
# Get file list from ENCODE portal, then download each narrowPeak.gz
# This requires a download script — see scripts/download_encode_tfbs.sh
```

**Note:** A helper script `scripts/download_encode_tfbs.sh` should be created to automate this. The ENCODE REST API returns file metadata as JSON — filter for `output_type=optimal IDR thresholded peaks` and `file_format=bed narrowPeak` and `assembly=GRCh38`.

- [ ] **Step 3: Prepare TCGA methylation summaries**

This requires an R script to compute per-cancer-type summaries from Xena data. Create and run `scripts/compute_tcga_summaries.R` to produce one TSV per cancer type in `data/downloads/tcga_methylation/`.

- [ ] **Step 4: Run ingestion against production (via Fly proxy)**

```bash
# Start Fly proxy in background
fly proxy 15432:5432 -a polymer-db &

# Set env vars for production ingestion
export POSTGRES_HOST=localhost
export POSTGRES_PORT=15432
export POSTGRES_PASSWORD=<admin_password>

# Ingest in order (smallest first)
uv run python -m polymer_genomics.ingest.gnomad_sv --build hg38
uv run python -m polymer_genomics.ingest.enhancer_gene_links --build hg38
uv run python -m polymer_genomics.ingest.tfbs_peaks --build hg38
uv run python -m polymer_genomics.ingest.tcga_pan_cancer --build hg38
```

- [ ] **Step 5: Verify row counts**

```bash
PGPASSWORD=<admin_password> psql -h localhost -p 15432 -U admin -d polymer_genomics -c "
    SELECT 'structural_variants' AS layer, count(*) FROM variation.structural_variants
    UNION ALL
    SELECT 'enhancer_gene_links', count(*) FROM regulatory.enhancer_gene_links
    UNION ALL
    SELECT 'tfbs_peaks', count(*) FROM regulatory.tfbs_peaks
    UNION ALL
    SELECT 'tcga_pan_cancer', count(*) FROM methylation.tcga_pan_cancer
"
```

Expected:
- structural_variants: ~800K
- enhancer_gene_links: ~4-6M
- tfbs_peaks: ~5-15M
- tcga_pan_cancer: ~16M

---

## Task 16: Smoke Test New Layers

**Files:** None (manual verification)

- [ ] **Step 1: Test TFBS via API**

```bash
curl -s "https://api.polymerbio.org/v1/hg38/chr17:7661779-7687538?layers=tfbs&limit=5" \
    -H "X-API-Key: $POLYMER_API_KEY" | python -m json.tool
```

Expected: GRanges JSON with TFBS peaks near TP53.

- [ ] **Step 2: Test gnomAD SVs via API**

```bash
curl -s "https://api.polymerbio.org/v1/hg38/chr17:7661779-7687538?layers=structural_variant&limit=5" \
    -H "X-API-Key: $POLYMER_API_KEY" | python -m json.tool
```

Expected: GRanges JSON with SVs overlapping TP53 locus.

- [ ] **Step 3: Test TCGA methylation via API**

```bash
curl -s "https://api.polymerbio.org/v1/hg38/chr17:7661779-7687538?layers=tcga_methylation&limit=5" \
    -H "X-API-Key: $POLYMER_API_KEY" | python -m json.tool
```

Expected: GRanges JSON with tumor vs normal delta-betas.

- [ ] **Step 4: Test enhancer-gene links via API**

```bash
curl -s "https://api.polymerbio.org/v1/hg38/chr17:7661779-7687538?layers=enhancer_gene&limit=5" \
    -H "X-API-Key: $POLYMER_API_KEY" | python -m json.tool
```

Expected: GRanges JSON with ABC model predictions.

---

## Data Source Summary

| Layer | Source URL | Format | Size |
|-------|-----------|--------|------|
| ENCODE TFBS | `encodeproject.org/search/?type=Experiment&assay_title=TF+ChIP-seq&assembly=GRCh38` | narrowPeak.gz | ~2 GB total |
| gnomAD SVs | `storage.googleapis.com/gcp-public-data--gnomad/release/4.1/genome_sv/gnomad.v4.1.sv.sites.vcf.gz` | VCF.gz | ~1.2 GB |
| TCGA Pan-Cancer | `xenabrowser.net/datapages/?cohort=GDC%20Pan-Cancer%20(PANCAN)` | TSV.gz (needs preprocessing) | ~4 GB raw |
| ABC Links | `mitra.stanford.edu/engreitz/oak/public/Nasser2021/AllPredictions.AvgHiC.ABC0.015.minus150.ForABCPaperV3.txt.gz` | TSV.gz | ~400 MB |
