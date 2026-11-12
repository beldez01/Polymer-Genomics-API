# Homepage search and developer access

Status: implemented locally on `feat/homepage-search-onboarding`; not deployed.

## Agreed scope

The supplied product-roadmap summary is a set of candidate recommendations, not
an accepted implementation backlog. This package covers homepage gene/coordinate
entry, explicit assembly selection, and verified developer access only. Further
roadmap items require their own scope decisions. No new research model, variant
resolver, liftover, CHM13 dataset, custom-track importer, or shared analysis session
was added.

## Audit and implementation

- Existing gene search is `/v1/search?q=...&build=...`, returning gene symbols,
  chromosome labels, and optional alias matches. Reused the site's API proxy.
- Exact gene symbols open the existing gene profile. Partial/alias results remain
  selectable links, so the first prefix hit is not silently chosen. Empty and
  unavailable states are explicit. Query/build changes invalidate older responses.
- Intervals accept comma-separated coordinates and normalize chromosome names.
  Syntax, integer safety, positive/order constraints, and a 300 Mb input ceiling
  are checked before opening the existing viewer route. This is input validation,
  not reference-sequence validation or coordinate conversion.
- Default assembly is GRCh38 / hg38. GRCh37 / hg19 uses the existing API identifier
  `hg37`. Changing assemblies clears results. The interface notes variable layer
  coverage. A public hg38 TP53 search returned hits; the tested hg37 BRCA1 search
  returned an empty result. Backend support does not establish equal data coverage.
- Python and MCP distribution names were checked against package source and PyPI:
  `polymer-genomics` (0.3.0), `polymer-genomics-mcp` (1.1.0).
- Replaced the speculative developer quickstart with REST, Python dictionary-based
  `client.region(...)`, and local stdio MCP setup using `uvx polymer-genomics-mcp`.
  Removed unsupported R/TypeScript examples, fixed numerical outputs, account-page
  instructions, and unverified quota promises from that quickstart. Updated the
  overlapping API-reference examples to share the same snippets.
- Homepage developer entries link directly to the matching quickstart sections;
  Python installation has a copy control. MCP JSON uses a placeholder key and
  includes prerequisite and reload instructions. Client-specific setup was not
  independently tested in installed desktop agent applications.

## Verification

- Production build including TypeScript passed. Existing workspace-root and
  middleware-deprecation warnings remain unrelated to this package.
- Nine Node tests passed: three search-input tests and six composition tests.
- Local production-preview browser checks passed: malformed/unsupported input,
  partial and exact symbols, empty/error responses, stale-response rejection,
  keyboard submission, correct build in coordinate/gene routes, MCP JSON copy,
  and consistent reference examples. Search responses were mocked for repeatable
  browser state coverage; separate live API checks are recorded above.
- Homepage and quickstart layouts checked at 1440/768/390/360 px with no horizontal
  page overflow. Mobile homepage screenshot inspected. No browser page errors.
- No push, merge, or production deployment performed for this package.
