# Polymer: database-first website implementation plan

Date: 2026-11-03
Status: Implemented in the local viewer for review on 2026-11-03. No commit, push, or deployment. See verification notes below.

## Objective and agreed direction

Present Polymer as a genomics database and API. The homepage is the platform map: visitors can immediately find the genome browser, digital karyotype, analysis tools, and programmatic access. The RNA Construct Builder remains an available tool. Mission, founder background, and contact move to About.

Keep the existing electric-blue, light-gray visual language and typography. This phase changes information architecture, presentation, and navigation. It does not change scientific calculations, data ingestion, API contracts, or tool behavior. The May 19 design documents remain historical visual references; their sandbox implementation sequence does not govern this new change.

## Current implementation findings

- Frontend: `viewer/`, Next.js 16 / React 19.
- `src/app/page.tsx`: RNA-focused company homepage, RNA glyph, two entry cards, discovery loop, founder, contact.
- `src/app/genomics/page.tsx`: browser and karyotype previews, tool cards, developer links. Its introduction explicitly frames genomics as supporting construct design.
- `src/components/BrandBar.tsx`: shared wordmark and Genomics / Docs navigation, with page subtitles and tool-specific children. Most pages already use it.
- `src/app/portal/layout.tsx`: separate Claims navigation. Must be handled explicitly for consistent site navigation.
- `src/app/genomics/te-methylation/page.tsx`: redirects to `/genomics/dmp`; not an independent working tool destination.
- `/claims` can be served by a separate deployment through `NEXT_PUBLIC_CLAIMS_ZONE`. Updating the local shared header cannot change that deployment's header.
- Root layout metadata and the generated Open Graph image still promote programmable RNA discovery.
- Existing permanent redirects preserve older root-level tool URLs. Keep those redirects and current `/genomics/*` destinations.

## Page and navigation map

| Destination | Purpose |
| --- | --- |
| `/` | Primary platform overview and task-oriented entry points |
| `/genomics` | Complete genomics tool directory with fuller descriptions |
| `/genomics/docs` | API and MCP reference |
| `/genomics/developers` | Setup, examples, SDK and developer onboarding |
| `/genomics/data-sources` | Data inventory, provenance, licenses |
| `/about` | Mission, founder, contact |
| Existing tool routes | Working scientific interfaces, unchanged destinations |

Shared header: **POLYMER** on the left, linking to `/`; **Genomics · Docs · About** on the right. Preserve current uppercase wordmark styling. Provide visible keyboard focus and a current-page indication, using `aria-current` only for the actual current page; nested sections may receive a separate visual section indication.

Keep page subtitles and genome-browser controls working. On narrow screens, adapt spacing/wrapping or the existing navigation overflow treatment so every navigation item remains reachable and no page gains horizontal overflow.

## Homepage composition, top to bottom

1. **Compact introduction.** Working title: “Explore the genome with Polymer.” Working description: “A genomics database and API for exploring reference-genome data, biological annotations, and sequence biophysics.” Treat this as draft copy. Keep the main destinations visible early; remove the oversized RNA illustration from this page.
2. **Explore the genome.** Two prominent cards with the existing reusable previews:
   - **Genome Browser:** “Explore genes, regions, and genomic data layers.” Link to the existing example-locus URL; label it as opening an example region so visitors understand the destination. Keep gene/region search inside the browser for this phase.
   - **Digital Karyotype:** “Start with the whole genome, then explore individual chromosomes.” Link to `/genomics/atlas`.
3. **Use the API.** A visible section directly after the lead cards, before the longer tools list. Explain access through REST, the Python SDK, and MCP in plain language. Separate links for “Developer quickstart” and “API documentation.” Verify any installation snippet against the existing developer documentation before including it. No new credential workflow or live API widget.
4. **Analysis tools.** Compact cards for sequence evaluation, methylation analysis, epigenetic clocks, transposable elements, HLA exploration, and RNA Construct Builder. Each has one plain-language purpose and a direct destination. TE methylation can be described within methylation; do not duplicate its redirect as another independent tool. Provide “View all genomic tools” to `/genomics`.
5. **Data and methods.** A short explanation with direct links to data sources and methodology. Avoid adding counts, performance promises, “live” badges, or coverage claims without verifying them against current sources.
6. **Footer.** Retain useful tool/documentation/legal links and add About. Use Polymer for public-facing site branding. Preserve legal policy substance and existing research-use information.

Remove the discovery-loop and founder/contact sections from `/`. Keep Claims accessible through the directory/footer; it is not one of the two lead genome exploration destinations.

## About page

Create `/about` with the shared header and footer, using existing editorial primitives where suitable:

1. **Mission:** a brief, editable paragraph about making genomic reference data understandable to people and accessible to software. Draft: “Polymer brings genomic reference data and analysis tools into a shared interface, helping researchers move from whole-genome exploration to individual regions and programmatic analysis.” Elaborate with the user later; do not invent capabilities or institutional commitments.
2. **Founder:** move the existing Zachary Belden, MD biography and clinical/laboratory/computational background, retaining its factual wording. Give it a supporting role beneath the mission.
3. **Get in touch:** retain `polymergenomics@gmail.com`; replace the partnership-specific mail subject and confidential-program copy with a general invitation for questions, feedback, or collaboration. No contact form or backend needed.

Give the founder section `id="founder"`. Check repository references to `/#founder` and update them to `/about#founder`. If external fragment compatibility is needed, account for the fact that URL fragments do not reach server redirects; do not claim a Next.js redirect handles them.

## Implementation sequence and file map

### 1. Establish shared navigation

- Modify `src/components/BrandBar.tsx`: wordmark, About link, active/focus behavior, responsive fit.
- Modify `src/components/Footer.tsx`: About link and public-facing branding.
- Modify `src/app/portal/layout.tsx`: use the shared global header and retain Claims-specific tabs as local navigation. Check sticky offsets and viewport height so two navigation levels do not overlap.
- Audit all routable pages, including loading/error branches that render headers. Do not insert duplicate shared headers.
- Locate the separately deployed Claims source/configuration before claiming full cross-deployment consistency. If its source is outside this checkout, record the precise remaining change and coordinate it as a separate patch; do not silently declare it covered.

### 2. Extract reusable platform presentation

- Create `src/config/platformNavigation.ts` for curated destination labels, descriptions, canonical hrefs, and homepage/directory membership. Preserve the current example browser URL and its layer parameters.
- Extract the existing genome-browser and karyotype previews plus reusable lead/tool cards into `src/components/platform/` (small focused components, not a general-purpose UI framework).
- Reuse existing theme tokens, `ChromosomeSVG`, and karyotype configuration. Decorative previews remain lightweight; do not mount the live genome browser or add API requests to landing pages.
- Keep server-renderable presentation components server-renderable.

### 3. Build About and replace homepage composition

- Create `src/app/about/page.tsx`, with page-specific title, description, and canonical URL.
- Rewrite `src/app/page.tsx` around the six sections above.
- Remove its RNA glyph import and company-discovery copy. Retain shared assets used by other pages.
- Update `src/app/genomics/page.tsx` to consume the shared destinations/components, use database-first introduction copy, and include RNA Construct Builder in the full directory.
- Preserve the directory's useful detail while making the root page a more concise overview. Review existing numerical badges rather than copying them unquestioningly.
- Update `src/app/globals.css` only as needed for these layouts and interaction states; avoid broad changes to working tool styles.

### 4. Align metadata and share previews

- Update `src/app/layout.tsx` defaults and `src/app/page.tsx` metadata to Polymer / genomics database and API wording.
- Update `src/app/opengraph-image.tsx`: title, description, labels, badges, and alt text. Continue using the code-rendered `SocialCard`.
- Update `src/app/genomics/construct-builder/page.tsx` brand suffix while preserving its tool identity.
- Audit other page metadata for stale company-first positioning. Preserve tool-specific descriptions and give About its own canonical/social URL rather than inheriting the root URL.
- Keep the domain `polymerbio.org`, API host, SDK/package names, and existing legal identities unchanged unless separately requested. This is a public presentation change, not a domain or legal-entity migration.

### 5. Validate and prepare review

- Run `npx tsc --noEmit` and `npm run build` in `viewer/`. Record environmental blockers distinctly from application failures.
- Inspect `/`, `/about`, `/genomics`, docs, developer page, data sources, browser, atlas/chromosome detail, gene detail, evaluate, methylation, clocks, HLA, transposome, construct builder, portal, terms, and privacy for navigation consistency. Confirm TE methylation's intended redirect.
- Check new and preserved links, including legacy `/docs`, `/atlas`, and `/view/...` redirects, and the separate `/claims` destination when configured.
- Review desktop, tablet, and 360–390px mobile layouts. Pay particular attention to header subtitles, tool controls, card minimum widths, footer wrapping, and portal sticky navigation.
- Keyboard-check navigation and cards; confirm visible focus, logical heading order, descriptive accessible names, and reduced-motion behavior for any reused entrance animations.
- Smoke-check browser navigation, atlas drill-down, and construct-builder load. If data-backed checks require an unavailable API/key, report that limitation explicitly.
- Inspect rendered titles, descriptions, canonical URLs, and Open Graph image output.
- Supply local preview/screenshots and a concise change summary for review. Deployment is a separate step after implementation review; this plan does not initiate it.

## Completion criteria

- Global brand reads Polymer and links home on all in-scope pages; any separate deployment limitation is explicitly resolved or documented.
- Genomics, Docs, and About remain accessible across screen sizes.
- Homepage clearly presents browser, karyotype, API access, and analysis tools without requiring an intermediate directory visit.
- Founder and contact are available on About and absent from the homepage.
- RNA Construct Builder remains discoverable and functional as a supporting tool.
- Homepage, directory, metadata, and share image describe a genomics platform consistently.
- Existing routes, API integration, and scientific tool behavior remain functional.
- Build/type checks and relevant visual/navigation checks pass, with any unverified external dependencies clearly identified.

## Scope boundaries and working assumptions

This phase introduces no new search engine, authentication, database functionality, scientific analysis, or backend changes. Existing palette and type remain. Mission copy above is provisional and can be refined during review. The implementation is available locally; further copy and visual refinements can follow user review.


## Local implementation and verification — 2026-11-03

- Local preview: `http://127.0.0.1:3000`, started from `viewer/` with `npx next dev --webpack --hostname 127.0.0.1 --port 3000`.
- Implemented the overview, About page, shared directory/cards, header/footer branding, portal global navigation, metadata, and generated social image.
- `npm run build`, `npx tsc --noEmit`, and `git diff --check` passed.
- Browser checks: homepage and About rendered without page errors; homepage widths 768, 390, and 360px had no horizontal overflow. About also fit 360px. Desktop/mobile screenshots were inspected.
- Nineteen additional routes returned HTTP 200 with POLYMER and an About link in the global header, including the browser, gene page, chromosome page, scientific tools, construct builder, local portal, and legal pages. No page exceptions were observed during these navigation smoke checks.
- Verified legacy docs/atlas/browser redirects and the TE methylation redirect. Open Graph image returned PNG with HTTP 200. Keyboard focus was visible on the brand link.
- Scientific calculations and complete data-loading workflows were not revalidated; the checks above cover presentation/navigation, not scientific correctness or backend availability.
- Separate Claims deployment: its header source is `../polymer-claims/viewer/src/components/chrome/Header.tsx` relative to the repository. It uses its own Polymer Claims header and is outside this patch. The local viewer has no `NEXT_PUBLIC_CLAIMS_ZONE` configured, so `/claims` is not available in this preview. The local `/portal` pages do have the new shared navigation. Before release, coordinate the separate Claims header and hosting configuration if cross-deployment global navigation is required.
- Existing unrelated untracked research files were left untouched. Nothing was committed, pushed, or deployed.
