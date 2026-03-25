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
