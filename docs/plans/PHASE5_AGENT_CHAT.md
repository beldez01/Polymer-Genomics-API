# Phase 5 — Embedded Agent Chat + Methylation Upload

*Created: 2026-03-04. Status: PLAN — not yet implementing.*

---

## Vision

polymerbio.org becomes the product. The genome browser and gene pages are the draw. An embedded chat agent lives inside the viewer — not as a separate app, but as a feature of every page. Users ask questions about what they're looking at, and the agent answers using the API's own data layers. Separately, a methylation upload flow lets users submit IDATs and get annotated results, which the agent can then explain.

**What this is NOT:**
- Not an IDE (no terminal, no file browser, no code editing)
- Not a multi-agent colony (one agent, one system prompt)
- Not a general bioinformatics platform (methylation-focused, reference-data-rich)
- Not Claude Code or the Agent SDK (standard Messages API with tool_use)

---

## Architecture

```
┌─────────────────────────────────────────────────┐
│  polymerbio.org (Next.js on Vercel)             │
│                                                 │
│  ┌──────────────┐  ┌────────────────────────┐   │
│  │ Genome Viewer │  │ Gene Page / Atlas      │   │
│  │ /view/...     │  │ /gene/... /atlas       │   │
│  └──────┬───────┘  └──────────┬─────────────┘   │
│         │                     │                  │
│         ▼                     ▼                  │
│  ┌─────────────────────────────────────────┐     │
│  │  ChatPanel (drawer, bottom-right)       │     │
│  │  - message history (sessionStorage)     │     │
│  │  - SSE streaming                        │     │
│  │  - page context injection               │     │
│  └───────────────┬─────────────────────────┘     │
└──────────────────┼───────────────────────────────┘
                   │ POST /v1/chat (SSE)
                   ▼
┌─────────────────────────────────────────────────┐
│  api.polymerbio.org (FastAPI on Fly.io)         │
│                                                 │
│  ┌─────────────────────────────────────────┐    │
│  │  /v1/chat endpoint                      │    │
│  │  - Anthropic Messages API (tool_use)    │    │
│  │  - ANTHROPIC_API_KEY in server env      │    │
│  │  - system prompt with domain knowledge  │    │
│  │  - tools = internal query functions     │    │
│  │  - rate limiter (per-session)           │    │
│  └──────────┬──────────────────────────────┘    │
│             │ direct function calls             │
│             ▼                                   │
│  ┌─────────────────────────────────────────┐    │
│  │  Existing query layer                   │    │
│  │  gene_query(), region_query(),          │    │
│  │  probe_query(), expression_query()...   │    │
│  │  (already built, already tested)        │    │
│  └─────────────────────────────────────────┘    │
└─────────────────────────────────────────────────┘
```

**Key decision: the agent calls your internal Python functions, not the HTTP API.**
No network round-trip per tool call. No auth overhead. The chat endpoint imports
the same query functions that your routers use. The tools are defined as a list
of dicts matching Anthropic's tool_use schema, and each maps to a direct
`await query_fn(pool, ...)` call.

---

## Step 1 — Backend Chat Endpoint

*~1 day. The core loop.*

### 1.1 New router: `src/polymer_genomics/routers/chat.py`

```python
# Minimal structure — NOT final code, just the shape

from anthropic import AsyncAnthropic
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse

router = APIRouter(prefix="/v1", tags=["chat"])
client = AsyncAnthropic()  # reads ANTHROPIC_API_KEY from env

SYSTEM_PROMPT = """..."""  # see Step 2

TOOLS = [...]  # see Step 3

@router.post("/chat")
async def chat(request: ChatRequest, db=Depends(get_db)):
    """
    Accepts: { messages: [...], context: { page, build, region?, gene?, probe? } }
    Returns: SSE stream of assistant text + tool call indicators
    """
    # 1. Inject page context into system prompt
    # 2. Run tool loop (Claude responds → tool_use → execute → continue)
    # 3. Stream text blocks back as SSE events
    ...
```

### 1.2 Request/response models

```python
class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str

class PageContext(BaseModel):
    page: str                    # "viewer", "gene", "atlas", "home"
    build: str = "hg38"
    region: str | None = None    # if on viewer page
    gene: str | None = None      # if on gene page
    probe: str | None = None     # if navigated via probe search

class ChatRequest(BaseModel):
    messages: list[ChatMessage]  # conversation history
    context: PageContext          # what page the user is on
    session_id: str              # for rate limiting (UUID, generated client-side)
```

### 1.3 SSE streaming format

```
event: text
data: {"content": "BRCA1 is highly constrained..."}

event: tool_call
data: {"tool": "lookup_gene_constraint", "args": {"symbol": "BRCA1"}}

event: tool_result
data: {"tool": "lookup_gene_constraint", "summary": "pLI=1.00, LOEUF=0.21"}

event: done
data: {}
```

The `tool_call` and `tool_result` events let the frontend show "Looking up constraint scores..." while the agent works.

### 1.4 Rate limiting

Simple in-memory rate limiter (no Redis needed at this scale):
- 30 messages per session per hour
- 5 concurrent sessions max (Fly.io 1GB constraint)
- Session = `session_id` from request (UUID stored in sessionStorage)

### 1.5 Dependencies

Add to `pyproject.toml`:
```
anthropic >= 0.40.0
```

Environment variable on Fly.io:
```
ANTHROPIC_API_KEY=sk-ant-...
```

---

## Step 2 — System Prompt

*~2 hrs. This is where your pathologist expertise lives.*

The system prompt is injected at the start of every conversation. It tells Claude
what it is, what it can do, and how to behave. **This is the most important piece
to get right** — it determines the quality of every interaction.

```markdown
You are a genomics assistant embedded in polymerbio.org, a curated genomic
reference platform. You help researchers and clinicians understand genomic data
in context.

## What you can do
- Look up any human gene: coordinates, exons, transcripts, expression, constraint,
  pathways, protein abundance, bioenergetic cost
- Query genomic regions for overlapping annotations: CpG sites, methylation probes,
  regulatory elements (ENCODE cCREs), conservation scores, isochores
- Explain what these annotations mean in plain language
- Cross-reference: "Is this CpG site in a regulatory element?" "Is this gene
  constrained?" "Where is this gene most expressed?"

## What you cannot do
- Run statistical analyses or pipelines (no R execution)
- Access user data or private datasets
- Make clinical diagnostic claims

## How to behave
- Be precise. Cite coordinates, scores, and source datasets.
- Be concise. Lead with the answer, then explain if needed.
- When the user is viewing a specific page, use that context. If they're on the
  TP53 gene page and ask "is it constrained?", you don't need them to say "TP53".
- If a query returns truncated results, say so and suggest how to narrow down.
- For methylation probes, always mention: genomic position, associated gene (if any),
  CpG context (island/shore/shelf/open sea), and which array platforms carry it.
- Explain constraint scores in context: pLI > 0.9 = highly intolerant of loss-of-function.
  LOEUF < 0.35 = strongly constrained. Put these in biological terms.
- For expression data, highlight tissue specificity. "Ubiquitous" vs "tissue-enriched"
  matters for interpretation.

## Page context
The user's current page context is provided with each request. Use it to give
relevant answers without requiring the user to repeat what they're looking at.
```

**This prompt will evolve.** Start minimal, refine based on actual user questions.

---

## Step 3 — Tool Definitions

*~half day. Map Anthropic tool_use schema to your internal functions.*

Define tools that mirror your existing API capabilities but call internal functions
directly. Start with the most useful subset — not all 17 endpoints.

### Launch set (10 tools)

| Tool | Internal function | Why included |
|------|-------------------|--------------|
| `lookup_gene` | `gene_query()` | Core — every gene question starts here |
| `lookup_gene_expression` | `expression_query()` | "Where is this gene expressed?" |
| `lookup_gene_constraint` | `constraint_query()` | "Is this gene important?" |
| `lookup_gene_pathways` | `pathways_query()` | "What does this gene do?" |
| `lookup_gene_cost` | `cost_query()` | Unique to Polymer — bioenergetic context |
| `lookup_probe` | `probe_query()` | Methylation probe context |
| `query_region` | `region_query()` | Everything overlapping a region |
| `aggregate_region` | `aggregate_query()` | Large region density overview |
| `get_sequence` | `sequence_query()` | Raw DNA for motif questions |
| `search_genes` | `search_query()` | Find gene by partial name |

### Deferred (add later based on usage)

| Tool | Reason to defer |
|------|-----------------|
| `batch_probes` | Unlikely in chat context (bulk operation) |
| `bulk_download` | Not a chat interaction |
| `lookup_protein_abundance` | Add if users ask for it |
| `lookup_protein_atlas` | Add if users ask for it |
| `lookup_gene_sets` | Add if users ask for it |
| `list_layers` | Agent can have this knowledge in system prompt |

### Tool execution dispatcher

```python
TOOL_DISPATCH = {
    "lookup_gene": lambda db, args: gene_query(db, args["build"], args["symbol"]),
    "lookup_gene_expression": lambda db, args: expression_query(db, args["build"], args["symbol"]),
    # ... etc
}

async def execute_tool(name: str, args: dict, db) -> dict:
    fn = TOOL_DISPATCH[name]
    return await fn(db, args)
```

---

## Step 4 — Frontend Chat Panel

*~2 days. React component, SSE client, UI.*

### 4.1 Component: `ChatPanel.tsx`

A slide-up drawer anchored to the bottom-right of every page. Not a modal —
the user can still see and interact with the viewer/gene page behind it.

**States:**
- **Collapsed:** Small pill/button: "Ask about this gene" / "Ask about this region"
  (text adapts to page context)
- **Expanded:** Chat history + input field + streaming response area
- **Loading:** Tool call indicators ("Looking up TP53 expression...")

### 4.2 Page context injection

The frontend passes page context with every message:

```typescript
// From viewer page
{ page: "viewer", build: "hg38", region: "chr17:7668402-7687538" }

// From gene page
{ page: "gene", build: "hg38", gene: "TP53" }

// From atlas
{ page: "atlas", build: "hg38" }
```

This lets the agent know what the user is looking at without them having to say it.

### 4.3 SSE client

```typescript
const response = await fetch('/v1/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ messages, context, session_id })
});

const reader = response.body.getReader();
// Parse SSE events, update message state
```

### 4.4 Session persistence

- Messages stored in `sessionStorage` (cleared on tab close — intentional)
- No server-side conversation storage (privacy, simplicity)
- Session ID in `sessionStorage` (UUID, generated on first message)

### 4.5 Design

Follow existing Metrology design system:
- Grayscale palette, monospace accents
- Markdown rendering for agent responses (gene symbols, coordinates, scores)
- Tool call events shown as subtle status line: "Querying TP53 constraint..."
- No avatars, no typing animations, no emoji — clean and clinical

---

## Step 5 — Methylation Upload Flow (Phase 5b)

*~3-4 days. Separate from chat — this is the pipeline feature.*

**Not launching with the chat.** Build the chat first (Steps 1-4), validate it works,
then add this. Including it in this plan because it's the natural next step.

### 5.1 Upload page: `/analyze`

Simple form:
1. Upload IDAT pairs (drag-and-drop or file picker)
2. Select array platform (auto-detected from IDAT if possible)
3. Provide sample sheet (CSV: sample_id, group, sex, age — or manual entry)
4. Submit

### 5.2 Upload flow

```
Browser                          API (Fly.io)                    R Worker
   │                                │                               │
   │── POST /v1/upload/presign ────▶│                               │
   │◀── presigned S3 URL ──────────│                               │
   │── PUT IDATs to S3 ───────────▶│(S3/MinIO)                     │
   │── POST /v1/analyze ──────────▶│                               │
   │                                │── queue job ─────────────────▶│
   │◀── job_id (202 Accepted) ────│                               │
   │                                │                               │
   │   (poll or SSE)                │◀── results ──────────────────│
   │◀── results ready ────────────│                               │
```

### 5.3 R Worker

A stripped-down version of your R-Engine. NOT the full 133-endpoint Plumber server.
One script, one pipeline:

```
IDAT pairs → SeSAMe QCDPB → normalization → detection p-value filter
  → cell deconvolution (FlowSorted.Blood.EPIC)
  → group comparison (limma DMP, DMRcate DMR) if groups provided
  → epigenetic age estimation (Horvath)
  → output: beta matrix, QC report, cell fractions, DMPs, age estimates
```

**Deployment options (choose one):**
- **Option A:** R process on same Fly.io machine (needs upgrade to 4GB RAM, ~$15/mo)
- **Option B:** Separate Fly.io machine for R (~$30/mo, isolated failures)
- **Option C:** Run on your local Mac Mini / server, exposed via Fly.io proxy

Option A is simplest to start. Upgrade if demand grows.

### 5.4 Results annotated against the API

This is the integration point. After the R pipeline produces DMPs:

```python
# For each significant DMP probe:
probe_info = await probe_query(db, "hg38", probe_id)
gene_info = await gene_query(db, "hg38", probe_info.gene_symbol)
constraint = await constraint_query(db, "hg38", probe_info.gene_symbol)
expression = await expression_query(db, "hg38", probe_info.gene_symbol)
region_context = await region_query(db, "hg38", f"{probe_info.chr}:{probe_info.pos-2000}-{probe_info.pos+2000}",
                                     layers="cpg_sites,encode_ccre_v4,phylop_phastcons_100way")
```

Each DMP comes back with: genomic position, gene, CpG context, regulatory overlap,
conservation score, constraint scores, tissue expression — all from your own API.

**This is what nobody else does.** UCSC gives you a browser. Illumina gives you a manifest.
You give a fully contextualized interpretation of every hit.

### 5.5 Results page

- Summary: QC pass/fail, cell composition bar chart, epigenetic age vs chronological
- DMP table: sortable by p-value, delta-beta, gene, with expandable annotation panel
- Each probe links to the viewer at that locus
- The chat agent is available on this page too — "Why is cg08796240 significant?"

---

## Step 6 — Genomics Wiki (Phase 5c)

*Scope TBD. Conceptual — build after chat is validated.*

Curated long-form articles about genomic loci, pathways, and concepts, written by you
(a molecular pathologist), stored in Postgres, indexed by gene/region, surfaceable by
the chat agent.

### Schema sketch

```sql
CREATE TABLE wiki.articles (
    id SERIAL PRIMARY KEY,
    slug TEXT UNIQUE NOT NULL,         -- "tet2-methylation", "cpg-island-biology"
    title TEXT NOT NULL,
    content TEXT NOT NULL,             -- markdown
    gene_symbols TEXT[],               -- genes this article covers
    regions TEXT[],                    -- genomic regions (for spatial indexing)
    tags TEXT[],                       -- "methylation", "constraint", "clinical"
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
);
```

### Agent integration

Add one tool to the chat agent:

```python
{
    "name": "search_wiki",
    "description": "Search the Polymer Genomics wiki for curated articles about genes, pathways, or concepts.",
    "input_schema": {
        "type": "object",
        "properties": {
            "query": {"type": "string", "description": "Search term (gene symbol, concept, or keyword)"}
        },
        "required": ["query"]
    }
}
```

When a user asks "What does TET2 do in hematopoiesis?", the agent can pull your
curated article AND the reference data. Pathologist-written interpretation + structured
data = unique value proposition.

### Content strategy

Start with 10-20 articles on topics you already know deeply:
- TET2 and methylation in myeloid neoplasms
- CpG island biology
- Epigenetic clocks
- Cell-type deconvolution interpretation
- DNMT3A vs TET2 — opposing methylation effects
- IDH mutations as TET2 phenocopies

These are topics where your TET2 research gives you genuine expertise that no
generic LLM can match.

---

## Implementation Sequence

| Step | What | Effort | Depends on | Ships |
|------|------|--------|------------|-------|
| 1 | Backend `/v1/chat` endpoint | 1 day | — | API only (testable via curl) |
| 2 | System prompt | 2 hrs | — | Can draft in parallel with Step 1 |
| 3 | Tool definitions + dispatcher | 4 hrs | Step 1 | Chat can answer questions |
| 4 | Frontend ChatPanel | 2 days | Steps 1-3 | **Chat is live on polymerbio.org** |
| 5 | Methylation upload + R worker | 3-4 days | Steps 1-4 | **Upload + annotated results** |
| 6 | Genomics wiki | ongoing | Steps 1-4 | Growing content library |

**Steps 1-4 are the MVP.** ~4 days of work for a working chat agent on every page.

Step 5 is the second product — methylation analysis with integrated annotation.

Step 6 is a content flywheel that compounds over time.

---

## Cost Model

| Component | Monthly cost |
|-----------|-------------|
| Anthropic API (Sonnet, ~1K conversations) | $10-30 |
| Fly.io API (current, 1GB) | $5 |
| Fly.io API (upgraded to 4GB for R worker) | $15 |
| Vercel (current) | Free tier |
| S3/MinIO for IDAT uploads | ~$1 |
| **Total** | **~$30-50/mo** |

At scale (10K conversations/month), Anthropic costs rise to ~$100-300/mo.
Still cheaper than one GPU-hour on Biomni's infrastructure.

---

## What This Competes With

| Existing tool | What it does | What Polymer does better |
|---------------|-------------|-------------------------|
| UCSC Genome Browser | View annotations at a locus | Clean UI + chat agent that explains what you're seeing |
| Ensembl | Gene pages with cross-references | Integrated bioenergetics, methylation context, constraint in one view |
| GeneCards | Gene summary pages | Structured data from primary sources, not aggregated text |
| Biomni / Galaxy | Run bioinformatics pipelines | Methylation-specific, annotated against 17 curated data layers |
| ShinyMethyl / ChAMP | Methylation QC and analysis | Results automatically contextualized with gene/regulatory/conservation data |

---

## Out of Scope (Intentionally)

| Item | Why |
|------|-----|
| Multi-agent colony | One agent is enough. Colony adds complexity without user value at this stage. |
| IDE / terminal / file browser | Not a dev tool. It's a reference platform with an agent. |
| RNA-seq, single-cell, survival | Methylation first. Expand only after methylation is solid. |
| User accounts / OAuth | Session-based rate limiting is sufficient pre-launch. Add auth when needed. |
| Claude Code / Agent SDK | Standard Messages API with tool_use is simpler, cheaper, and sufficient. |
| GPU compute | Methylation arrays don't need GPUs. Don't pay for what you don't need. |
| Bring-your-own-key model | You front the API cost. Simpler UX, negligible cost at early scale. |
