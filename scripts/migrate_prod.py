#!/usr/bin/env python3
"""Apply pending SQL migrations to a database.

Usage:
    uv run python scripts/migrate_prod.py --url postgresql://... migration1.sql migration2.sql
"""

import argparse
import asyncio
import sys
from pathlib import Path

import asyncpg


async def run(url: str, sql_files: list[Path]) -> None:
    conn = await asyncpg.connect(url)
    try:
        for path in sql_files:
            sql = path.read_text()
            print(f"  Applying {path.name}...", end=" ", flush=True)
            # Split on bare COMMIT/BEGIN so we handle multi-transaction migrations
            await conn.execute(sql)
            print("OK")
    finally:
        await conn.close()


def main() -> None:
    parser = argparse.ArgumentParser(description="Apply SQL migrations")
    parser.add_argument("--url", required=True, help="Database URL")
    parser.add_argument("files", nargs="+", type=Path, help="SQL files to apply")
    args = parser.parse_args()

    missing = [f for f in args.files if not f.exists()]
    if missing:
        print(f"Error: files not found: {missing}", file=sys.stderr)
        sys.exit(1)

    asyncio.run(run(args.url, args.files))
    print("Done.")


if __name__ == "__main__":
    main()
