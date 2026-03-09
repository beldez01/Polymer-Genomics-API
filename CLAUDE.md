# PolymerGenomicsAPI

Curated genomic reference API (hg38/hg37) serving polymerbio.org.

## Deployment Architecture — READ BEFORE DEPLOYING

| Tier     | Platform        | Deploy Command                  |
|----------|-----------------|---------------------------------|
| API      | **Fly.io**      | `fly deploy`                    |
| Database | **Fly.io Postgres** | `fly postgres connect -a polymer-db` |
| Frontend | **Vercel**      | `cd viewer && vercel --prod`    |
| MCP      | Local (stdio)   | `cd mcp && uv run server.py`   |

**DO NOT deploy the API to Vercel. DO NOT run migrations against the local Docker DB.**

- Migrations target Fly.io Postgres via `fly proxy` or `fly postgres connect`
- `docker-compose.yml` is for **local dev only**
- Fly app name: `polymer-genomics-api` (region: iad)
- CORS origins: polymerbio.org, polymer-genomics.vercel.app, localhost:3000

## Database Capacity (as of 2026-03-09)

- **Volume**: 20 GB, 14 GB used (70%), expandable via `fly volumes extend`
- **Compute**: shared-cpu-2x / 1 GB RAM — RAM is the binding constraint for query performance
- **Scale-up**: volume grows instantly (no downtime); CPU/RAM via `fly machine update --vm-size`
- Plan ingestions accordingly — large tables (CpG sites, chromatin states) consume 300-500 MB each

## Project Structure

- `src/` — FastAPI application (`polymer_genomics/`)
- `viewer/` — Next.js frontend (deployed to Vercel)
- `mcp/` — MCP server (Claude Code integration, 33 tools: 23 reference + 10 compute)
- `engine/` — Methylation compute engine (R scripts + Dockerfile)
- `docker/` — Local dev Postgres init scripts
- `data/` — Reference data (HPA, etc.)
- `scripts/` — Ingestion and admin scripts
- `fly.toml` — Fly.io deployment config (source of truth)
