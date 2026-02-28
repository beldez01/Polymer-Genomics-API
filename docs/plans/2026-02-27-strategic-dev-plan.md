# Polymer Genomics — Strategic Development Plan

**Date:** 2026-02-27
**Author:** Zach Belden + Claude
**Status:** Draft for review

---

## The Diagnosis

You have built ~80% of a production-grade genomics reference API. The code is clean, the architecture is sound, the contracts are rigorous. But the database is empty, the pipeline hasn't run, and nothing is deployed. You've been building for a team that doesn't exist yet, and your standards keep you from shipping anything less than comprehensive.

You said the blocker is you. Here's what that means concretely: you keep starting from infrastructure up instead of from a use case down. The epistemic OS became too complex. The agent bioinformatics platform became too complex. Now the database API is at risk of the same fate — not because it's bad, but because you're trying to ship three products simultaneously (API, viewer, MCP agent layer) with 10-20 hours per week.

The strategic question isn't "what should I build?" — you've already built most of it. The question is "what do I turn on first, and what do I defer?"

---

## The Core Thesis

> The past 20 years of Big Data collected successfully but failed at utilization. Agents change the equation. Polymer is the Apple of UCSC — beautiful, agent-native, accessible to pathologists.

This is a strong thesis. But "Apple of UCSC" is a *destination*, not a starting point. Apple shipped the iPod before the iPhone. You need your iPod.

---

## What You Have (Honest Inventory)

### Ready to Ship (code complete, needs data + deployment)

- FastAPI with 9 routers, uniform response envelope, coordinate conversion
- PostgreSQL schema with GiST-indexed partitioned tables, role-based security
- Ingestion pipeline for GENCODE v44, CpG sites/islands, Illumina probes, isochores, methylation
- MCP server with 8 tools wrapping the REST API
- R client package skeleton (httr2, Bioconductor S4 objects)
- Docker multi-stage build, docker-compose for dev and prod
- 23+ test files covering coordinates, envelope, routers, ingestion

### Partially Downloaded Source Data

- `hg38.fa` (3.2 GB) — present with `.fai` index
- `gencode.v44.annotation.gtf.gz` — present
- CpG islands, Illumina manifests, hg37 FASTA/GTF — not yet downloaded

### Not Shippable Yet

- Viewer: scaffold exists (Next.js + Zustand + Canvas tracks) but no data to render
- No authentication or rate limiting
- No real deployment (no hosted Postgres, no S3 bucket provisioned)
- R client incomplete (only `connection.R` and `bulk.R` have real code)

---

## The Plan: Three Phases, Ruthlessly Scoped

### Phase 1: "Turn It On" (Weeks 1-3, ~40-60 hours)

**Goal:** Run the ingestion pipeline against real data, get the API serving real queries, and use the MCP server yourself in Claude Code for actual pathology/bioinformatics work. This is the iPod.

**Why this first:** You are the first user. If *you* can't use it daily, no one else will either. The MCP server is your highest-leverage artifact — it lets you (and Claude) do real genomics work against your own curated database. That daily use generates the feedback loop you've been missing.

#### Week 1: Data Ingestion

1. **Run `docker compose up -d`** — get Postgres + MinIO running locally
2. **Seed chromosomes:** `uv run python -m polymer_genomics.ingest.seed_chromosomes`
3. **Ingest GENCODE v44 (hg38 only):** `uv run python -m polymer_genomics.ingest.genes --build hg38`
   - Source data already present. Expect ~2.7M rows, ~10 min.
4. **Ingest CpG sites + islands (hg38 only):** `uv run python -m polymer_genomics.ingest.cpg --build hg38`
   - Requires hg38.fa (present) + UCSC island download (automated). Expect ~28M rows, ~30-60 min.
5. **Download + ingest probe manifests (hg38 only):**
   - Export CSVs from sesameData via a small R script, then: `uv run python -m polymer_genomics.ingest.probes --build hg38`
6. **Compute isochores (hg38 only):** `uv run python -m polymer_genomics.ingest.isochores --build hg38`

**Defer:** hg37 builds (add later), methylation atlas (complex, not needed for core loop)

**Validation:** After ingestion, run: `curl localhost:8000/health` — should show `chromosome_count: 25`. Then: `curl localhost:8000/v1/regions/hg38/chr17:43044295-43170245?layers=gencode_v44` — should return BRCA1 gene features.

#### Week 2: MCP Server + Daily Use

7. **Configure MCP server** in your Claude Code settings:
   ```json
   {
     "mcpServers": {
       "polymer-genomics": {
         "command": "uv",
         "args": ["run", "python", "-m", "polymer_genomics_mcp"],
         "cwd": "/path/to/PolymerGenomicsAPI/mcp",
         "env": { "POLYMER_API_BASE": "http://localhost:8000" }
       }
     }
   }
   ```
8. **Use it for real work.** Every time you need to look up a gene, check a probe, or query a region during fellowship work — use the MCP tools instead of UCSC or Ensembl. Keep a running list of:
   - What works well
   - What's missing (which queries do you wish existed?)
   - What's slow
   - What's confusing in the response format

9. **Fix what blocks you** — this is your feedback loop. If the search is too slow, add an index. If you need a query that doesn't exist, add an endpoint. If the MCP tool descriptions are confusing for Claude, rewrite them.

#### Week 3: Minimal Deployment

10. **Deploy to a cheap VPS** (Hetzner, Railway, or Fly.io) with a managed Postgres instance (Neon or Supabase free tier, or a small dedicated Postgres).
    - The Docker multi-stage build is already written
    - Use `docker-compose.prod.yml` as a starting point
    - Set real environment variables, no `.env` file
11. **Point MCP server at the deployed API** — now it works from anywhere, not just your laptop
12. **Add a simple API key** (single static key in an env var, checked via middleware) — enough for personal use, prevents drive-by abuse

**What you DON'T do in Phase 1:**
- No viewer work
- No hg37 builds
- No methylation data
- No authentication system
- No rate limiting
- No public documentation

**Milestone:** You are using Polymer daily via MCP in Claude Code for real pathology/bioinformatics questions, against real data, on a deployed server.

---

### Phase 2: "The Demo" (Weeks 4-6, ~40-60 hours)

**Goal:** Get the viewer to a state where you can show someone a 30-second demo: search for BRCA1, see gene features + CpG islands + probes rendered beautifully, deep-link to the region.

**Why this second:** The viewer is your "Apple of UCSC" differentiator. But it's useless without data (Phase 1) and premature without feedback from daily use. After 2-3 weeks of using the MCP server, you'll know which data layers matter most and what the viewer should prioritize.

#### Viewer MVP

13. **Get the viewer rendering real data against your deployed API**
    - Wire up the Next.js proxy to your API endpoint
    - Verify the GeneTrack, CpgIslandTrack, and ProbeTrack render correctly with real data
    - The canvas renderers are already written — this is mostly integration work

14. **Polish the landing page**
    - Search bar that actually works (gene symbol → navigate to region)
    - Build selector (hg38 for now, grey out hg37)
    - Default view: a curated "interesting" region (your VAC14 default is fine)

15. **Deploy the viewer** alongside the API
    - Next.js on Vercel (free) or same VPS
    - Proxy `/api/*` to the Polymer API

16. **Create 3-5 "showcase regions"** — curated deep links that demonstrate value:
    - BRCA1/BRCA2 (every pathologist knows these)
    - A region with dense CpG islands + methylation-relevant probes
    - A gene relevant to your fellowship work
    - A region where the probe crossmap reveals interesting platform differences

**What you DON'T do in Phase 2:**
- No methylation heatmap track (needs atlas data, deferred)
- No mobile responsive design
- No user accounts
- No public API documentation

**Milestone:** You have a URL you can text to a colleague that shows them a beautiful, interactive genome browser with real data.

---

### Phase 3: "The Wedge" (Weeks 7-12, ~60-120 hours)

**Goal:** Find the one use case that makes someone other than you come back. Based on your thesis, the most likely wedge is one of:

#### Option A: Agent Bioinformatician Toolkit

Package the MCP server as a standalone tool that any Claude Code user can install to get instant genomic reference lookups. This is the "agent-native" part of your thesis.

- Publish the MCP server config as a one-line install
- Write 3-5 example workflows: "variant interpretation with Polymer," "methylation probe QC with Polymer," "gene set enrichment with Polymer"
- Publish to the MCP server registry (if one exists by then) or as a GitHub README

**Target user:** Other pathology residents / bioinformaticians who use Claude Code.

#### Option B: Pathology Resident's Genome Browser

Extend the viewer with features that matter specifically to pathology residents doing molecular work:

- Variant annotation overlay (paste a VCF line, see it in context)
- Probe panel visualization (given a list of probes from a clinical panel, show where they are)
- "Explain this region" button that uses the MCP server to generate a plain-English summary

**Target user:** Pathology residents who are not bioinformaticians but need to understand molecular results.

#### Option C: R/Bioconductor Package

Complete the R client, publish to Bioconductor, and write a vignette showing how `polymergenomics` replaces the 5 packages people currently juggle for reference annotations.

**Target user:** Bioinformaticians tired of `rtracklayer` + `GenomicFeatures` + `IlluminaHumanMethylation450kanno` + manual UCSC downloads.

**Recommendation:** Start with Option A. It requires the least new code (the MCP server is already built), has the clearest value proposition ("instant genomic lookups in your AI coding assistant"), and serves your primary users (yourself + agents). Options B and C are where you go *after* you have signal from Option A.

---

## What to Cut (Permanently or Indefinitely)

- **The Epistemic Operating System:** The claim-curation, neuro-symbolic knowledge graph concept is brilliant but is a 5-person, 2-year project. Polymer's value is as the *data substrate* for such a system, not the system itself. If someone builds that system later, they'll want Polymer underneath it.

- **hg37 support in V1:** Only add it when someone asks for it. GRCh37 is legacy. Focus on hg38.

- **Methylation atlas in V1:** This is the most complex ingestion pipeline (BigWig + Parquet + S3) and the least demanded data layer. Add it when the viewer can render it and someone wants it.

- **Authentication/multi-tenancy:** Personal use + API key is sufficient for months. Don't build auth until you have users who need different access levels.

- **The R client (beyond skeleton):** Unless you're going the Bioconductor route (Option C), the MCP server is more impactful than the R client.

---

## Architecture Decisions to Lock In

These are already correct in your codebase. Don't revisit them:

1. **Coordinate conversion at the serializer layer.** Your `db_to_api`/`api_to_db` functions are clean, tested, and correct. Don't touch them.

2. **GiST-indexed partitioned tables.** The `int4range` + `&&` overlap pattern is the right query primitive for genomic intervals. Your partitioning by build → chr_id is correct.

3. **Content hashing for layer versioning.** The deterministic `_encode_value` → SHA-256 pipeline guarantees reproducibility. This is a real differentiator.

4. **MCP as the agent interface.** Don't expose the database directly to agents. The API-as-boundary pattern is correct and your MCP tool signatures are well-designed for agent composition.

5. **Response envelope with `layers_resolved`.** This is the reproducibility contract that makes Polymer trustworthy for research. Keep it.

---

## Weekly Cadence

Given 10-20 hours/week, here's a sustainable rhythm:

- **Monday evening (2-3 hrs):** Plan the week's goals, review what's blocking
- **Wednesday evening (2-3 hrs):** Core development work
- **Saturday morning (4-6 hrs):** Deep work session (ingestion runs, viewer integration, deployment)
- **Sunday (1-2 hrs):** Testing, documentation, commit cleanup

**Rule:** Every week must end with something *working* that didn't work before. Not something designed. Not something planned. Something running.

---

## Success Metrics (Be Honest With Yourself)

### Phase 1 (Week 3)
- [ ] API serves real data from all 4 hg38 layers (genes, CpG, probes, isochores)
- [ ] MCP server works in Claude Code against deployed API
- [ ] You used Polymer for real work at least 5 times this week

### Phase 2 (Week 6)
- [ ] Viewer renders real data at a URL you can share
- [ ] You showed the demo to at least one colleague
- [ ] You collected at least 3 pieces of feedback

### Phase 3 (Week 12)
- [ ] At least one person who isn't you used Polymer for something real
- [ ] You know which wedge (A/B/C) has the most traction
- [ ] You have a backlog driven by real user needs, not imagination

---

## The Meta-Lesson

Your taste is your moat. The coordinate conversion rigor, the content hashing, the probe crossmap epistemology — these aren't over-engineering, they're the things that make Polymer trustworthy for real research. The problem isn't your standards. It's that you apply them uniformly to everything instead of sequentially to each layer.

Ship the data layer. Use it yourself. Let the feedback tell you what to build next.
