# Polymer Genomics API — V1 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a standalone genomics reference API (OpenAPI 3.1) backed by PostgreSQL + object storage, serving curated genomic data to agents, R/Bioconductor clients, and a minimal genome viewer.

**Architecture:** FastAPI (Python) with PostgreSQL (dockerized, GiST-indexed genomic intervals) for the hot query path, S3-compatible object storage (MinIO locally, S3/R2 in production) for bulk data, and a Next.js minimal genome viewer. All API responses use a uniform envelope with coordinate conversion (internal 0-based → external 1-based).

**Tech Stack:** Python 3.12 (via uv), FastAPI, asyncpg, PostgreSQL 16, Docker Compose, MinIO (local S3), Alembic (migrations), pytest, Next.js 15, Tailwind, Zustand, Canvas API.

**Design Doc:** `docs/plans/2026-02-25-genomics-api-design.md`

---

## Phase 0: Project Scaffolding & Local Infrastructure

### Task 1: Initialize Python project with uv

**Files:**
- Create: `pyproject.toml`
- Create: `src/polymer_genomics/__init__.py`
- Create: `src/polymer_genomics/main.py`
- Create: `tests/__init__.py`
- Create: `tests/conftest.py`
- Create: `.python-version`

**Step 1: Create pyproject.toml**

```toml
[project]
name = "polymer-genomics-api"
version = "0.1.0"
description = "Curated genomic reference database API"
requires-python = ">=3.12"
dependencies = [
    "fastapi>=0.115.0",
    "uvicorn[standard]>=0.34.0",
    "asyncpg>=0.30.0",
    "pydantic>=2.10.0",
    "pydantic-settings>=2.7.0",
    "boto3>=1.36.0",
    "httpx>=0.28.0",
]

[project.optional-dependencies]
dev = [
    "pytest>=8.3.0",
    "pytest-asyncio>=0.25.0",
    "pytest-httpx>=0.35.0",
    "ruff>=0.9.0",
    "mypy>=1.14.0",
]

[tool.pytest.ini_options]
asyncio_mode = "auto"
testpaths = ["tests"]

[tool.ruff]
target-version = "py312"
line-length = 100

[tool.ruff.lint]
select = ["E", "F", "I", "N", "W", "UP"]
```

**Step 2: Initialize uv project and install**

Run: `cd /Users/zbb2/Desktop/PolymerGenomicsAPI && uv init --no-readme && uv python install 3.12 && uv sync`

If `uv init` conflicts with existing pyproject.toml, write pyproject.toml first, then run `uv sync`.

Expected: `.venv/` created, dependencies installed.

**Step 3: Write .python-version**

```
3.12
```

**Step 4: Create src layout**

```python
# src/polymer_genomics/__init__.py
"""Polymer Genomics API — curated genomic reference database."""

__version__ = "0.1.0"
```

```python
# src/polymer_genomics/main.py
from fastapi import FastAPI

app = FastAPI(
    title="Polymer Genomics API",
    version="0.1.0",
    description="Curated genomic reference database for agents and bioinformaticians",
)


@app.get("/health")
async def health():
    return {"status": "ok", "version": "0.1.0"}
```

```python
# tests/__init__.py
```

```python
# tests/conftest.py
import pytest
from httpx import ASGITransport, AsyncClient

from polymer_genomics.main import app


@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c
```

**Step 5: Write and run first test**

```python
# tests/test_health.py
async def test_health(client):
    resp = await client.get("/health")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ok"
```

Run: `cd /Users/zbb2/Desktop/PolymerGenomicsAPI && uv run pytest tests/test_health.py -v`
Expected: PASS

**Step 6: Create .gitignore and commit**

```
# .gitignore
__pycache__/
*.pyc
.venv/
*.egg-info/
.ruff_cache/
.mypy_cache/
.pytest_cache/
node_modules/
.next/
.env
*.db
```

Run:
```bash
cd /Users/zbb2/Desktop/PolymerGenomicsAPI
git add pyproject.toml .python-version .gitignore src/ tests/
git commit -m "feat: initialize Python project with FastAPI and health endpoint"
```

---

### Task 2: Docker Compose — PostgreSQL + MinIO

**Files:**
- Create: `docker-compose.yml`
- Create: `docker/postgres/init.sql`
- Create: `.env.example`
- Create: `src/polymer_genomics/config.py`

**Step 1: Write docker-compose.yml**

```yaml
# docker-compose.yml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: polymer_genomics
      POSTGRES_USER: admin
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-dev_password}
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./docker/postgres/init.sql:/docker-entrypoint-initdb.d/01-init.sql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U admin -d polymer_genomics"]
      interval: 5s
      timeout: 3s
      retries: 5

  minio:
    image: minio/minio:latest
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: ${MINIO_ROOT_USER:-minioadmin}
      MINIO_ROOT_PASSWORD: ${MINIO_ROOT_PASSWORD:-minioadmin}
    ports:
      - "9000:9000"
      - "9001:9001"
    volumes:
      - miniodata:/data

volumes:
  pgdata:
  miniodata:
```

**Step 2: Write init.sql — schemas, extensions, roles, enums**

```sql
-- docker/postgres/init.sql
-- Extensions
CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Schemas
CREATE SCHEMA IF NOT EXISTS ref;
CREATE SCHEMA IF NOT EXISTS registry;
CREATE SCHEMA IF NOT EXISTS cpg;
CREATE SCHEMA IF NOT EXISTS gene;
CREATE SCHEMA IF NOT EXISTS probe;
CREATE SCHEMA IF NOT EXISTS methylation;
CREATE SCHEMA IF NOT EXISTS storage;

-- Roles
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'api_reader') THEN
        CREATE ROLE api_reader LOGIN PASSWORD 'api_reader_dev';
    END IF;
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'ingest_writer') THEN
        CREATE ROLE ingest_writer LOGIN PASSWORD 'ingest_writer_dev';
    END IF;
END
$$;

-- Role guardrails
ALTER ROLE api_reader SET statement_timeout = '30s';
ALTER ROLE api_reader SET idle_in_transaction_session_timeout = '60s';
ALTER ROLE api_reader SET work_mem = '64MB';
ALTER ROLE api_reader SET temp_file_limit = '256MB';

-- Enums
CREATE TYPE genome_build AS ENUM ('hg37', 'hg38');
CREATE TYPE layer_type AS ENUM (
    'genome', 'gene_model', 'cpg', 'probe', 'methylation', 'isochore'
);
CREATE TYPE license_class AS ENUM (
    'public_domain', 'derived', 'restricted', 'proprietary'
);
CREATE TYPE storage_location AS ENUM (
    'postgres', 'object_storage', 'both'
);
CREATE TYPE probe_platform AS ENUM ('450k', 'epic_v1', 'epic_v2');
CREATE TYPE mapping_method AS ENUM (
    'exact_id', 'coord_overlap', 'liftover', 'sequence_match'
);
CREATE TYPE feature_type AS ENUM (
    'exon', 'intron', 'UTR5', 'UTR3', 'promoter', 'gene_body'
);
CREATE TYPE cpg_context AS ENUM (
    'island', 'n_shore', 's_shore', 'n_shelf', 's_shelf', 'open_sea'
);
CREATE TYPE layer_dependency_type AS ENUM (
    'derived_from', 'lifted_from', 'filtered_from'
);

-- ============================================================
-- Tables
-- ============================================================

-- Chromosome reference
CREATE TABLE ref.chromosomes (
    chr_id      smallint PRIMARY KEY,
    chr_name    text NOT NULL UNIQUE,
    length_hg37 int,
    length_hg38 int
);

INSERT INTO ref.chromosomes (chr_id, chr_name) VALUES
(1,'chr1'),(2,'chr2'),(3,'chr3'),(4,'chr4'),(5,'chr5'),
(6,'chr6'),(7,'chr7'),(8,'chr8'),(9,'chr9'),(10,'chr10'),
(11,'chr11'),(12,'chr12'),(13,'chr13'),(14,'chr14'),(15,'chr15'),
(16,'chr16'),(17,'chr17'),(18,'chr18'),(19,'chr19'),(20,'chr20'),
(21,'chr21'),(22,'chr22'),(23,'chrX'),(24,'chrY'),(25,'chrM');

-- Layer registry
CREATE TABLE registry.layers (
    id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    layer_key       text NOT NULL,
    version         text NOT NULL,
    name            text NOT NULL,
    layer_type      layer_type NOT NULL,
    genome_build    genome_build NOT NULL,
    source          text NOT NULL,
    license_class   license_class NOT NULL,
    license_uri     text,
    storage_type    storage_location NOT NULL,
    row_count       bigint,
    content_hash    text,
    is_active       boolean DEFAULT true,
    is_default      boolean DEFAULT false,
    created_at      timestamptz DEFAULT now(),
    updated_at      timestamptz DEFAULT now(),
    metadata        jsonb,
    UNIQUE (layer_key, version)
);

CREATE UNIQUE INDEX one_default_per_key
    ON registry.layers (layer_key)
    WHERE is_default = true AND is_active = true;

CREATE TABLE registry.layer_dependencies (
    layer_id        uuid REFERENCES registry.layers(id),
    depends_on_id   uuid REFERENCES registry.layers(id),
    relationship    layer_dependency_type NOT NULL,
    PRIMARY KEY (layer_id, depends_on_id)
);

CREATE VIEW registry.active_layers AS
SELECT * FROM registry.layers
WHERE is_active = true AND is_default = true;

-- Object storage references
CREATE TABLE storage.objects (
    id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    layer_id        uuid NOT NULL REFERENCES registry.layers(id),
    provider        text NOT NULL DEFAULT 'aws_s3',
    bucket          text NOT NULL,
    key             text NOT NULL,
    region          text,
    etag            text,
    version_id      text,
    content_hash    text,
    size_bytes      bigint,
    file_type       text NOT NULL,
    description     text,
    created_at      timestamptz DEFAULT now(),
    UNIQUE (provider, bucket, key)
);

-- Gene features
CREATE TABLE gene.features (
    id              bigint GENERATED ALWAYS AS IDENTITY,
    layer_id        uuid NOT NULL REFERENCES registry.layers(id),
    build           genome_build NOT NULL,
    chr_id          smallint NOT NULL REFERENCES ref.chromosomes(chr_id),
    start_pos       int NOT NULL,
    end_pos         int NOT NULL,
    coord           int4range GENERATED ALWAYS AS (int4range(start_pos, end_pos)) STORED,
    strand          char(1) CHECK (strand IN ('+', '-')),
    gene_symbol     text NOT NULL,
    gene_id         text,
    transcript_id   text,
    feature_type    feature_type NOT NULL,
    PRIMARY KEY (id, build, chr_id)
) PARTITION BY LIST (build);

CREATE TABLE gene.features_hg38 PARTITION OF gene.features
    FOR VALUES IN ('hg38') PARTITION BY LIST (chr_id);
CREATE TABLE gene.features_hg37 PARTITION OF gene.features
    FOR VALUES IN ('hg37') PARTITION BY LIST (chr_id);

CREATE INDEX idx_gene_symbol ON gene.features (gene_symbol);
CREATE INDEX idx_gene_type ON gene.features (feature_type, build, chr_id);

-- CpG islands (small table, no partitioning needed)
CREATE TABLE cpg.islands (
    id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    layer_id    uuid NOT NULL REFERENCES registry.layers(id),
    build       genome_build NOT NULL,
    chr_id      smallint NOT NULL REFERENCES ref.chromosomes(chr_id),
    start_pos   int NOT NULL,
    end_pos     int NOT NULL,
    coord       int4range GENERATED ALWAYS AS (int4range(start_pos, end_pos)) STORED,
    island_name text
);

CREATE INDEX idx_cpg_islands_range ON cpg.islands USING GiST (chr_id, coord);

-- CpG sites
CREATE TABLE cpg.sites (
    id          bigint GENERATED ALWAYS AS IDENTITY,
    layer_id    uuid NOT NULL REFERENCES registry.layers(id),
    build       genome_build NOT NULL,
    chr_id      smallint NOT NULL REFERENCES ref.chromosomes(chr_id),
    pos         int NOT NULL,
    coord       int4range GENERATED ALWAYS AS (int4range(pos, pos + 2)) STORED,
    island_id   bigint,
    context     cpg_context,
    gc_content  real,
    PRIMARY KEY (id, build, chr_id)
) PARTITION BY LIST (build);

CREATE TABLE cpg.sites_hg38 PARTITION OF cpg.sites
    FOR VALUES IN ('hg38') PARTITION BY LIST (chr_id);
CREATE TABLE cpg.sites_hg37 PARTITION OF cpg.sites
    FOR VALUES IN ('hg37') PARTITION BY LIST (chr_id);

-- Probe coordinates
CREATE TABLE probe.coordinates (
    id          bigint GENERATED ALWAYS AS IDENTITY,
    layer_id    uuid NOT NULL REFERENCES registry.layers(id),
    probe_id    text NOT NULL,
    build       genome_build NOT NULL,
    chr_id      smallint NOT NULL REFERENCES ref.chromosomes(chr_id),
    pos         int NOT NULL,
    coord       int4range GENERATED ALWAYS AS (int4range(pos, pos + 1)) STORED,
    gene_symbol text,
    cpg_context cpg_context,
    PRIMARY KEY (id, build),
    UNIQUE (layer_id, build, probe_id)
) PARTITION BY LIST (build);

CREATE TABLE probe.coordinates_hg38 PARTITION OF probe.coordinates
    FOR VALUES IN ('hg38');
CREATE TABLE probe.coordinates_hg37 PARTITION OF probe.coordinates
    FOR VALUES IN ('hg37');

CREATE INDEX idx_probe_id ON probe.coordinates (probe_id);

-- Probe crossmap edges
CREATE TABLE probe.map_edges (
    id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    src_platform    probe_platform NOT NULL,
    src_probe_id    text NOT NULL,
    dst_platform    probe_platform NOT NULL,
    dst_probe_id    text NOT NULL,
    build           genome_build NOT NULL,
    chr_id          smallint NOT NULL,
    pos             int NOT NULL,
    method          mapping_method NOT NULL,
    confidence      real NOT NULL DEFAULT 1.0
        CHECK (confidence >= 0.0 AND confidence <= 1.0),
    UNIQUE (src_platform, src_probe_id, dst_platform, dst_probe_id, build)
);

CREATE INDEX idx_map_edges_src ON probe.map_edges (src_platform, src_probe_id);
CREATE INDEX idx_map_edges_dst ON probe.map_edges (dst_platform, dst_probe_id);

-- Methylation atlas manifest
CREATE TABLE methylation.atlas_layers (
    id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    layer_id        uuid NOT NULL REFERENCES registry.layers(id),
    cell_type       text NOT NULL,
    build           genome_build NOT NULL,
    bigwig_ref      uuid REFERENCES storage.objects(id),
    parquet_ref     uuid REFERENCES storage.objects(id),
    summary_ref     uuid REFERENCES storage.objects(id),
    n_samples       int,
    mean_coverage   real,
    metadata        jsonb
);

-- Isochores
CREATE TABLE ref.isochores (
    id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    layer_id    uuid NOT NULL REFERENCES registry.layers(id),
    build       genome_build NOT NULL,
    chr_id      smallint NOT NULL REFERENCES ref.chromosomes(chr_id),
    start_pos   int NOT NULL,
    end_pos     int NOT NULL,
    coord       int4range GENERATED ALWAYS AS (int4range(start_pos, end_pos)) STORED,
    gc_content  real NOT NULL,
    isochore_class text NOT NULL  -- L1, L2, H1, H2, H3
);

CREATE INDEX idx_isochore_range ON ref.isochores USING GiST (chr_id, coord);

-- ============================================================
-- Grants
-- ============================================================
GRANT USAGE ON SCHEMA ref, registry, cpg, gene, probe, methylation, storage TO api_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA ref TO api_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA registry TO api_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA cpg TO api_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA gene TO api_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA probe TO api_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA methylation TO api_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA storage TO api_reader;

GRANT USAGE ON SCHEMA ref, registry, cpg, gene, probe, methylation, storage TO ingest_writer;
GRANT INSERT, UPDATE ON ALL TABLES IN SCHEMA cpg TO ingest_writer;
GRANT INSERT, UPDATE ON ALL TABLES IN SCHEMA gene TO ingest_writer;
GRANT INSERT, UPDATE ON ALL TABLES IN SCHEMA probe TO ingest_writer;
GRANT INSERT, UPDATE ON ALL TABLES IN SCHEMA methylation TO ingest_writer;
GRANT INSERT, UPDATE ON ALL TABLES IN SCHEMA registry TO ingest_writer;
GRANT INSERT, UPDATE ON ALL TABLES IN SCHEMA storage TO ingest_writer;
GRANT SELECT ON ALL TABLES IN SCHEMA ref TO ingest_writer;
GRANT SELECT ON ALL TABLES IN SCHEMA registry TO ingest_writer;
```

**Step 3: Write .env.example**

```bash
# .env.example
POSTGRES_PASSWORD=dev_password
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=polymer_genomics
POSTGRES_USER=api_reader
POSTGRES_USER_PASSWORD=api_reader_dev

MINIO_ROOT_USER=minioadmin
MINIO_ROOT_PASSWORD=minioadmin
MINIO_ENDPOINT=http://localhost:9000
S3_BUCKET=polymer-genomics-api
```

**Step 4: Write config.py**

```python
# src/polymer_genomics/config.py
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    postgres_host: str = "localhost"
    postgres_port: int = 5432
    postgres_db: str = "polymer_genomics"
    postgres_user: str = "api_reader"
    postgres_password: str = "api_reader_dev"

    s3_endpoint: str = "http://localhost:9000"
    s3_bucket: str = "polymer-genomics-api"
    s3_access_key: str = "minioadmin"
    s3_secret_key: str = "minioadmin"
    s3_region: str = "us-east-1"

    max_region_length: int = 10_000_000
    max_returned_rows: int = 50_000
    default_page_size: int = 1_000

    model_config = {"env_prefix": "", "env_file": ".env"}


settings = Settings()
```

**Step 5: Start Docker services and verify**

Run: `cd /Users/zbb2/Desktop/PolymerGenomicsAPI && cp .env.example .env && docker compose up -d`
Expected: postgres and minio containers running.

Verify: `docker compose exec postgres psql -U admin -d polymer_genomics -c "SELECT count(*) FROM ref.chromosomes;"`
Expected: `25`

**Step 6: Commit**

```bash
git add docker-compose.yml docker/ .env.example src/polymer_genomics/config.py
git commit -m "feat: add Docker Compose (Postgres 16 + MinIO) with full schema"
```

---

### Task 3: Database connection pool + startup/shutdown

**Files:**
- Create: `src/polymer_genomics/db.py`
- Modify: `src/polymer_genomics/main.py`
- Create: `tests/test_db.py`

**Step 1: Write the failing test**

```python
# tests/test_db.py
async def test_db_health(client):
    resp = await client.get("/health")
    assert resp.status_code == 200
    body = resp.json()
    assert body["db"] == "ok"
    assert body["chromosome_count"] == 25
```

**Step 2: Run to verify it fails**

Run: `uv run pytest tests/test_db.py -v`
Expected: FAIL (no "db" key in health response yet)

**Step 3: Write db.py with asyncpg pool**

```python
# src/polymer_genomics/db.py
import asyncpg

from polymer_genomics.config import settings

_pool: asyncpg.Pool | None = None


async def get_pool() -> asyncpg.Pool:
    global _pool
    if _pool is None:
        raise RuntimeError("Database pool not initialized. Call init_pool() first.")
    return _pool


async def init_pool() -> asyncpg.Pool:
    global _pool
    _pool = await asyncpg.create_pool(
        host=settings.postgres_host,
        port=settings.postgres_port,
        database=settings.postgres_db,
        user=settings.postgres_user,
        password=settings.postgres_password,
        min_size=2,
        max_size=10,
        command_timeout=30,
    )
    return _pool


async def close_pool():
    global _pool
    if _pool:
        await _pool.close()
        _pool = None
```

**Step 4: Update main.py with lifespan and richer health check**

```python
# src/polymer_genomics/main.py
from contextlib import asynccontextmanager

from fastapi import FastAPI

from polymer_genomics.db import close_pool, get_pool, init_pool


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_pool()
    yield
    await close_pool()


app = FastAPI(
    title="Polymer Genomics API",
    version="0.1.0",
    description="Curated genomic reference database for agents and bioinformaticians",
    lifespan=lifespan,
)


@app.get("/health")
async def health():
    pool = await get_pool()
    async with pool.acquire() as conn:
        count = await conn.fetchval("SELECT count(*) FROM ref.chromosomes")
    return {"status": "ok", "version": "0.1.0", "db": "ok", "chromosome_count": count}
```

**Step 5: Update conftest.py to handle lifespan**

```python
# tests/conftest.py
import pytest
from httpx import ASGITransport, AsyncClient

from polymer_genomics.main import app


@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c
```

Note: This test requires Docker Postgres running. Add a marker if needed:
```python
# tests/conftest.py — add at top
import os
import pytest

requires_db = pytest.mark.skipif(
    os.environ.get("SKIP_DB_TESTS", "0") == "1",
    reason="Database not available"
)
```

**Step 6: Run test**

Run: `uv run pytest tests/test_db.py -v`
Expected: PASS (requires Docker Postgres running)

**Step 7: Commit**

```bash
git add src/polymer_genomics/db.py src/polymer_genomics/main.py tests/
git commit -m "feat: add asyncpg connection pool with DB health check"
```

---

## Phase 1: Core API — Contracts & Primitives

### Task 4: Coordinate conversion module + response envelope

**Files:**
- Create: `src/polymer_genomics/coordinates.py`
- Create: `src/polymer_genomics/envelope.py`
- Create: `tests/test_coordinates.py`
- Create: `tests/test_envelope.py`

**Step 1: Write failing coordinate tests**

```python
# tests/test_coordinates.py
from polymer_genomics.coordinates import (
    db_to_api,
    api_to_db,
    parse_region,
)


def test_db_to_api_cpg():
    """CpG at internal [70699929, 70699931) → API [70699930, 70699931]"""
    result = db_to_api(start=70699929, end=70699931)
    assert result == {"start": 70699930, "end": 70699931, "width": 2}


def test_db_to_api_single_base():
    """Probe at internal [70699929, 70699930) → API [70699930, 70699930]"""
    result = db_to_api(start=70699929, end=70699930)
    assert result == {"start": 70699930, "end": 70699930, "width": 1}


def test_api_to_db_default_1based():
    """1-based query [70699930, 70699931] → internal [70699929, 70699931)"""
    result = api_to_db(start=70699930, end=70699931, coords="1based")
    assert result == {"start": 70699929, "end": 70699931}


def test_api_to_db_0based():
    """0-based query [70699929, 70699931) → internal [70699929, 70699931)"""
    result = api_to_db(start=70699929, end=70699931, coords="0based")
    assert result == {"start": 70699929, "end": 70699931}


def test_roundtrip():
    """Internal → API → query → internal should be identity."""
    internal_start, internal_end = 100, 102
    api = db_to_api(internal_start, internal_end)
    back = api_to_db(api["start"], api["end"], coords="1based")
    assert back == {"start": internal_start, "end": internal_end}


def test_parse_region():
    result = parse_region("chr16:70699930-70700000")
    assert result == {"chr": "chr16", "start": 70699930, "end": 70700000}


def test_parse_region_invalid():
    import pytest
    with pytest.raises(ValueError):
        parse_region("invalid")
```

**Step 2: Run to verify failures**

Run: `uv run pytest tests/test_coordinates.py -v`
Expected: FAIL (module does not exist)

**Step 3: Implement coordinates.py**

```python
# src/polymer_genomics/coordinates.py
"""Coordinate conversion: internal 0-based half-open ↔ external 1-based closed."""

import re

_REGION_PATTERN = re.compile(r"^(chr[0-9XYM]+):(\d+)-(\d+)$")


def db_to_api(start: int, end: int) -> dict:
    """Convert internal [start, end) to API {start, end, width} (1-based closed)."""
    return {"start": start + 1, "end": end, "width": end - start}


def api_to_db(start: int, end: int, coords: str = "1based") -> dict:
    """Convert API query coordinates to internal [start, end)."""
    if coords == "0based":
        return {"start": start, "end": end}
    # Default: 1-based closed → 0-based half-open
    return {"start": start - 1, "end": end}


def parse_region(region: str) -> dict:
    """Parse 'chr16:70699930-70700000' → {chr, start, end}."""
    m = _REGION_PATTERN.match(region)
    if not m:
        raise ValueError(f"Invalid region format: {region!r}. Expected 'chrN:start-end'.")
    return {"chr": m.group(1), "start": int(m.group(2)), "end": int(m.group(3))}
```

**Step 4: Run tests**

Run: `uv run pytest tests/test_coordinates.py -v`
Expected: ALL PASS

**Step 5: Write failing envelope tests**

```python
# tests/test_envelope.py
from polymer_genomics.envelope import build_envelope


def test_complete_envelope():
    env = build_envelope(
        status="complete",
        query={"build": "hg38", "region": {"chr": "chr16", "start": 70699930, "end": 70700000}},
        layers_resolved=[{"layer_key": "cpg_sites", "version": "1.0"}],
        data={"cpg_sites": []},
    )
    assert env["status"] == "complete"
    assert env["coordinate_system"] == "1-based_closed"
    assert "query" in env
    assert "layers_resolved" in env
    assert "timing" in env


def test_partial_envelope():
    env = build_envelope(
        status="partial",
        query={"build": "hg38"},
        layers_resolved=[
            {"layer_key": "cpg_sites", "version": "1.0", "status": "ok"},
            {"layer_key": "meth_monocyte", "version": "1.0", "status": "timeout"},
        ],
        data={"cpg_sites": [], "meth_monocyte": None},
    )
    assert env["status"] == "partial"
```

**Step 6: Implement envelope.py**

```python
# src/polymer_genomics/envelope.py
"""Uniform response envelope for all data endpoints."""

import time
from typing import Any


def build_envelope(
    *,
    status: str,
    query: dict,
    layers_resolved: list[dict],
    data: Any,
    pagination: dict | None = None,
    db_time_ms: float | None = None,
    _start_time: float | None = None,
) -> dict:
    """Build the standard response envelope.

    Status: 'complete' | 'paginated' | 'truncated' | 'partial'
    """
    query_time_ms = round((time.monotonic() - _start_time) * 1000, 1) if _start_time else 0
    envelope = {
        "status": status,
        "coordinate_system": "1-based_closed",
        "query": query,
        "layers_resolved": layers_resolved,
        "data": data,
        "timing": {
            "query_time_ms": query_time_ms,
            "db_time_ms": db_time_ms or 0,
        },
    }
    if pagination:
        envelope["pagination"] = pagination
    return envelope
```

**Step 7: Run all tests**

Run: `uv run pytest tests/test_coordinates.py tests/test_envelope.py -v`
Expected: ALL PASS

**Step 8: Commit**

```bash
git add src/polymer_genomics/coordinates.py src/polymer_genomics/envelope.py tests/test_coordinates.py tests/test_envelope.py
git commit -m "feat: add coordinate conversion and response envelope modules"
```

---

### Task 5: Layer registry endpoints

**Files:**
- Create: `src/polymer_genomics/routers/__init__.py`
- Create: `src/polymer_genomics/routers/layers.py`
- Create: `tests/test_layers.py`

**Step 1: Write failing tests**

```python
# tests/test_layers.py
import pytest


async def test_list_layers_empty(client):
    resp = await client.get("/v1/layers")
    assert resp.status_code == 200
    assert resp.json()["layers"] == []


async def test_list_layers_filtered(client, seed_layers):
    """After seeding test layers, filter by type."""
    resp = await client.get("/v1/layers?type=probe&build=hg38")
    assert resp.status_code == 200
    layers = resp.json()["layers"]
    assert all(l["type"] == "probe" for l in layers)


async def test_get_layer_by_key(client, seed_layers):
    resp = await client.get("/v1/layers/probe_epic_v2")
    assert resp.status_code == 200
    body = resp.json()
    assert body["layer_key"] == "probe_epic_v2"


async def test_get_layer_not_found(client):
    resp = await client.get("/v1/layers/nonexistent")
    assert resp.status_code == 404
```

**Step 2: Implement the router**

```python
# src/polymer_genomics/routers/__init__.py
```

```python
# src/polymer_genomics/routers/layers.py
from fastapi import APIRouter, HTTPException, Query

from polymer_genomics.db import get_pool

router = APIRouter(prefix="/v1/layers", tags=["layers"])


@router.get("")
async def list_layers(
    type: str | None = Query(None, alias="type"),
    build: str | None = None,
    active: bool = True,
):
    pool = await get_pool()
    async with pool.acquire() as conn:
        query = "SELECT * FROM registry.layers WHERE 1=1"
        params = []
        idx = 1
        if active:
            query += f" AND is_active = ${idx}"
            params.append(True)
            idx += 1
        if type:
            query += f" AND layer_type = ${idx}::layer_type"
            params.append(type)
            idx += 1
        if build:
            query += f" AND (genome_build = ${idx}::genome_build OR genome_build IS NULL)"
            params.append(build)
            idx += 1
        query += " ORDER BY layer_key, version"
        rows = await conn.fetch(query, *params)

    return {
        "layers": [
            {
                "layer_key": r["layer_key"],
                "version": r["version"],
                "name": r["name"],
                "type": r["layer_type"],
                "build": r["genome_build"],
                "license_class": r["license_class"],
                "row_count": r["row_count"],
                "is_default": r["is_default"],
            }
            for r in rows
        ]
    }


@router.get("/{layer_key}")
async def get_layer(layer_key: str):
    pool = await get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """SELECT * FROM registry.layers
               WHERE layer_key = $1 AND is_active = true AND is_default = true""",
            layer_key,
        )
    if not row:
        raise HTTPException(status_code=404, detail=f"Layer '{layer_key}' not found")
    return {
        "layer_key": row["layer_key"],
        "version": row["version"],
        "name": row["name"],
        "type": row["layer_type"],
        "build": row["genome_build"],
        "source": row["source"],
        "license_class": row["license_class"],
        "row_count": row["row_count"],
        "content_hash": row["content_hash"],
        "is_default": row["is_default"],
        "metadata": row["metadata"],
    }
```

**Step 3: Register router in main.py**

Add to `main.py`:
```python
from polymer_genomics.routers.layers import router as layers_router
app.include_router(layers_router)
```

**Step 4: Add seed_layers fixture to conftest.py**

```python
# Add to tests/conftest.py
@pytest.fixture
async def seed_layers():
    """Insert test layers into the database."""
    from polymer_genomics.db import get_pool
    pool = await get_pool()
    async with pool.acquire() as conn:
        await conn.execute("""
            INSERT INTO registry.layers (layer_key, version, name, layer_type, genome_build,
                source, license_class, storage_type, row_count, is_active, is_default)
            VALUES
                ('probe_epic_v2', '1.0', 'EPIC v2 Probes', 'probe', 'hg38',
                 'derived:Illumina', 'derived', 'postgres', 935000, true, true),
                ('cpg_sites', '1.0', 'CpG Sites', 'cpg', 'hg38',
                 'computed', 'public_domain', 'postgres', 28300000, true, true)
            ON CONFLICT (layer_key, version) DO NOTHING
        """)
    yield
    async with pool.acquire() as conn:
        await conn.execute(
            "DELETE FROM registry.layers WHERE layer_key IN ('probe_epic_v2', 'cpg_sites')"
        )
```

**Step 5: Run tests**

Run: `uv run pytest tests/test_layers.py -v`
Expected: ALL PASS

**Step 6: Commit**

```bash
git add src/polymer_genomics/routers/ tests/test_layers.py tests/conftest.py src/polymer_genomics/main.py
git commit -m "feat: add layer registry endpoints (GET /v1/layers)"
```

---

### Task 6: Region query endpoint with GiST overlap queries

**Files:**
- Create: `src/polymer_genomics/routers/regions.py`
- Create: `src/polymer_genomics/queries.py`
- Create: `tests/test_regions.py`

This is the core primitive. The region endpoint queries the partitioned interval tables using GiST indexes, applies coordinate conversion, and returns the response envelope.

**Step 1: Write failing tests**

```python
# tests/test_regions.py
import pytest


async def test_region_query_basic(client, seed_genomic_data):
    resp = await client.get("/v1/regions/hg38/chr16:70699930-70700000?layers=cpg_sites")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] in ("complete", "paginated")
    assert body["coordinate_system"] == "1-based_closed"
    assert "cpg_sites" in body["data"]
    assert len(body["layers_resolved"]) >= 1


async def test_region_query_coordinate_convention(client, seed_genomic_data):
    """Verify returned coords are 1-based closed."""
    resp = await client.get("/v1/regions/hg38/chr16:70699930-70699932?layers=cpg_sites")
    body = resp.json()
    if body["data"]["cpg_sites"]["n"] > 0:
        starts = body["data"]["cpg_sites"]["ranges"]["start"]
        # All starts should be >= 70699930 (1-based, inclusive)
        assert all(s >= 70699930 for s in starts)


async def test_region_query_0based(client, seed_genomic_data):
    """0-based query should return same results as equivalent 1-based."""
    resp_1based = await client.get("/v1/regions/hg38/chr16:70699930-70700000?layers=cpg_sites")
    resp_0based = await client.get(
        "/v1/regions/hg38/chr16:70699929-70700000?layers=cpg_sites&coords=0based"
    )
    assert resp_1based.json()["data"] == resp_0based.json()["data"]


async def test_region_too_large(client):
    resp = await client.get("/v1/regions/hg38/chr1:1-20000000?layers=cpg_sites")
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "REGION_TOO_LARGE"


async def test_region_invalid_build(client):
    resp = await client.get("/v1/regions/hg99/chr1:1-1000?layers=cpg_sites")
    assert resp.status_code == 400
```

**Step 2: Implement queries.py — parameterized SQL for interval overlap**

```python
# src/polymer_genomics/queries.py
"""Parameterized SQL queries for genomic interval lookups."""


def region_cpg_sites_query() -> str:
    return """
        SELECT s.pos, s.pos + 2 AS end_pos, s.context, s.gc_content, s.island_id
        FROM cpg.sites s
        WHERE s.build = $1::genome_build
          AND s.chr_id = $2
          AND s.coord && int4range($3, $4)
          AND s.layer_id = $5
        ORDER BY s.pos
        LIMIT $6
    """


def region_gene_features_query() -> str:
    return """
        SELECT g.start_pos, g.end_pos, g.strand, g.gene_symbol,
               g.gene_id, g.transcript_id, g.feature_type
        FROM gene.features g
        WHERE g.build = $1::genome_build
          AND g.chr_id = $2
          AND g.coord && int4range($3, $4)
          AND g.layer_id = $5
        ORDER BY g.start_pos
        LIMIT $6
    """


def region_probe_coordinates_query() -> str:
    return """
        SELECT p.probe_id, p.pos, p.pos + 1 AS end_pos,
               p.gene_symbol, p.cpg_context
        FROM probe.coordinates p
        WHERE p.build = $1::genome_build
          AND p.chr_id = $2
          AND p.coord && int4range($3, $4)
          AND p.layer_id = $5
        ORDER BY p.pos
        LIMIT $6
    """


def region_isochores_query() -> str:
    return """
        SELECT i.start_pos, i.end_pos, i.gc_content, i.isochore_class
        FROM ref.isochores i
        WHERE i.build = $1::genome_build
          AND i.chr_id = $2
          AND i.coord && int4range($3, $4)
          AND i.layer_id = $5
        ORDER BY i.start_pos
        LIMIT $6
    """


# Map layer_type → query function
LAYER_QUERY_MAP = {
    "cpg": region_cpg_sites_query,
    "gene_model": region_gene_features_query,
    "probe": region_probe_coordinates_query,
    "isochore": region_isochores_query,
}
```

**Step 3: Implement regions.py router**

```python
# src/polymer_genomics/routers/regions.py
import time

from fastapi import APIRouter, HTTPException, Query

from polymer_genomics.config import settings
from polymer_genomics.coordinates import api_to_db, db_to_api, parse_region
from polymer_genomics.db import get_pool
from polymer_genomics.envelope import build_envelope
from polymer_genomics.queries import LAYER_QUERY_MAP

router = APIRouter(prefix="/v1/regions", tags=["regions"])

CHR_NAME_TO_ID = {f"chr{i}": i for i in range(1, 23)}
CHR_NAME_TO_ID.update({"chrX": 23, "chrY": 24, "chrM": 25})

VALID_BUILDS = {"hg37", "hg38"}


@router.get("/{build}/{region}")
async def query_region(
    build: str,
    region: str,
    layers: str | None = Query(None),
    coords: str = Query("1based"),
    limit: int = Query(None),
):
    start_time = time.monotonic()

    if build not in VALID_BUILDS:
        raise HTTPException(400, {"error": {"code": "BUILD_MISMATCH", "message": f"Invalid build: {build}"}})

    parsed = parse_region(region)
    chr_name = parsed["chr"]
    chr_id = CHR_NAME_TO_ID.get(chr_name)
    if chr_id is None:
        raise HTTPException(400, {"error": {"code": "INVALID_CHROMOSOME", "message": f"Unknown chromosome: {chr_name}"}})

    internal = api_to_db(parsed["start"], parsed["end"], coords=coords)
    region_length = internal["end"] - internal["start"]
    if region_length > settings.max_region_length:
        raise HTTPException(400, {
            "error": {
                "code": "REGION_TOO_LARGE",
                "message": f"Region exceeds maximum of {settings.max_region_length}bp.",
                "limit": settings.max_region_length,
                "requested": region_length,
            }
        })

    page_limit = min(limit or settings.default_page_size, settings.max_returned_rows)

    pool = await get_pool()
    async with pool.acquire() as conn:
        # Resolve requested layers
        if layers:
            layer_keys = [l.strip() for l in layers.split(",")]
        else:
            layer_keys = None

        if layer_keys:
            layer_rows = await conn.fetch(
                """SELECT id, layer_key, version, layer_type, content_hash
                   FROM registry.active_layers WHERE layer_key = ANY($1)""",
                layer_keys,
            )
        else:
            layer_rows = await conn.fetch(
                "SELECT id, layer_key, version, layer_type, content_hash FROM registry.active_layers"
            )

        layers_resolved = []
        data = {}
        db_start = time.monotonic()

        for lr in layer_rows:
            query_fn = LAYER_QUERY_MAP.get(lr["layer_type"])
            if not query_fn:
                continue

            rows = await conn.fetch(
                query_fn(),
                build, chr_id, internal["start"], internal["end"], lr["id"], page_limit,
            )

            converted = _convert_rows(lr["layer_type"], rows, chr_name)
            data[lr["layer_key"]] = converted
            layers_resolved.append({
                "layer_key": lr["layer_key"],
                "version": lr["version"],
                "layer_id": str(lr["id"]),
                "content_hash": lr["content_hash"],
                "status": "ok",
            })

        db_time = (time.monotonic() - db_start) * 1000

    total_rows = sum(d.get("n", 0) for d in data.values())
    if total_rows >= page_limit:
        status = "truncated"
    else:
        status = "complete"

    return build_envelope(
        status=status,
        query={
            "build": build,
            "region": {"chr": chr_name, "start": parsed["start"], "end": parsed["end"]},
            "layers_requested": layer_keys or ["all_active"],
            "coords_input": coords,
        },
        layers_resolved=layers_resolved,
        data=data,
        db_time_ms=round(db_time, 1),
        _start_time=start_time,
    )


def _convert_rows(layer_type: str, rows: list, chr_name: str) -> dict:
    """Convert DB rows to GRanges-structured response with 1-based coordinates."""
    if layer_type == "cpg":
        starts, ends, widths, contexts, gc_contents = [], [], [], [], []
        for r in rows:
            api = db_to_api(r["pos"], r["end_pos"])
            starts.append(api["start"])
            ends.append(api["end"])
            widths.append(api["width"])
            contexts.append(r["context"])
            gc_contents.append(r["gc_content"])
        return {
            "class": "GRanges",
            "seqnames": [chr_name] * len(rows),
            "ranges": {"start": starts, "end": ends, "width": widths},
            "strand": ["*"] * len(rows),
            "mcols": {"context": contexts, "gc_content": gc_contents},
            "n": len(rows),
        }
    elif layer_type == "gene_model":
        starts, ends, widths, strands = [], [], [], []
        symbols, gene_ids, tx_ids, ftypes = [], [], [], []
        for r in rows:
            api = db_to_api(r["start_pos"], r["end_pos"])
            starts.append(api["start"])
            ends.append(api["end"])
            widths.append(api["width"])
            strands.append(r["strand"])
            symbols.append(r["gene_symbol"])
            gene_ids.append(r["gene_id"])
            tx_ids.append(r["transcript_id"])
            ftypes.append(r["feature_type"])
        return {
            "class": "GRanges",
            "seqnames": [chr_name] * len(rows),
            "ranges": {"start": starts, "end": ends, "width": widths},
            "strand": strands,
            "mcols": {
                "gene_symbol": symbols, "gene_id": gene_ids,
                "transcript_id": tx_ids, "feature_type": ftypes,
            },
            "n": len(rows),
        }
    elif layer_type == "probe":
        starts, ends, widths, probe_ids, symbols, contexts = [], [], [], [], [], []
        for r in rows:
            api = db_to_api(r["pos"], r["end_pos"])
            starts.append(api["start"])
            ends.append(api["end"])
            widths.append(api["width"])
            probe_ids.append(r["probe_id"])
            symbols.append(r["gene_symbol"])
            contexts.append(r["cpg_context"])
        return {
            "class": "GRanges",
            "seqnames": [chr_name] * len(rows),
            "ranges": {"start": starts, "end": ends, "width": widths},
            "strand": ["*"] * len(rows),
            "mcols": {"probe_id": probe_ids, "gene_symbol": symbols, "cpg_context": contexts},
            "n": len(rows),
        }
    elif layer_type == "isochore":
        starts, ends, widths, gc_contents, classes = [], [], [], [], []
        for r in rows:
            api = db_to_api(r["start_pos"], r["end_pos"])
            starts.append(api["start"])
            ends.append(api["end"])
            widths.append(api["width"])
            gc_contents.append(r["gc_content"])
            classes.append(r["isochore_class"])
        return {
            "class": "GRanges",
            "seqnames": [chr_name] * len(rows),
            "ranges": {"start": starts, "end": ends, "width": widths},
            "strand": ["*"] * len(rows),
            "mcols": {"gc_content": gc_contents, "isochore_class": classes},
            "n": len(rows),
        }
    return {"n": 0}
```

**Step 4: Register router in main.py**

```python
from polymer_genomics.routers.regions import router as regions_router
app.include_router(regions_router)
```

**Step 5: Add seed_genomic_data fixture to conftest.py**

This fixture seeds a small amount of test data (a few CpG sites on chr16) for integration tests. The exact insertion SQL should create partitions for chr16 if not already created by init.sql. For the test to work, the ingestion pipeline (Task 8) must have created the chr16 partition, OR the test fixture creates it inline.

For now, add a fixture that creates the partition + inserts test rows:

```python
@pytest.fixture
async def seed_genomic_data(seed_layers):
    """Insert small test dataset for region queries."""
    from polymer_genomics.db import get_pool
    pool = await get_pool()
    async with pool.acquire() as conn:
        # Get layer IDs
        cpg_layer = await conn.fetchval(
            "SELECT id FROM registry.layers WHERE layer_key = 'cpg_sites'"
        )
        # Create chr16 partition if not exists
        await conn.execute("""
            DO $$
            BEGIN
                EXECUTE 'CREATE TABLE IF NOT EXISTS cpg.sites_hg38_chr16
                    PARTITION OF cpg.sites_hg38 FOR VALUES IN (16)';
            EXCEPTION WHEN duplicate_table THEN NULL;
            END $$;
        """)
        await conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_cpg_sites_hg38_chr16
                ON cpg.sites_hg38_chr16 USING GiST (chr_id, coord)
        """)
        # Insert test CpG sites (0-based positions)
        await conn.execute("""
            INSERT INTO cpg.sites (layer_id, build, chr_id, pos, context, gc_content)
            VALUES
                ($1, 'hg38', 16, 70699929, 'island', 0.62),
                ($1, 'hg38', 16, 70699940, 'island', 0.61),
                ($1, 'hg38', 16, 70699960, 'shore', 0.55)
        """, cpg_layer)
    yield
    async with pool.acquire() as conn:
        await conn.execute("DELETE FROM cpg.sites WHERE chr_id = 16")
```

**Step 6: Run tests**

Run: `uv run pytest tests/test_regions.py -v`
Expected: ALL PASS

**Step 7: Commit**

```bash
git add src/polymer_genomics/routers/regions.py src/polymer_genomics/queries.py tests/test_regions.py tests/conftest.py src/polymer_genomics/main.py
git commit -m "feat: add region query endpoint with GiST overlap and coordinate conversion"
```

---

### Task 7: Gene, probe, and search endpoints

**Files:**
- Create: `src/polymer_genomics/routers/genes.py`
- Create: `src/polymer_genomics/routers/probes.py`
- Create: `src/polymer_genomics/routers/search.py`
- Create: `tests/test_genes.py`
- Create: `tests/test_probes.py`
- Create: `tests/test_search.py`

This task follows the same TDD pattern as Task 6. For each router:

1. Write failing tests that verify the endpoint contract (response shape, coordinate convention, error codes)
2. Implement the router with parameterized SQL
3. Register in main.py
4. Run tests, verify pass
5. Commit

**Key implementation notes:**

- Gene endpoint: query by `gene_symbol` index, return GRanges with all features for that gene
- Probe endpoint: query by `probe_id` unique index, include crossmap via JOIN to `probe.map_edges`
- Probe batch: POST endpoint accepting up to 10K probe IDs, parameterized with `ANY($1)`
- Search: `gene_symbol ILIKE $1 || '%'` for prefix, exact match sorted first, limit 20
- All endpoints use the same `build_envelope()` and `db_to_api()` converters

**Commit after each router passes its tests (3 separate commits).**

---

### Task 8: Aggregation and tile endpoints

**Files:**
- Create: `src/polymer_genomics/routers/aggregation.py`
- Create: `src/polymer_genomics/routers/tiles.py`
- Create: `tests/test_aggregation.py`
- Create: `tests/test_tiles.py`

**Key implementation notes:**

- Aggregation: SQL `COUNT(*) / width()` for density, `AVG()` for means, `GROUP BY` bin
- Bins computed as: `floor(pos / bin_size) * bin_size` in SQL
- Tile endpoint: thin wrapper around region query. Tile index → start/end math per Contract 4
- Tile resolution must be one of `{1000, 10000, 100000, 1000000}` — validate as enum
- Empty tiles return `{"data": {}, "n": 0}`, status 200 (not 404)
- Add `Cache-Control` headers for immutable layer tiles

**TDD: write tile math tests first (pure functions, no DB), then integration tests.**

---

### Task 9: Bulk download endpoints

**Files:**
- Create: `src/polymer_genomics/routers/bulk.py`
- Create: `src/polymer_genomics/s3.py`
- Create: `tests/test_bulk.py`

**Key implementation notes:**

- `s3.py`: wrapper around boto3 to generate presigned URLs from `storage.objects` table
- Bulk endpoint: look up layer in `storage.objects`, generate presigned URL with 1h expiry
- Response includes `content_hash`, `size_bytes`, `row_count`, `format`, `layer_version`
- For MinIO locally, presigned URLs work the same as S3
- Test with a real MinIO upload + presigned URL round-trip

---

## Phase 2: Data Ingestion Pipeline

### Task 10: Ingestion framework — partition creator + batch loader

**Files:**
- Create: `src/polymer_genomics/ingest/__init__.py`
- Create: `src/polymer_genomics/ingest/partitions.py`
- Create: `src/polymer_genomics/ingest/loader.py`
- Create: `tests/test_ingest.py`

**Key implementation notes:**

- `partitions.py`: given a table name + build + list of chr_ids, creates LIST partitions + GiST indexes
- Uses `ingest_writer` role, NOT admin
- `loader.py`: batch COPY into staging table → merge into target via INSERT...ON CONFLICT
- Computes `content_hash` (SHA-256 of all rows in canonical sort order) after load
- Updates `registry.layers.row_count` and `content_hash`
- Refreshes affected materialized views

**This is the automation behind the invariant "ingestion pipeline creates partitions + indexes automatically."**

---

### Task 11: Chromosome lengths seeder

**Files:**
- Create: `src/polymer_genomics/ingest/seed_chromosomes.py`

**Step 1: Write seeder that populates `ref.chromosomes` with actual lengths**

Use known hg37/hg38 chromosome lengths (hardcoded from UCSC). This is a one-time seed.

```python
# Known lengths — these are facts, not copyrightable
HG38_LENGTHS = {
    "chr1": 248956422, "chr2": 242193529, "chr3": 198295559,
    # ... all 25 chromosomes
}
```

**Step 2: Run seeder against local Docker Postgres**

Run: `uv run python -m polymer_genomics.ingest.seed_chromosomes`

**Step 3: Verify**

Run: `docker compose exec postgres psql -U admin -d polymer_genomics -c "SELECT chr_name, length_hg38 FROM ref.chromosomes WHERE chr_id = 1;"`
Expected: `chr1 | 248956422`

**Step 4: Commit**

---

### Task 12: Gene model ingestion (GENCODE v44)

**Files:**
- Create: `src/polymer_genomics/ingest/genes.py`
- Create: `data/README.md` (document data sources)

**Key implementation notes:**

- Download GENCODE v44 GTF (hg38) from gencodegenes.org
- Parse GTF, convert 1-based closed → 0-based half-open on ingest
- Store `source_start`, `source_end`, `source_convention: "1based_closed"` in metadata
- Create partitions per chromosome via `partitions.py`
- For hg37: download GENCODE v44lift37 GTF, same process
- Register layer in `registry.layers` with content_hash
- ~2.7M rows, expect ~5-10 min ingestion

---

### Task 13: CpG sites + islands ingestion

**Files:**
- Create: `src/polymer_genomics/ingest/cpg.py`

**Key implementation notes:**

- CpG sites: scan hg38 FASTA for all CG dinucleotides, record 0-based position
- CpG islands: download UCSC CpG island track (hg38 + hg37)
- Annotate each CpG site with island/shore/shelf/open_sea context
- Compute local GC content (e.g., 500bp window)
- ~28M rows per build — use COPY for bulk load, not INSERT
- This is the largest single ingestion (~2 GB in Postgres)

---

### Task 14: Probe manifest ingestion (derived)

**Files:**
- Create: `src/polymer_genomics/ingest/probes.py`

**Key implementation notes:**

- Source: sesameData or Bioconductor manifests (via R script or pre-exported CSV)
- Extract ONLY: probe_id, chr, pos, strand — no Illumina proprietary columns
- Derive: gene_symbol (nearest gene from GENCODE), cpg_context (from CpG islands)
- Cross-map: match probes across platforms by (chr, pos) exact match first, then coordinate overlap
- Populate `probe.map_edges` with method and confidence
- 3 platforms × 2 builds = 6 layer registrations

---

### Task 15: Methylation atlas ingestion

**Files:**
- Create: `src/polymer_genomics/ingest/methylation.py`

**Key implementation notes:**

- Source: published hematopoietic cell-type reference (Reinius 2012, Salas 2018, or similar)
- Process into: per-cell-type BigWig (for region queries) + Parquet (for analytics)
- Upload BigWig + Parquet to MinIO/S3
- Register in `storage.objects` with content_hash
- Register manifest in `methylation.atlas_layers`
- Pre-compute 10kb summary bins, upload as separate Parquet

---

### Task 16: Isochore computation + ingestion

**Files:**
- Create: `src/polymer_genomics/ingest/isochores.py`

**Key implementation notes:**

- Compute GC content in sliding windows (e.g., 300kb) across genome
- Classify into Bernardi isochore bands (L1: <37%, L2: 37-41%, H1: 41-46%, H2: 46-53%, H3: >53%)
- Store in `ref.isochores` with GiST index
- Small table (~3,200 rows per build)

---

## Phase 3: Minimal Genome Viewer

### Task 17: Next.js project scaffold

**Files:**
- Create: `viewer/package.json`
- Create: `viewer/next.config.js`
- Create: `viewer/tailwind.config.js`
- Create: `viewer/src/app/layout.tsx`
- Create: `viewer/src/app/page.tsx`

**Step 1: Initialize Next.js project**

Run: `cd /Users/zbb2/Desktop/PolymerGenomicsAPI && npx create-next-app@latest viewer --typescript --tailwind --app --src-dir --no-eslint --no-import-alias`

**Step 2: Add Zustand**

Run: `cd viewer && npm install zustand`

**Step 3: Create viewport store**

```typescript
// viewer/src/stores/viewport.ts
import { create } from 'zustand';

interface ViewportState {
  build: 'hg37' | 'hg38';
  chr: string;
  start: number;
  end: number;
  resolution: 1000 | 10000 | 100000 | 1000000;
  activeLayers: string[];
  setBuild: (build: 'hg37' | 'hg38') => void;
  setRegion: (chr: string, start: number, end: number) => void;
  setLayers: (layers: string[]) => void;
  toggleLayer: (layer: string) => void;
}

function autoResolution(start: number, end: number): 1000 | 10000 | 100000 | 1000000 {
  const width = end - start;
  if (width < 50_000) return 1000;
  if (width < 500_000) return 10_000;
  if (width < 5_000_000) return 100_000;
  return 1_000_000;
}

export const useViewport = create<ViewportState>((set) => ({
  build: 'hg38',
  chr: 'chr1',
  start: 1,
  end: 100_000,
  resolution: 10_000,
  activeLayers: ['gencode_v44', 'cpg_sites'],
  setBuild: (build) => set({ build }),
  setRegion: (chr, start, end) =>
    set({ chr, start, end, resolution: autoResolution(start, end) }),
  setLayers: (layers) => set({ activeLayers: layers }),
  toggleLayer: (layer) =>
    set((state) => ({
      activeLayers: state.activeLayers.includes(layer)
        ? state.activeLayers.filter((l) => l !== layer)
        : [...state.activeLayers, layer],
    })),
}));
```

**Step 4: Verify dev server starts**

Run: `cd viewer && npm run dev`
Expected: Next.js dev server on localhost:3000

**Step 5: Commit**

---

### Task 18: API client + tile fetcher

**Files:**
- Create: `viewer/src/lib/api.ts`
- Create: `viewer/src/lib/tiles.ts`

**Key implementation notes:**

- `api.ts`: typed fetch wrapper for the Polymer Genomics API
- `tiles.ts`: tile coordinator — calculates needed tile indices from viewport, fetches uncached tiles, manages LRU cache (Map, ~500 tiles)
- Prefetch ±2 tiles in pan direction

---

### Task 19: Canvas track renderers

**Files:**
- Create: `viewer/src/components/tracks/GeneTrack.tsx`
- Create: `viewer/src/components/tracks/CpgSiteTrack.tsx`
- Create: `viewer/src/components/tracks/CpgIslandTrack.tsx`
- Create: `viewer/src/components/tracks/ProbeTrack.tsx`
- Create: `viewer/src/components/tracks/IsochoreTrack.tsx`
- Create: `viewer/src/components/tracks/MethylationTrack.tsx`
- Create: `viewer/src/components/TrackStack.tsx`

**Key implementation notes:**

- Each track is a React component wrapping a `<canvas>` element
- Receives tile data as props, renders using Canvas 2D API
- `TrackStack` vertically composes tracks based on `activeLayers`
- Gene track: thick exon bars, thin intron lines, strand arrows, gene labels
- CpG site track: vertical tick marks (fine zoom) / density bars (coarse zoom)
- Probe track: inverted triangles, color-coded by platform
- Methylation track: blue→red heatmap, one row per cell type
- Isochore track: colored horizontal bands (L1→H3 palette)

---

### Task 20: Navigation, search, and detail panel

**Files:**
- Create: `viewer/src/components/SearchBar.tsx`
- Create: `viewer/src/components/NavigationBar.tsx`
- Create: `viewer/src/components/LayerToggle.tsx`
- Create: `viewer/src/components/DetailPanel.tsx`
- Create: `viewer/src/app/view/[build]/[region]/page.tsx`

**Key implementation notes:**

- SearchBar: calls `/v1/search?q=...`, navigates viewport to result
- NavigationBar: shows current region, pan left/right buttons, zoom slider
- LayerToggle: fetches `/v1/layers`, renders checkboxes that call `toggleLayer()`
- DetailPanel: on track feature click, shows all metadata, "Copy probe ID", "View in R", "API JSON"
- Route `/view/hg38/chr16:70699930-70700000` → deep-linkable viewer page

---

## Phase 4: MCP Wrapper & R Client

### Task 21: MCP server wrapping the API

**Files:**
- Create: `mcp/server.py` (or `mcp/index.ts` depending on MCP SDK choice)

**Key implementation notes:**

- Thin wrapper: each MCP tool maps to one or more API calls
- Tools: `list_layers`, `query_region`, `lookup_gene`, `lookup_probe`, `crossmap_probes`, `aggregate_region`, `search`, `bulk_download`
- Returns JSON that agents can parse
- Configured as a stdio MCP server for Claude Code integration

---

### Task 22: R client package scaffold

**Files:**
- Create: `r-client/DESCRIPTION`
- Create: `r-client/R/connection.R`
- Create: `r-client/R/region.R`
- Create: `r-client/R/probes.R`
- Create: `r-client/R/genes.R`
- Create: `r-client/R/bulk.R`
- Create: `r-client/tests/testthat/test-region.R`

**Key implementation notes:**

- Standard R package structure (devtools/usethis)
- Depends: httr2, jsonlite, GenomicRanges, IRanges, S4Vectors
- Each function: call API → parse JSON → construct GRanges/DataFrame
- `pg_connect()` stores API key in package environment
- `pg_region()` → GRanges, `pg_gene()` → GRangesList, `pg_probes()` → DataFrame
- `pg_bulk()` → download presigned URL → readRDS() → GRanges
- Hash verification on bulk downloads

---

## Phase 5: Integration Testing & Documentation

### Task 23: End-to-end integration tests

**Files:**
- Create: `tests/integration/test_e2e.py`

**Key implementation notes:**

- Full round-trip: ingest test data → query API → verify response shape + coordinates
- Coordinate round-trip test (Contract 1 CI invariant)
- Pagination round-trip test (resume cursor, no duplicates, no gaps)
- Multi-layer region query test (interleaved ordering)
- Truncation signal test (seed > max_returned_rows)
- Rate limit test (if middleware is in place)

---

### Task 24: OpenAPI spec generation + validation

**Files:**
- Create: `scripts/export_openapi.py`

**Key implementation notes:**

- FastAPI auto-generates OpenAPI 3.1 spec
- Export to `docs/openapi.yaml`
- Validate with `openapi-spec-validator`
- Commit the spec as a versioned artifact

---

### Task 25: Deployment config (Docker production build)

**Files:**
- Create: `Dockerfile`
- Create: `docker-compose.prod.yml`

**Key implementation notes:**

- Multi-stage build: uv install → slim runtime image
- Production compose: API + Postgres (no MinIO — real S3 in prod)
- Health check endpoint
- Environment-based config (no .env file in prod, use secrets manager)

---

## Execution Order & Dependencies

```
Phase 0: Task 1 → Task 2 → Task 3
Phase 1: Task 4 → Task 5 → Task 6 → Task 7 → Task 8 → Task 9
Phase 2: Task 10 → Task 11 → Task 12 → Task 13 → Task 14 → Task 15 → Task 16
Phase 3: Task 17 → Task 18 → Task 19 → Task 20
Phase 4: Task 21 (parallel with Task 22)
Phase 5: Task 23 → Task 24 → Task 25

Phase 0 blocks all others.
Phase 1 blocks Phase 2 (need API to test ingestion results).
Phase 2 blocks Phase 3 (need data to render).
Phase 1 blocks Phase 4 (MCP/R client wrap the API).
Everything blocks Phase 5.
```

Estimated: ~25 tasks, each 30-120 minutes depending on data volume.
