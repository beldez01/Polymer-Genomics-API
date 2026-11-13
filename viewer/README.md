## Viewer

Next.js frontend for `polymerbio.org`.

## Local Dev

The viewer proxies all `/api/*` requests through Next.js. If you run only the frontend,
data-backed pages will fail unless you point that proxy at a working API.

### Option 1: Full local stack

Run the API locally on `http://localhost:8000`, then start the viewer:

```bash
cd /Users/zbb2/Desktop/PolymerGenomicsAPI
uv sync
uv run uvicorn polymer_genomics.main:app --reload
```

In another terminal:

```bash
cd /Users/zbb2/Desktop/PolymerGenomicsAPI/viewer
npm install
npx next dev --webpack
```

### Option 2: Local viewer against production API

Set a server-side API key for the Next.js proxy:

```bash
cd /Users/zbb2/Desktop/PolymerGenomicsAPI/viewer
export POLYMER_API_KEY=your_issued_key
npx next dev --webpack
```

With `POLYMER_API_KEY` set, the viewer defaults to `https://api.polymerbio.org` unless
`NEXT_PUBLIC_API_BASE` is explicitly provided.

### Option 3: Explicit remote API target

```bash
cd /Users/zbb2/Desktop/PolymerGenomicsAPI/viewer
export NEXT_PUBLIC_API_BASE=https://api.polymerbio.org
export POLYMER_API_KEY=your_issued_key
npx next dev --webpack
```

## Common Failure Mode

If the UI shows API errors across most pages, the usual cause is that the frontend is
still proxying to `http://localhost:8000` and no local API is running.

## Website planning and change history

See the [website plan](docs/website-plan.md), [work log](docs/WORK_LOG.md), and
[current to-do list](docs/TODO.md). The archived
[Genome Viewer v2 recommendations](docs/recommendations/Polymer_Genome_Viewer_Development_Plan_v2.md)
are proposed scope; [verification notes](docs/redesign/2026-11-12-genome-viewer-audit-notes.md)
record what has actually been checked.

### Viewer reliability checks

From this directory, run `npm test` and `npm run build`. Start a production
preview with `npm run start -- --hostname 127.0.0.1 --port 3124`, then run
`BASE_URL=http://127.0.0.1:3124 npm run test:viewer`. The browser suite uses
installed Chrome by default and controlled API fixtures. See the
[implementation and verification record](docs/redesign/2026-11-12-viewer-reliability-implementation.md)
for live API evidence, reference-length sources and remaining limitations.
