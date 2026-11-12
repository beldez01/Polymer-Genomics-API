# GC content and isochores: editorial and example record

Date: 2026-11-11

Status: Expanded editorial drafts; scientific review pending

## Scope

Develop two connected foundational articles without changing their URLs or the
agreed collection order. GC content explains counts, callability, scale, pooling,
sequence order, and chromosome context. Isochores explains profiles, classes,
proposed domains, historical disagreement, and links to cellular/evolutionary
questions. Neither article is a guided experience.

## Local working material

- `~/Desktop/Research/topics/evolution/isochore-biology.md`: historical concepts,
  reference leads, and connections to other fields.
- `~/Desktop/Research/topics/polymer-physics/dna-thermodynamics-and-mechanics.md`:
  distinctions among composition, thermodynamics, and mechanics.
- `~/Desktop/Research/topics/biophysics/nucleosome-wrapping-model-revision.md`:
  reason not to import earlier sequence-predicted chromatin claims.

Research-note assertions that GC is a universal master variable, internal AUROCs,
and fixed mechanical effects were not carried into these educational articles.
The notes also have inconsistent dates/titles for some studies; references in
the articles were checked against the original publication records instead.

## Claim/source record

| Subject | Public primary source | Treatment in the draft |
| --- | --- | --- |
| Broad variation in human genome composition | International Human Genome Sequencing Consortium, Nature 2001 | Limited to the landscape observation; no current global counts inferred from that assembly. |
| Sequence order in thermodynamic models | SantaLucia, PNAS 1998 | Nearest-neighbor contributions differ from single-base composition; no new thermodynamic calculations added. |
| Chromosome 19 composition and gene/repeat context | Grimwood et al., Nature 2004 | Historical study as a relevant example; no old gene counts or chromosome lengths presented as current hg38 statistics. |
| Isochore mapping and five-family vocabulary | Costantini et al., Genome Research 2006 | A specified mapping approach; not a claim that Polymer reproduces that map. |
| Competing homogeneity criteria | Cohen et al., MBE 2005; Clay & Bernardi, MBE 2005 | Both interpretations cited; no declaration that a colored window resolves the dispute. |
| Composition and replication timing | Hiratani et al., PNAS 2004 | Retain mouse ES-cell/neural-precursor context; do not equate GC class with a universal replication schedule. |
| GC-biased evolution | Katzman et al., GBE 2011 | Fixation-bias evidence and a candidate recombination-associated process; not the established history of every GC-rich domain. |

Primary records, abstracts, and available article excerpts were consulted for
these narrowly stated claims. Scientific review should examine the full papers
and the balance of interpretations before changing draft status.

## Example calculations

The original teaching sequence consists of twelve 100-base blocks. Their G/C
counts are `30, 34, 32, 68, 72, 66, 42, 46, 44, 54, 58, 54`. Each remaining position
is A or T. The within-block arrangement is arbitrary. All 1,200 positions are
callable; total G/C count is 600, giving 50% GC.

The interactive figures recompute nonoverlapping windows directly from this
constructed sequence. They do not fetch biological data or select an empirical
chromosome. The 100-base baseline remains visible when choosing a larger window.

Expected totals:

| Window width | G/C counts per window | Matching-class runs |
| --- | --- | --- |
| 100 bp | 30, 34, 32, 68, 72, 66, 42, 46, 44, 54, 58, 54 | 6 |
| 300 bp | 96, 206, 132, 166 | 4 |
| 600 bp | 302, 298 | 1 |
| 1,200 bp | 600 | 1 |

Classification thresholds match the numerical cutoffs in
`src/polymer_genomics/ingest/isochores.py`: below 37, 41, 46, and 53 percent, then
H3. Merging contiguous same-class windows is only a display operation and does
not test homogeneity or infer biological domain boundaries.

The example helpers retain undefined GC as `null` when there are no A/C/G/T bases.
The ingestion code currently returns numeric zero in that case, which can be
classified as L1. That existing ingestion behavior was not changed here; the
articles explicitly require checking no-call handling rather than treating zero
as evidence for an AT-rich interval.

Worked denominator example: `ACGTNNGCAT` has ten positions, eight callable bases,
four G/C bases, 50% callable-base GC, and 80% callability. `AATT` has true 0% GC;
all-N sequence has undefined GC. The pooling example combines 8/10 and 0/2 callable
counts to give 8/12 (66.7%), rather than the unweighted mean of 80% and 0% (40%).

## Tool connections and source audit

- Chromosome overview: `/genomics/atlas/chr19`.
- Browser: `/genomics/view/hg38/chr19:1000001-1900000?layers=gencode_v44,isochores`.
- Both articles explain that chromosome overview colors are schematic. This was
  confirmed in `getIsochoreBins` in `viewer/src/config/karyotypeData.ts` and its
  use in `HighResChromosome.tsx`; they are not measured GC values.
- The browser interval preserves hg38, coordinates, and an explicit gene/isochore
  layer selection. Omitting the CpG layer avoids substituting CpG-centered GC
  summaries for the intended isochore-window context in the current GC renderer.
- The current isochore ingestion defaults to 300 kb windows, while the static
  data-source inventory describes 100 kb bins. Active deployed layer metadata
  was not independently verified. The articles therefore do not promise an
  empirical resolution or a particular historical domain map for the live layer.
- Changing the atlas renderer, GC renderer, provenance inventory, or backend
  ingestion is outside this article task. Record these issues for the separate
  browser/karyotype work instead of silently changing them here.

## Implementation and verification

Content: `src/content/library/composition-articles.ts`. Numerical examples:
`src/lib/libraryComposition.ts`. Interactive diagrams:
`src/components/library/CompositionFigure.tsx`. Article sections now support a
figure through the existing shared article renderer.

Run the numerical checks with Node 22.18 or newer:

```sh
node --experimental-strip-types --test tests/libraryComposition.test.mjs
```

The checks cover ambiguity/true zero/missing data, partial windows, invalid widths,
pooled denominators, threshold endpoints, exact synthetic counts, and contiguous
class merging. Continue with type/build checks and browser interaction/layout
checks before recording completion.

### Completed verification

The six numerical tests, TypeScript check, production build, and whitespace check
passed. Browser review passed for all existing article routes and collection
behavior, the new figures and exact tables, citations, and actual chromosome /
browser navigation. The two expanded pages were checked at 1440, 768, 390, and
360 px, with screenshots inspected and no horizontal page overflow. A chart-title
hydration mismatch found during review was corrected; the final run had no page
exceptions.

The browser automation checked native-select focus and option updates. Native
ArrowUp/Enter selection did not commit on this macOS headless browser even for
an isolated plain HTML select, so manual cross-platform keyboard-menu behavior
is not claimed as validated. The graphical teaching values were tested
independently of live genomic values; tool navigation checks do not validate a
backend dataset or its scientific interpretation.
