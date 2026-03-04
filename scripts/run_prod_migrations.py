"""Run production migrations 002 + 003 against the proxied DB."""
import asyncio
from pathlib import Path
import asyncpg

DB = "postgresql://polymer_genomics_api:sUSi45D98nZS7gx@polymer-db.flycast:5432/polymer_genomics_api?sslmode=disable"

MIGRATIONS = [
    Path("docker/postgres/migrations/002_methylation_reference.sql"),
    Path("docker/postgres/migrations/003_gene_costs.sql"),
]

async def main():
    conn = await asyncpg.connect(DB)
    try:
        for path in MIGRATIONS:
            print(f"Applying {path.name}...", end=" ", flush=True)
            await conn.execute(path.read_text())
            print("OK")
    finally:
        await conn.close()
    print("Done.")

asyncio.run(main())
