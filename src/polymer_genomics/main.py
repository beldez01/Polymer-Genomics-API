from fastapi import FastAPI

app = FastAPI(
    title="Polymer Genomics API",
    version="0.1.0",
    description="Curated genomic reference database for agents and bioinformaticians",
)


@app.get("/health")
async def health():
    return {"status": "ok", "version": "0.1.0"}
