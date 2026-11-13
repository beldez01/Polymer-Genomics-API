# Knowledge Library

Cross-site release and viewer planning: [website plan](website-plan.md),
[work log](WORK_LOG.md), and [website checklist](TODO.md). The library remains
a separate editorial workstream; its research checklist below is authoritative
for article production and scientific review.

The library is available at `/library`, with article pages at `/library/[slug]`.
It is rendered from version-controlled content and does not require the genomics
API to load. Guided experiences are outside this implementation.

The [current expansion checklist](../../docs/research/dark-genomics-2026-11-11/TODO.md)
tracks completed work, remaining scientific review, origins production, and the
pending ERE/viral-mimicry source audit. Dated implementation records below are
historical; the checklist supplies current next steps.

The proposed next phase is documented in the
[Knowledge Library expansion plan](redesign/2026-11-11-knowledge-library-expansion-plan.md),
including collection order, local source mapping, and the new chromatin article.

The [dark-genomics expansion plan](redesign/2026-11-12-dark-genomics-expansion-plan.md)
maps the research dossier's 42 briefs to phased additions and existing-article
extensions, with sourcing gates, draft-status requirements, and explicit handling
of the unresolved repeat boundary-erosion hypothesis.

## Editing content

Edit `src/content/library.ts`. Each article includes a stable slug, description,
format, subject memberships, search terms, revision date, review status, sections,
references, related article slugs, and links to existing tools. Keep slugs stable
after publication; arrange a redirect if one must change.

Sections need unique IDs within the article. `sourceIds` refer to entries in the
article's references and appear as links beside the relevant section. Reference
links should point to the original research or official documentation. Write
original explanations and do not reproduce source figures or long passages.

The current eleven entries are editorial drafts awaiting scientific review. The
material-channel article describes a provisional Polymer perspective and should
be refined with the founder. Do not mark content reviewed or attribute it to a
named author without an actual review or authorship decision. Establish the
editorial license before public publication.

New articles automatically join the directory, local text search, related-link
lookup, reading-time calculation, and static generation. Add their URL to
`public/sitemap.xml`. New subjects belong in `LIBRARY_SUBJECTS`; expose a subject
when there is content for it rather than introducing empty category pages.

Each entry has a `collection` (`foundations` or `reference`) and an explicit
`order` within that collection. `getOrderedLibraryArticles()` determines the
landing-page order without requiring source objects to move. Text/subject filters
apply to both collections; empty groups disappear while filtering. A `methods`
subject membership does not automatically move a foundational article into the
reference collection.

Longer articles can live in `src/content/library/` and import `LibraryArticle`
as a type. The chromatin article is in `chromatin-maintenance.ts`; its internal
source record is in [the editorial brief](editorial/chromatin-maintenance-brief.md).
Do not include private source paths in public article content.

Sections can include a table with a caption, headings, and rows. Table content is
included in search and reading time. Tables have column/row headers and a focusable
horizontal scroll region for narrow screens. Section citations use numbered links
to the article's reference list.

Sections can also include a `figure`, using `LibraryFigureKind`. The expanded GC
and isochore entries live in `src/content/library/composition-articles.ts`; their
interactive window figures use pure calculations in `src/lib/libraryComposition.ts`.
These calculations use a labeled synthetic sequence and make no API requests.
The figures' compact value tables fit within narrow-screen layouts.

## Presentation

- `src/app/library/`: page layouts, metadata, article routing, missing-article UI,
  and scoped styles.
- `src/components/library/LibraryDirectory.tsx`: client-side text/subject filters.
- `src/components/library/LibraryFigure.tsx`: code-native schematic figures.

The search matches every entered term against the title, description, curated
terms, and article section text; subject and text filters combine. No search
service, account, or persistent storage is involved.

Figures are labeled synthetic or schematic. Tool links must preserve the assembly,
region, and supported layer selection when pointing to a specific browser view.
Keep methods documentation and educational explanations separate but connected.

## Validation

Run `npx tsc --noEmit` and `npm run build` in `viewer/` after implementation changes.
Review search and combined filters, the empty/reset state, related links, section
anchors, article references, missing slugs, metadata, and narrow-screen layouts.
Shared navigation changes also need checking outside the library, especially on
pages with extra header controls.

## Initial implementation verification — 2026-11-11

- TypeScript check and production build passed.
- Browser checks passed for text search, subject filters, combined empty/reset
  behavior, all eight article routes, metadata/canonical URLs, section/reference
  anchors, related-article navigation, and a missing article returning HTTP 404.
- Landing and sample article layouts were checked at 1440, 768, 390, and 360 px;
  no horizontal page overflow was found. Desktop and mobile screenshots were
  inspected. Home, directory, and About navigation integration also passed.
- No browser page exceptions were observed in those checks.
- Scientific review of editorial drafts and full data-backed tool workflows are
  not covered by these interface checks. Nothing was published or deployed.

## First expansion implementation — 2026-11-11

- Implemented the planned foundational order, with CpG distribution eighth and
  genomic coordinates in a separate Methods & reference group.
- Added the chromatin maintenance article, an Epigenetics & chromatin subject,
  the machinery table, an original replication/restoration schematic, seventeen
  primary references, and reciprocal related-reading links.
- Added an editorial brief/claim-source record. Article status remains draft;
  the fuller foundation rewrites and later collections remain planned work.
- Production build (including TypeScript), whitespace checks, and browser checks
  passed. Browser checks covered the eight-plus-one order/grouping, nine routes,
  new subject and combined filters, reference-only and table-text search, reset,
  keyboard filtering/table scrolling, citations/anchors, metadata, reciprocal
  links, missing-article behavior, and 1440/768/390/360 px layouts. No page
  exceptions or horizontal page overflow were observed. Screenshots were inspected.
- The existing local preview was reused. Nothing was published or deployed, and
  research/boards source materials were not modified.

## GC content and isochores expansion — 2026-11-11

- Replaced the two short entries with fuller drafts covering callable-base GC,
  pooling, scale, sequence order, domain/class distinctions, family thresholds,
  historical disagreement, and biological/evolutionary context. Existing slugs,
  section anchors, and collection positions were retained.
- Added interactive figures with 100/300/600/1,200 bp windows, a fine-window
  baseline, exact-value tables, and an additional class/merged-run view in the
  isochore article. All examples are synthetic and explicitly labeled.
- Added primary references and direct hg38 chromosome/browser links. Descriptions
  distinguish schematic atlas coloring from available database annotations.
- Recorded sources, numerical expectations, and existing provenance limitations
  in [the editorial record](editorial/gc-and-isochores-brief.md).
- Six numerical checks passed using
  `node --experimental-strip-types --test tests/libraryComposition.test.mjs`.
  TypeScript, production build, and whitespace checks passed.
- Browser review passed for collection/search regression, all nine article
  routes, window changes and exact values, class merging, citation anchors,
  metadata, reciprocal links, missing-article handling, and actual chromosome /
  browser navigation with assembly and layer selection preserved. Both expanded
  pages fit 1440/768/390/360 px without horizontal page overflow. Desktop/mobile
  screenshots were inspected; no page exceptions were observed in the final run.
- Keyboard focus on the labeled native dropdown was checked. The macOS headless
  browser did not commit ArrowUp/Enter selection in either this control or an
  isolated plain HTML select; automated option selection verified the calculation
  updates. Cross-platform native-menu keyboard selection remains a manual check.
- Scientific review and independent verification of live genomic values remain
  separate. No publication, deployment, backend, or atlas-renderer change occurred.

## Dark-genomics batch 0 — 2026-11-12

- Expanded DNA thermodynamics into an imported content module, incorporating
  briefs 10–11 while retaining its slug, order, and three existing section anchors.
- Added DNA mechanics (brief 12) and physical annotation/evidence (brief 36) to
  Methods & reference. The library now contains eight foundations and three
  reference entries. Existing foundation order is unchanged.
- Added original code-native mechanics and evidence figures, comparison tables,
  primary references, reciprocal related links, and sitemap entries. All eleven
  articles retain editorial-draft status and scientific-review-pending labels.
- Added the [batch evidence record](editorial/physical-foundations-brief.md),
  [reusable template](editorial/evidence-record-template.md),
  [source extension register](editorial/dark-genomics-source-extensions.md),
  [copying-fidelity figure specification](editorial/copying-fidelity-figure-spec.md),
  and [internal reading-path outline](editorial/genome-possible-reading-path.md).
  The evidence record distinguishes targeted full-text inspection from abstract
  access and unreviewed supplements; these remain publication gates.
- TypeScript and production build passed, as did whitespace checks and the six
  existing composition-calculation tests. The copying-fidelity specification's
  nine rounded values were checked with independent high-precision decimal
  arithmetic; no copying-fidelity widget or article was added in this batch.
- Production-preview browser checks passed for all eleven routes, draft labels,
  canonical URLs, citation and contents anchors, related-route resolution,
  preserved thermodynamics anchors, combined text/subject filters, table-text
  search, empty/reset behavior, focusable table regions, and missing-route HTTP
  404. The directory and all three changed/new articles were checked at 1440,
  768, 390, and 360 px with no horizontal page overflow or page exceptions.
  Desktop mechanics and mobile mechanics/evidence screenshots were inspected.
- Origins articles and later production batches remain planned. The LINE-1/ERV
  boundary-erosion hypothesis has not been introduced as a mechanism. No public
  deployment, API change, new measurement layer, or scientific-review claim was
  made.

## Batch 0 source review — 2026-11-12

- Completed an internal source-and-methods review of the three batch 0 articles;
  [the report](editorial/physical-foundations-review-2026-11-12.md) records eleven
  findings and applied revisions. The [manifest](editorial/physical-foundations-review-manifest.json)
  records eleven primary sources, notice/version relationships, retrieval URLs,
  and twenty inspected artifact hashes. This is separate from independent
  scientific sign-off, which remains pending.
- Closed the earlier Bryant and Erdel main-text access gaps, inspected relevant
  primary methods and supplements, and added Ke 2025, Gordiychuk 2026, and Popay
  2026 as scoped updates. Source limits, preprint distinctions, normalization,
  perturbation timing, and model scope are explicit in the revised drafts.
- TypeScript, the final production build, whitespace checks, review-document
  links, and manifest consistency passed. Browser checks passed for the three
  revised pages: new sections and prose, all citation targets, reference counts,
  preserved thermodynamics anchors, canonical metadata, draft notices, and
  search/filter/reset behavior. Layout checks at 1440/768/390/360 px found no
  horizontal overflow or page exceptions. Desktop thermodynamics and mobile
  evidence screenshots were inspected.
- No origins article, later batch, deployment, or commit was started as part of
  this review. All articles remain editorial drafts. Independent subject-matter
  review and the existing editorial publication decisions remain pending.

## Library review and GitHub sync — 2026-11-12

- Reviewed the pending batch 0 implementation and its existing source-review
  records. No blocking implementation finding was identified. This pass did not
  repeat the primary-source audit or provide independent scientific sign-off.
- Production build (including TypeScript) and all six composition tests passed.
  Checked the generated HTML for all eleven articles: unique IDs, citation and
  contents anchors, related-article routes, draft/review notices, canonical URLs,
  and sitemap coverage passed. Whitespace checks passed. This pass did not repeat
  the previously recorded browser interaction and responsive-layout checks.
- Isolated the library expansion on `feat/knowledge-library-expansion` for GitHub
  sync. Included its editorial records and research roadmap/checklist; unrelated
  PolyMethyl, figures, and EPICv2 script work remains outside this change.
- The landing-page-only commit `653272f` was deployed separately to the `viewer`
  production project and verified at polymerbio.org. Syncing this library branch
  does not deploy the library to that production project. Independent scientific
  review, editorial license, and authorship decisions remain pending.
