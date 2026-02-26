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
