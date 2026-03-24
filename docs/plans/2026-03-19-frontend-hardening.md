# Frontend Hardening Plan — Polymer Genomics Platform

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden the Polymer Genomics frontend for production credibility, NAR paper submission, and developer adoption — fixing security exposures, data integrity issues, broken/mock pages, and documentation gaps.

**Architecture:** The viewer is a Next.js 15 + React 19 app deployed to Vercel. It proxies API requests through a Vercel rewrite (`/api/:path*` → Fly.io backend). The API key is injected server-side via `next.config.ts`. All changes are frontend-only except Tasks 1-2 (API middleware). No database changes.

**Tech Stack:** Next.js 15, React 19, TypeScript, FastAPI (Python), Vercel, Fly.io

---

## Chunk 1: Security & API Hygiene (Tasks 1-3)

### Task 1: Harden /health endpoint and gate /docs in production

The `/health` endpoint returns DB status and chromosome count to unauthenticated callers. The full OpenAPI schema is browsable at `/docs` and `/openapi.json`. These leak internal structure.

**Files:**
- Modify: `src/polymer_genomics/middleware.py:21-26`
- Modify: `src/polymer_genomics/main.py` (health handler)

- [ ] **Step 1: Read the current middleware and health handler**

Read `src/polymer_genomics/middleware.py` and find the health endpoint in `main.py`.

- [ ] **Step 2: Create a /ping endpoint that returns minimal info**

In `main.py`, add a new route:

```python
@app.get("/ping")
async def ping():
    return {"status": "ok"}
```

- [ ] **Step 3: Move /health behind auth, keep /ping public**

In `middleware.py`, change `PUBLIC_PATHS`:

```python
PUBLIC_PATHS = frozenset({
    "/ping",
})
```

This gates `/health`, `/docs`, `/openapi.json`, and `/redoc` behind the API key. Local dev (no key set) still gets open access.

- [ ] **Step 4: Verify locally**

```bash
# Start local server (no POLYMER_API_KEY set = open access)
# All paths accessible in dev mode — no functional change locally
PYTHONPATH=src .venv/bin/python -c "
from polymer_genomics.middleware import PUBLIC_PATHS
assert '/ping' in PUBLIC_PATHS
assert '/docs' not in PUBLIC_PATHS
assert '/health' not in PUBLIC_PATHS
print('OK: /docs and /health gated, /ping public')
"
```

- [ ] **Step 5: Commit**

```bash
git add src/polymer_genomics/middleware.py src/polymer_genomics/main.py
git commit -m "security: gate /health and /docs behind auth, add /ping for uptime checks"
```

---

### Task 2: Deprecate API key in query parameter

The `next.config.ts` rewrite appends `?api_key=...` to every proxied request. Query params appear in logs, CDN caches, and browser history. Move to header injection.

**Files:**
- Modify: `viewer/next.config.ts`

- [ ] **Step 1: Read current next.config.ts**

Current rewrite appends `?api_key=${apiKey}` to destination URL.

- [ ] **Step 2: Replace query-param injection with header injection**

Next.js rewrites support `headers` in the rewrite config (but only via middleware, not `rewrites()`). The cleanest approach: use Next.js middleware to add the header.

Create `viewer/src/middleware.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  // Only intercept /api proxy paths
  if (!request.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  const apiKey = process.env.POLYMER_API_KEY;
  if (!apiKey) return NextResponse.next();

  // Clone headers, add API key
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('X-API-Key', apiKey);

  return NextResponse.next({
    request: { headers: requestHeaders },
  });
}

export const config = {
  matcher: '/api/:path*',
};
```

- [ ] **Step 3: Simplify next.config.ts rewrite — remove query param**

```typescript
async rewrites() {
  return [
    {
      source: '/api/:path*',
      destination: `${apiBase}/:path*`,
    },
  ];
},
```

Remove the `apiKey` ternary. The middleware handles auth now.

- [ ] **Step 4: Remove the `apiKey` variable from next.config.ts**

Keep `NEXT_PUBLIC_API_BASE` for the rewrite destination. Remove `POLYMER_API_KEY` usage from this file (it's now in middleware.ts).

- [ ] **Step 5: Test locally**

```bash
cd viewer && npm run build
```

Build should succeed. The middleware only activates when `POLYMER_API_KEY` is set (Vercel production).

- [ ] **Step 6: Commit**

```bash
git add viewer/src/middleware.ts viewer/next.config.ts
git commit -m "security: move API key from query param to header via Next.js middleware"
```

---

### Task 3: Add API key acquisition instructions to /developers

Users see `api_key="pk_live_..."` in examples but have no way to get a key.

**Files:**
- Modify: `viewer/src/app/developers/page.tsx`

- [ ] **Step 1: Read developers page to find the right insertion point**

Find the quickstart section where the SDK code example lives.

- [ ] **Step 2: Add a "Getting Started" callout after the quickstart**

Insert a styled box after the SDK install example:

```tsx
{/* API Key */}
<div style={{
  backgroundColor: COLOR.bg.surface,
  border: `1px solid ${COLOR.border.subtle}`,
  borderRadius: 6,
  padding: `${SPACE[4]}px ${SPACE[6]}px`,
  marginBottom: SPACE[6],
}}>
  <div style={{
    fontSize: TYPE.sm.fontSize,
    fontWeight: WEIGHT.medium,
    color: COLOR.accent.amber,
    fontFamily: FONT_FAMILY,
    letterSpacing: '0.06em',
    marginBottom: SPACE[2],
  }}>
    API KEY
  </div>
  <p style={{
    color: COLOR.text.secondary,
    fontSize: TYPE.sm.fontSize,
    fontFamily: FONT_FAMILY,
    lineHeight: 1.7,
    margin: 0,
  }}>
    The API requires a key for all data endpoints. During the research preview,
    keys are issued manually. Email{' '}
    <a href="mailto:hello@polymerbio.org" style={{ color: COLOR.accent.teal }}>
      hello@polymerbio.org
    </a>
    {' '}with your name and institution.
    The browser at polymerbio.org uses a built-in key &mdash; no setup needed for interactive use.
  </p>
</div>
```

- [ ] **Step 3: Add SDK version to the install command**

Change `pip install polymer-genomics` to `pip install polymer-genomics==0.2.0`.

- [ ] **Step 4: Verify build**

```bash
cd viewer && npm run build
```

- [ ] **Step 5: Commit**

```bash
git add viewer/src/app/developers/page.tsx
git commit -m "docs: add API key instructions and SDK version to developers page"
```

---

## Chunk 2: Data Integrity — Dynamic Stats & Real Data (Tasks 4-7)

### Task 4: Fetch platform stats dynamically on homepage and /developers

Hardcoded "29M CpG, 937K probes, 63K transcripts, 41 MCP tools" will drift from reality.

**Files:**
- Create: `viewer/src/lib/platform-stats.ts`
- Modify: `viewer/src/app/page.tsx:76-81`
- Modify: `viewer/src/app/developers/page.tsx`

- [ ] **Step 1: Create a shared stats-fetching hook**

Create `viewer/src/lib/platform-stats.ts`:

```typescript
'use client';

import { useState, useEffect } from 'react';

export interface PlatformStats {
  cpg: string;
  probes: string;
  transcripts: string;
  mcpTools: string;
}

const FALLBACK: PlatformStats = {
  cpg: '29M',
  probes: '937K',
  transcripts: '63K',
  mcpTools: '41',
};

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(0)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

export function usePlatformStats(): PlatformStats {
  const [stats, setStats] = useState<PlatformStats>(FALLBACK);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/v1/layers/summary/hg38');
        if (!res.ok) return;
        const data = await res.json();
        const counts = data.layer_counts ?? {};
        setStats({
          cpg: formatCount(counts.cpg_sites ?? 29_000_000),
          probes: formatCount(counts.probe_epic_v2 ?? 937_000),
          transcripts: formatCount(counts.gencode_v44 ?? 63_000),
          mcpTools: FALLBACK.mcpTools, // MCP tool count not from this endpoint
        });
      } catch {
        // Keep fallback
      }
    })();
  }, []);

  return stats;
}
```

- [ ] **Step 2: Wire homepage to use dynamic stats**

In `page.tsx`, replace the static `STATS` array with the hook:

```tsx
// Remove the static STATS const
// Add at top of component:
const stats = usePlatformStats();
const STATS = [
  { value: stats.cpg, label: 'CpG' },
  { value: stats.probes, label: 'probes' },
  { value: stats.transcripts, label: 'transcripts' },
  { value: stats.mcpTools, label: 'MCP tools' },
];
```

- [ ] **Step 3: Wire /developers page similarly**

Find the inventory stats section in `developers/page.tsx` and replace hardcoded values with `usePlatformStats()`.

- [ ] **Step 4: Verify build**

```bash
cd viewer && npm run build
```

- [ ] **Step 5: Commit**

```bash
git add viewer/src/lib/platform-stats.ts viewer/src/app/page.tsx viewer/src/app/developers/page.tsx
git commit -m "feat: fetch platform stats dynamically instead of hardcoded values"
```

---

### Task 5: Remove transposome from navigation OR wire to real data

The transposome page serves fabricated mock data in production. Two options — pick based on whether the TE API exists yet.

**Files:**
- Modify: `viewer/src/app/page.tsx` (if removing from nav)
- Modify: `viewer/src/lib/api.ts:565-576` (if wiring real data)
- Modify: `viewer/src/app/transposome/page.tsx` (if keeping but adding banner)

- [ ] **Step 1: Check if `/v1/transposome/families` endpoint exists in the API**

```bash
grep -r "transposome" src/polymer_genomics/routers/ || echo "No transposome router"
```

- [ ] **Step 2A: If no endpoint exists — add "Coming Soon" banner and keep page**

In `viewer/src/app/transposome/page.tsx`, add a prominent banner at the top of the page content:

```tsx
<div style={{
  backgroundColor: `${COLOR.accent.amber}15`,
  border: `1px solid ${COLOR.accent.amber}40`,
  borderRadius: 6,
  padding: `${SPACE[3]}px ${SPACE[5]}px`,
  marginBottom: SPACE[6],
  display: 'flex',
  alignItems: 'center',
  gap: SPACE[3],
}}>
  <span style={{
    color: COLOR.accent.amber,
    fontSize: TYPE.sm.fontSize,
    fontFamily: FONT_FAMILY,
    fontWeight: WEIGHT.medium,
  }}>
    PREVIEW
  </span>
  <span style={{
    color: COLOR.text.secondary,
    fontSize: TYPE.sm.fontSize,
    fontFamily: FONT_FAMILY,
  }}>
    This page shows representative data. Live data integration is in progress.
  </span>
</div>
```

- [ ] **Step 2B: If endpoint exists — wire `fetchTEFamilies` to real API**

In `api.ts`, replace the mock return with:

```typescript
export async function fetchTEFamilies(): Promise<TEFamiliesResponse> {
  return fetchJSON<TEFamiliesResponse>(`${API_BASE}/v1/transposome/families`);
}

export async function fetchTEFamilyDetail(familyId: string): Promise<TEFamilyDetailResponse> {
  return fetchJSON<TEFamilyDetailResponse>(`${API_BASE}/v1/transposome/family/${encodeURIComponent(familyId)}`);
}
```

- [ ] **Step 3: Commit**

```bash
git add viewer/src/app/transposome/page.tsx viewer/src/lib/api.ts
git commit -m "ui: add preview banner to transposome page (mock data disclosure)"
```

---

### Task 6: Make data-sources page dynamic with row counts

The data-sources page is a static hardcoded table. It should show row counts and pull from the API.

**Files:**
- Modify: `viewer/src/app/data-sources/page.tsx`

- [ ] **Step 1: Read the current data-sources page structure**

Read `data-sources/page.tsx` to understand the current table layout and categories.

- [ ] **Step 2: Add a dynamic row-count column**

At the top of the component, fetch layer summary:

```tsx
const [layerCounts, setLayerCounts] = useState<Record<string, number>>({});

useEffect(() => {
  (async () => {
    try {
      const res = await fetch('/api/v1/layers/summary/hg38');
      if (!res.ok) return;
      const data = await res.json();
      setLayerCounts(data.layer_counts ?? {});
    } catch {
      // Fallback: no counts shown
    }
  })();
}, []);
```

- [ ] **Step 3: Add "Rows" column to each table**

For each data source row, map the source name to the layer key and show the count. Add a mapping object:

```typescript
const LAYER_KEY_MAP: Record<string, string> = {
  'GENCODE v44': 'gencode_v44',
  'CpG Islands': 'cpg_islands',
  'CpG Sites': 'cpg_sites',
  'EPIC v2': 'probe_epic_v2',
  'EPIC v1': 'probe_epic_v1',
  '450K': 'probe_450k',
  'GTEx v10': 'expression_gtex_v10',
  'gnomAD v4.1': 'constraint_gnomad_v4',
  'PhyloP 100-way': 'conservation_phylop',
  'ENCODE cCREs v4': 'regulatory_ccre_v4',
  'RepeatMasker': 'repeats',
  // ... add all mappings
};
```

Display with `formatCount()` or "—" if no mapping exists.

- [ ] **Step 4: Verify build**

```bash
cd viewer && npm run build
```

- [ ] **Step 5: Commit**

```bash
git add viewer/src/app/data-sources/page.tsx
git commit -m "feat: add dynamic row counts to data sources page"
```

---

### Task 7: Fix privacy page email to domain-matched address

"polymergenomics@gmail.com" for GDPR data controller looks unprofessional.

**Files:**
- Modify: `viewer/src/app/privacy/page.tsx`

- [ ] **Step 1: Read privacy page and find the email**

```bash
grep -n "gmail" viewer/src/app/privacy/page.tsx
```

- [ ] **Step 2: Replace with domain email**

Change `polymergenomics@gmail.com` → `privacy@polymerbio.org` (or `hello@polymerbio.org` to match the developers page).

- [ ] **Step 3: Commit**

```bash
git add viewer/src/app/privacy/page.tsx
git commit -m "fix: use domain email for GDPR contact in privacy policy"
```

---

## Chunk 3: Documentation Completeness (Tasks 8-10)

### Task 8: Generate /docs page from OpenAPI spec

The docs page hardcodes ~10 endpoints. The API has 44. Generate dynamically.

**Files:**
- Create: `viewer/src/lib/openapi-loader.ts`
- Modify: `viewer/src/app/docs/page.tsx`

- [ ] **Step 1: Create OpenAPI loader**

Create `viewer/src/lib/openapi-loader.ts`:

```typescript
export interface EndpointDoc {
  method: string;
  path: string;
  summary: string;
  description: string;
  parameters: Array<{
    name: string;
    in: string;
    required: boolean;
    type: string;
    description: string;
    default?: string;
  }>;
  requestBody?: Record<string, unknown>;
  tag: string;
}

export async function loadEndpoints(): Promise<EndpointDoc[]> {
  try {
    const res = await fetch('/api/openapi.json');
    if (!res.ok) return [];
    const spec = await res.json();
    const endpoints: EndpointDoc[] = [];

    for (const [path, methods] of Object.entries(spec.paths ?? {})) {
      for (const [method, op] of Object.entries(methods as Record<string, Record<string, unknown>>)) {
        if (!['get', 'post', 'put', 'delete'].includes(method)) continue;
        const params = ((op.parameters ?? []) as Array<Record<string, unknown>>).map((p) => ({
          name: String(p.name ?? ''),
          in: String(p.in ?? ''),
          required: Boolean(p.required),
          type: String((p.schema as Record<string, unknown>)?.type ?? 'string'),
          description: String(p.description ?? ''),
          default: p.schema && (p.schema as Record<string, unknown>).default !== undefined
            ? String((p.schema as Record<string, unknown>).default)
            : undefined,
        }));
        endpoints.push({
          method: method.toUpperCase(),
          path,
          summary: String(op.summary ?? ''),
          description: String(op.description ?? ''),
          parameters: params,
          requestBody: op.requestBody as Record<string, unknown> | undefined,
          tag: ((op.tags as string[]) ?? ['Other'])[0] ?? 'Other',
        });
      }
    }

    return endpoints.sort((a, b) => a.path.localeCompare(b.path));
  } catch {
    return [];
  }
}
```

- [ ] **Step 2: Refactor docs page to use dynamic endpoints**

In `docs/page.tsx`, replace the static `ENDPOINTS` array with a `useEffect` that calls `loadEndpoints()`. Keep the static array as a fallback if the fetch fails.

Group endpoints by tag for the sidebar navigation.

- [ ] **Step 3: Add error response documentation section**

Add a static section at the bottom of the docs page:

```tsx
<section>
  <h2>Error Responses</h2>
  <p>All errors return JSON with this shape:</p>
  <pre>{`{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable description"
  }
}`}</pre>
  <table>
    <thead><tr><th>Status</th><th>Code</th><th>Meaning</th></tr></thead>
    <tbody>
      <tr><td>401</td><td>MISSING_API_KEY</td><td>No X-API-Key header provided</td></tr>
      <tr><td>403</td><td>INVALID_API_KEY</td><td>Key does not match</td></tr>
      <tr><td>404</td><td>NOT_FOUND</td><td>Gene, probe, or layer not found</td></tr>
      <tr><td>422</td><td>VALIDATION_ERROR</td><td>Invalid parameters</td></tr>
      <tr><td>429</td><td>RATE_LIMITED</td><td>Too many requests</td></tr>
      <tr><td>500</td><td>INTERNAL_ERROR</td><td>Server error</td></tr>
    </tbody>
  </table>
</section>
```

- [ ] **Step 4: Verify build**

```bash
cd viewer && npm run build
```

- [ ] **Step 5: Commit**

```bash
git add viewer/src/lib/openapi-loader.ts viewer/src/app/docs/page.tsx
git commit -m "docs: generate endpoint reference from OpenAPI spec, add error codes"
```

---

### Task 9: Add rate limit and API version info to /developers

**Files:**
- Modify: `viewer/src/app/developers/page.tsx`

- [ ] **Step 1: Add rate limit section after the API key box (from Task 3)**

```tsx
<div style={{
  backgroundColor: COLOR.bg.surface,
  border: `1px solid ${COLOR.border.subtle}`,
  borderRadius: 6,
  padding: `${SPACE[4]}px ${SPACE[6]}px`,
  marginBottom: SPACE[6],
}}>
  <div style={{
    fontSize: TYPE.sm.fontSize,
    fontWeight: WEIGHT.medium,
    color: COLOR.text.secondary,
    fontFamily: FONT_FAMILY,
    letterSpacing: '0.06em',
    marginBottom: SPACE[2],
  }}>
    LIMITS &amp; VERSIONS
  </div>
  <div style={{
    color: COLOR.text.tertiary,
    fontSize: TYPE.sm.fontSize,
    fontFamily: FONT_FAMILY,
    lineHeight: 1.8,
  }}>
    <div>API version: <code style={{ color: COLOR.accent.teal }}>0.2.0</code></div>
    <div>SDK version: <code style={{ color: COLOR.accent.teal }}>polymer-genomics 0.2.0</code></div>
    <div>Max sequence length (evaluate): 100,000 bp</div>
    <div>Max region size (region query): 10 Mb</div>
    <div>Max batch probes: 10,000</div>
    <div>Max batch evaluate: 100 sequences</div>
    <div>Max sequence retrieval: 100 kb</div>
  </div>
</div>
```

- [ ] **Step 2: Verify build**

```bash
cd viewer && npm run build
```

- [ ] **Step 3: Commit**

```bash
git add viewer/src/app/developers/page.tsx
git commit -m "docs: add rate limits, API version, and SDK version to developers page"
```

---

### Task 10: Add RUO tooltip to footer

**Files:**
- Modify: `viewer/src/components/Footer.tsx`

- [ ] **Step 1: Read Footer component**

Find the "RESEARCH USE ONLY" text.

- [ ] **Step 2: Wrap in a link to /terms with title attribute**

```tsx
<a
  href="/terms"
  title="Not intended for clinical or diagnostic use. See Terms of Service."
  style={{ color: COLOR.text.faint, textDecoration: 'none', borderBottom: `1px dotted ${COLOR.text.faint}` }}
>
  RESEARCH USE ONLY
</a>
```

- [ ] **Step 3: Commit**

```bash
git add viewer/src/components/Footer.tsx
git commit -m "ui: link RUO label to terms page with tooltip"
```

---

## Chunk 4: Resilience & UX (Tasks 11-14)

### Task 11: Add React error boundaries

Prevent single-component crashes from taking down entire pages.

**Files:**
- Create: `viewer/src/components/ErrorBoundary.tsx`
- Modify: `viewer/src/app/clocks/page.tsx`
- Modify: `viewer/src/app/atlas/page.tsx`
- Modify: `viewer/src/app/dmp/page.tsx`
- Modify: `viewer/src/app/evaluate/page.tsx`

- [ ] **Step 1: Create ErrorBoundary component**

```tsx
'use client';

import React from 'react';
import { COLOR, FONT_FAMILY, SPACE, TYPE, WEIGHT } from '@/config/theme';

interface Props {
  children: React.ReactNode;
  fallbackLabel?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          backgroundColor: `${COLOR.accent.rose}10`,
          border: `1px solid ${COLOR.accent.rose}30`,
          borderRadius: 6,
          padding: `${SPACE[4]}px ${SPACE[5]}px`,
          fontFamily: FONT_FAMILY,
        }}>
          <div style={{
            fontSize: TYPE.sm.fontSize,
            fontWeight: WEIGHT.medium,
            color: COLOR.accent.rose,
            marginBottom: SPACE[1],
          }}>
            {this.props.fallbackLabel ?? 'Section'} failed to render
          </div>
          <div style={{
            fontSize: TYPE.xs.fontSize,
            color: COLOR.text.muted,
            fontFamily: 'monospace',
          }}>
            {this.state.error?.message}
          </div>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{
              marginTop: SPACE[2],
              backgroundColor: 'transparent',
              border: `1px solid ${COLOR.border.subtle}`,
              borderRadius: 4,
              color: COLOR.text.secondary,
              fontSize: TYPE.xs.fontSize,
              fontFamily: FONT_FAMILY,
              padding: `${SPACE[1]}px ${SPACE[3]}px`,
              cursor: 'pointer',
            }}
          >
            Retry
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
```

- [ ] **Step 2: Wrap major sections in each page**

Example for clocks page — wrap ClockObservatory, ClockAnatomy, CrossClockComparison, ClockCalculator:

```tsx
<ErrorBoundary fallbackLabel="Clock Observatory">
  <ClockObservatory ... />
</ErrorBoundary>
```

Apply the same pattern to:
- Atlas: KaryotypeOverview, GeneCard
- DMP: VolcanoPlot, ManhattanPlot, ResultsTable, EnrichmentPanel
- Evaluate: results section, flag list

- [ ] **Step 3: Verify build**

```bash
cd viewer && npm run build
```

- [ ] **Step 4: Commit**

```bash
git add viewer/src/components/ErrorBoundary.tsx viewer/src/app/clocks/page.tsx viewer/src/app/atlas/page.tsx viewer/src/app/dmp/page.tsx viewer/src/app/evaluate/page.tsx
git commit -m "resilience: add error boundaries to all major page sections"
```

---

### Task 12: Add AbortController to page-level data fetching

Prevent wasted requests when users navigate away mid-fetch.

**Files:**
- Modify: `viewer/src/app/clocks/page.tsx:27-56`
- Modify: `viewer/src/app/atlas/page.tsx`
- Modify: `viewer/src/lib/api.ts:88` (fetchJSON already accepts signal — just need to thread it)

- [ ] **Step 1: Add cleanup to clocks page useEffect**

```tsx
useEffect(() => {
  const controller = new AbortController();
  (async () => {
    try {
      const res = await fetchClockList({ signal: controller.signal });
      setClocks(res.data.clocks);
    } catch (e) {
      if (!controller.signal.aborted) console.error('Failed to load clocks', e);
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  })();
  return () => controller.abort();
}, []);
```

Note: `fetchClockList` needs an optional `opts` parameter. Update its signature in `api.ts`:

```typescript
export async function fetchClockList(
  opts?: { signal?: AbortSignal }
): Promise<ClockListResponse> {
  return fetchJSON<ClockListResponse>(`${API_BASE}/v1/reference/clock-probes?list=true`, opts);
}
```

- [ ] **Step 2: Same pattern for clock detail loading loop**

Add abort check inside the `for` loop:

```tsx
for (const c of clocks) {
  if (controller.signal.aborted) break;
  // ...existing fetch...
}
```

- [ ] **Step 3: Same pattern for atlas aggregation useEffect**

Thread AbortController through the 24 parallel chromosome requests.

- [ ] **Step 4: Verify build**

```bash
cd viewer && npm run build
```

- [ ] **Step 5: Commit**

```bash
git add viewer/src/lib/api.ts viewer/src/app/clocks/page.tsx viewer/src/app/atlas/page.tsx
git commit -m "resilience: add AbortController cleanup to page data fetching"
```

---

### Task 13: Add pointer-events: none to all disabled buttons

Ensure disabled buttons cannot be clicked via any input method.

**Files:**
- Modify: `viewer/src/app/evaluate/page.tsx:527`
- Modify: `viewer/src/app/clocks/page.tsx:233`

- [ ] **Step 1: Search for `opacity` + `disabled` patterns**

```bash
grep -n "opacity.*loading\|opacity.*disabled" viewer/src/app/*/page.tsx
```

- [ ] **Step 2: Add `pointerEvents: 'none'` alongside opacity for disabled states**

For each match, add:

```tsx
pointerEvents: loading ? 'none' : 'auto',
```

The evaluate button already has `disabled={loading}` which blocks keyboard activation. `pointer-events: none` blocks mouse/touch.

- [ ] **Step 3: Commit**

```bash
git add viewer/src/app/evaluate/page.tsx viewer/src/app/clocks/page.tsx
git commit -m "ui: add pointer-events:none to disabled buttons"
```

---

### Task 14: Add basic response caching for reference data

Layer summaries, clock lists, and gene data change only on ingestion. Cache them.

**Files:**
- Create: `viewer/src/lib/cache.ts`
- Modify: `viewer/src/lib/api.ts`

- [ ] **Step 1: Create a simple TTL cache**

```typescript
const cache = new Map<string, { data: unknown; expiry: number }>();

export function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry || Date.now() > entry.expiry) {
    cache.delete(key);
    return null;
  }
  return entry.data as T;
}

export function setCache<T>(key: string, data: T, ttlMs: number = 300_000): void {
  cache.set(key, { data, expiry: Date.now() + ttlMs });
}
```

- [ ] **Step 2: Wrap cacheable API calls**

In `api.ts`, add caching to `fetchLayers`, `fetchLayerSummary`, `fetchClockList`:

```typescript
export async function fetchLayers(build?: string): Promise<LayerInfo[]> {
  const key = `layers:${build ?? 'all'}`;
  const cached = getCached<LayerInfo[]>(key);
  if (cached) return cached;
  const result = await fetchJSON<LayerInfo[]>(`${API_BASE}/v1/layers${build ? `?build=${build}` : ''}`);
  setCache(key, result);
  return result;
}
```

Apply 5-minute TTL (300,000ms) for reference data. Skip caching for user-specific calls (evaluate, compare).

- [ ] **Step 3: Verify build**

```bash
cd viewer && npm run build
```

- [ ] **Step 4: Commit**

```bash
git add viewer/src/lib/cache.ts viewer/src/lib/api.ts
git commit -m "perf: add 5-minute TTL cache for reference data API calls"
```

---

## Chunk 5: Deploy & Verify (Task 15)

### Task 15: Deploy and verify all changes

- [ ] **Step 1: Run full build**

```bash
cd viewer && npm run build
```

Expect: clean build, no TypeScript errors.

- [ ] **Step 2: Verify API files parse**

```bash
cd /Users/zbb2/Desktop/PolymerGenomicsAPI
.venv/bin/python -c "
import ast, glob
for f in glob.glob('src/polymer_genomics/**/*.py', recursive=True):
    ast.parse(open(f).read())
print('All Python files parse OK')
"
```

- [ ] **Step 3: Run SDK tests**

```bash
cd sdk/python && uv run --with pytest pytest tests/ -q
```

Expect: all tests pass.

- [ ] **Step 4: Commit any remaining changes**

```bash
git status
# Stage anything missed
```

- [ ] **Step 5: Push**

```bash
git push origin main
```

- [ ] **Step 6: Deploy API to Fly.io**

```bash
fly deploy
```

Only needed if Task 1 (middleware changes) was implemented.

- [ ] **Step 7: Deploy frontend to Vercel**

```bash
cd viewer && vercel --prod
```

- [ ] **Step 8: Smoke test live site**

Verify each page loads:
- `https://polymerbio.org` — stats should be dynamic
- `https://polymerbio.org/developers` — API key instructions visible
- `https://polymerbio.org/data-sources` — row counts column present
- `https://polymerbio.org/docs` — 44 endpoints listed
- `https://polymerbio.org/transposome` — PREVIEW banner visible
- `https://polymerbio.org/clocks` — clocks load after brief spinner
- `https://api.polymerbio.org/ping` — returns `{"status":"ok"}`
- `https://api.polymerbio.org/docs` — returns 401 (gated)
- `https://api.polymerbio.org/health` — returns 401 (gated)

---

## Summary

| Task | Type | Files | Risk |
|------|------|-------|------|
| 1. Gate /health and /docs | Security | middleware.py, main.py | Low (additive) |
| 2. API key → header | Security | next.config.ts, middleware.ts | Medium (auth flow) |
| 3. Key acquisition docs | Docs | developers/page.tsx | Low |
| 4. Dynamic stats | Integrity | platform-stats.ts, page.tsx, developers | Low |
| 5. Transposome disclosure | Integrity | transposome/page.tsx, api.ts | Low |
| 6. Data sources + counts | Integrity | data-sources/page.tsx | Low |
| 7. Privacy email | Polish | privacy/page.tsx | Trivial |
| 8. Dynamic /docs | Docs | openapi-loader.ts, docs/page.tsx | Medium (large refactor) |
| 9. Rate limits + versions | Docs | developers/page.tsx | Low |
| 10. RUO tooltip | Polish | Footer.tsx | Trivial |
| 11. Error boundaries | Resilience | ErrorBoundary.tsx, 4 pages | Low |
| 12. AbortController | Resilience | api.ts, clocks, atlas | Medium |
| 13. Disabled buttons | UX | evaluate, clocks | Trivial |
| 14. Response caching | Perf | cache.ts, api.ts | Low |
| 15. Deploy & verify | Ops | — | Low |

**Total estimated effort:** 3-4 focused days.
**Deploy order:** Tasks 1-3 (security) → Tasks 4-7 (integrity) → Tasks 8-10 (docs) → Tasks 11-14 (resilience) → Task 15 (deploy).
