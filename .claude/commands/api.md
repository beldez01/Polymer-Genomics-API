Polymer Genomics API — deployment context.

- **API**: Fly.io app `polymer-genomics-api`, region `iad`. Deploy: `fly deploy`
- **Database**: Fly.io Postgres `polymer-db`. Migrate: `fly postgres connect -a polymer-db < migration.sql`
- **Frontend**: Vercel → `polymerbio.org`. Deploy: `vercel --prod`
- **Local dev**: `docker compose up` (postgres:16-alpine on localhost:5432, user `admin`/`dev_password`)
- **Ingest to prod**: `fly proxy 15432:5432 -a polymer-db` then run ingest with `POSTGRES_PORT=15432`
- **Source**: FastAPI at `src/polymer_genomics/main.py`, entrypoint `app.py` (Vercel shim)
- **Migrations**: `docker/postgres/migrations/NNN_*.sql`
