# ──────────────────────────────────────────────────────────────────
# Polymer Genomics API — Makefile
# ──────────────────────────────────────────────────────────────────
#
# Usage:
#   make up          Start local dev (Postgres + MinIO)
#   make ingest      Run full hg38 ingestion pipeline
#   make api         Start the API server
#   make viewer      Start the Next.js viewer
#   make dev         Start API + viewer together
#   make test        Run all tests
#   make deploy      Deploy to Fly.io
#

.PHONY: help up down ingest api viewer dev test lint check deploy \
        seed genes cpg probes isochores health

# ── Defaults ──────────────────────────────────────────────────────

BUILD ?= hg38
API_PORT ?= 8000

# ── Help ──────────────────────────────────────────────────────────

help: ## Show this help
	@echo ""
	@echo "  Polymer Genomics API"
	@echo "  ━━━━━━━━━━━━━━━━━━━━"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2}'
	@echo ""

# ── Infrastructure ────────────────────────────────────────────────

up: ## Start local dev stack (Postgres + MinIO)
	docker compose up -d
	@echo ""
	@echo "  Waiting for Postgres..."
	@sleep 3
	@docker compose exec -T postgres pg_isready -U admin -d polymer_genomics || \
		(echo "  Postgres not ready yet, waiting 5 more seconds..." && sleep 5)
	@echo "  ✓ Local stack running"

down: ## Stop local dev stack
	docker compose down

# ── Data Ingestion ────────────────────────────────────────────────

seed: ## Seed chromosome lengths
	uv run python -m polymer_genomics.ingest.seed_chromosomes

genes: ## Ingest GENCODE v44 gene models
	uv run python -m polymer_genomics.ingest.genes --build $(BUILD)

cpg: ## Ingest CpG sites + islands
	uv run python -m polymer_genomics.ingest.cpg --build $(BUILD)

probes: ## Ingest Illumina probe manifests
	uv run python -m polymer_genomics.ingest.probes --build $(BUILD)

isochores: ## Compute and ingest isochores
	uv run python -m polymer_genomics.ingest.isochores --build $(BUILD)

ingest: ## Run full ingestion pipeline (all steps)
	bash scripts/ingest_all.sh

# ── Development ───────────────────────────────────────────────────

api: ## Start the API server
	uv run uvicorn polymer_genomics.main:app --host 0.0.0.0 --port $(API_PORT) --reload

viewer: ## Start the Next.js viewer
	cd viewer && npm run dev

dev: ## Start API + viewer (requires 2 terminals — prints instructions)
	@echo ""
	@echo "  Start in two terminals:"
	@echo "    Terminal 1:  make api"
	@echo "    Terminal 2:  make viewer"
	@echo ""
	@echo "  Or use: make api & make viewer"
	@echo ""

health: ## Check API health
	@curl -sf http://localhost:$(API_PORT)/health | python3 -m json.tool

# ── Testing ───────────────────────────────────────────────────────

test: ## Run all tests
	uv run pytest tests/ -v

lint: ## Run linter + type checker
	uv run ruff check src/ tests/
	uv run ruff format --check src/ tests/

check: lint test ## Run lint + test

# ── Deployment ────────────────────────────────────────────────────

deploy: ## Deploy to Fly.io
	fly deploy

openapi: ## Export OpenAPI spec
	uv run python scripts/export_openapi.py

# ── Shortcuts ─────────────────────────────────────────────────────

brca1: ## Quick test: query BRCA1 region
	@curl -sf "http://localhost:$(API_PORT)/v1/genes/$(BUILD)/BRCA1" | python3 -m json.tool | head -40

tp53: ## Quick test: query TP53
	@curl -sf "http://localhost:$(API_PORT)/v1/genes/$(BUILD)/TP53" | python3 -m json.tool | head -40

search: ## Quick test: search genes (usage: make search Q=BRC)
	@curl -sf "http://localhost:$(API_PORT)/v1/search?q=$(Q)&build=$(BUILD)" | python3 -m json.tool
