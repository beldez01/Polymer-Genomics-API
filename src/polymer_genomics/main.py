import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from polymer_genomics import __version__
from polymer_genomics.db import close_pool, get_pool, init_pool
from polymer_genomics.middleware import APIKeyMiddleware
from polymer_genomics.routers.aggregation import router as aggregation_router
from polymer_genomics.routers.bulk import router as bulk_router
from polymer_genomics.routers.expression import router as expression_router
from polymer_genomics.routers.gene_costs import router as gene_costs_router
from polymer_genomics.routers.genes import router as genes_router
from polymer_genomics.routers.layers import router as layers_router
from polymer_genomics.routers.probes import router as probes_router
from polymer_genomics.routers.proximity import router as proximity_router
from polymer_genomics.routers.regions import router as regions_router
from polymer_genomics.routers.search import router as search_router
from polymer_genomics.routers.sequence import router as sequence_router
from polymer_genomics.routers.tiles import router as tiles_router
from polymer_genomics.routers.protein_abundance import router as protein_abundance_router
from polymer_genomics.routers.gene_constraint import router as gene_constraint_router
from polymer_genomics.routers.gene_pathways import router as gene_pathways_router
from polymer_genomics.routers.gene_sets_router import router as gene_sets_router
from polymer_genomics.routers.protein_atlas import router as protein_atlas_router
from polymer_genomics.routers.reference import router as reference_router
from polymer_genomics.routers.biophysics import router as biophysics_router
from polymer_genomics.routers.correlation import router as correlation_router
from polymer_genomics.routers.cpg_profile import router as cpg_profile_router
from polymer_genomics.routers.intersect import router as intersect_router
from polymer_genomics.routers.evaluate import router as evaluate_router
from polymer_genomics.routers.stats import router as stats_router
from polymer_genomics.routers.profile import router as profile_router
from polymer_genomics.routers.gene_profiles import router as gene_profiles_router
from polymer_genomics.routers.recipes import router as recipes_router
from polymer_genomics.routers.transposome import router as transposome_router
from polymer_genomics.routers.design import router as design_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_pool()
    yield
    await close_pool()


app = FastAPI(
    title="Polymer Genomics API",
    version=__version__,
    description="Curated genomic reference database for agents and bioinformaticians",
    lifespan=lifespan,
)

# ── Middleware ────────────────────────────────────────────────────
# API key auth (no-op when POLYMER_API_KEY is unset — safe for local dev)
app.add_middleware(APIKeyMiddleware)

# CORS for viewer (configurable via POLYMER_CORS_ORIGINS env var)
cors_origins = os.environ.get("POLYMER_CORS_ORIGINS", "http://localhost:3000").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["X-API-Key", "Content-Type"],
)


@app.middleware("http")
async def add_robots_header(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Robots-Tag"] = "noindex, nofollow"
    return response


app.include_router(aggregation_router)
app.include_router(bulk_router)
app.include_router(expression_router)
app.include_router(gene_costs_router)
app.include_router(genes_router)
app.include_router(layers_router)
app.include_router(probes_router)
app.include_router(proximity_router)
app.include_router(regions_router)
app.include_router(search_router)
app.include_router(sequence_router)
app.include_router(tiles_router)
app.include_router(protein_abundance_router)
app.include_router(gene_constraint_router)
app.include_router(gene_pathways_router)
app.include_router(gene_sets_router)
app.include_router(protein_atlas_router)
app.include_router(reference_router)
app.include_router(biophysics_router)
app.include_router(correlation_router)
app.include_router(cpg_profile_router)
app.include_router(intersect_router)
app.include_router(evaluate_router)
app.include_router(stats_router)
app.include_router(profile_router)
app.include_router(gene_profiles_router)
app.include_router(recipes_router)
app.include_router(transposome_router)
app.include_router(design_router)


@app.get("/ping")
async def ping():
    """Public uptime check — no auth required, no internal details."""
    return {"status": "ok"}


@app.get("/health")
async def health():
    """Detailed health check — requires auth (exposes DB status)."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        count = await conn.fetchval("SELECT count(*) FROM ref.chromosomes")
    return {"status": "ok", "version": __version__, "db": "ok", "chromosome_count": count}
