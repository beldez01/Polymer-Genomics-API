# Human Hematopoiesis Differentiation Map

**Purpose:** literature-grounded scaffold for the cbc-multiome Waddington differentiation-landscape viewer.
**Companion data:** `hematopoiesis_graph.json` (machine-readable nodes/edges for the viewer).
**Provenance:** deep-research synthesis, 2026-06-04 (24 sources, 21 adversarially-verified claims, 4 refuted). Full machine result archived from task `widp9d0wl`.

---

## 1. The headline

Do **not** draw a clean discrete tree. The defensible modern picture is a **continuous, low-primed regulatory landscape** ("CLOUD-HSPCs") that radiates from a common basin of early multipotent cells and **canalizes** into committed lineages. The structure is **developmental-stage-specific**: oligopotent intermediates are abundant in fetal liver but largely collapse to a **two-tier (multipotent + unipotent)** architecture in adult bone marrow, where erythroid/megakaryocytic fates branch *directly off HSC/MPP*.

This is a **hybrid consensus, not a settled "no discrete structure" claim** (Laurenti & Göttgens 2018 call it an open question). Render blurriness at early branches; do **not** assert the absence of all discrete structure.

## 2. The map (two layers)

### 2a. Data-backed subgraph (the 12 sampled cells)
- **Early basin (blurry):** `hsc, mpp, clp, cmp, gmp` form a broad, soft-edged basin. CMP/GMP are *gateable immunophenotypic populations* that emerge from the continuum — not discrete fundamental entities (Velten 2017; Paul 2015).
- **Soft early branches:** lymphoid priming (MESP/ID motifs) vs myeloerythroid priming (GATA motifs) is measurable *within* multipotent cells before commitment (Buenrostro 2018).
- **Canalized endpoints (sharp):** `cd4_t, cd8_t, b_cell, nk, monocyte, neutrophil, eosinophil`.
- **Edges:** HSC→MPP→CLP→{B, NK, CD4 T, CD8 T}; MPP→CMP→GMP→{monocyte, neutrophil, eosinophil}. T-cell edges span an **extramedullary (thymic) maturation gap** not captured between the two nodes.
- **MLP≈CLP approximation:** the data mapped from Farlik's MLP populations into the `clp` node; **MLP0 (CD7−CD10−)** is the distinctively-methylated, most-multipotent apex of the lymphoid path (Farlik 2016). Flagged as an approximation.

### 2b. Canonical reference layer (no omics, for context)
`lmpp, mep, mlp, erythroid, mk, basophil, dc` and the classical edges — including the **deprecated** CMP→MEP→{Er, Mk} chain, kept only as the idealized textbook tree. Modern view: **Er and Mk branch directly off HSC/MPP** (Notta 2016); sorted MEPs are principally unipotent erythroid.

## 3. Where in the genome the change is written (the actionable part)

This is what the viewer's terrain should visualize:

1. **Decisions are written at DISTAL enhancers/cCREs, not promoters.** Distal ATAC elements classify blood cell types at ~**91%** purity vs ~**78%** for RNA (Corces 2016). → your **cCRE-keyed** ATAC + methylation layers are exactly the right feature space; distal cCRE accessibility is the single most discriminative feature.
2. **Enhancers are primed ahead of expression** — de novo lineage enhancers established early, foreshadowing the program (Corces 2016; Lara-Astiaso 2014, mouse). Caveat: "many," not "all" (Bevington 2015).
3. **Methylation change is lineage-asymmetric & enhancer/TF-centric.** Myeloid commitment is **demethylation-dominated** (607 demethylated regions vs 101 lymphoid), concentrated at **GATA1/TAL1** sites; methylation *shields* lymphoid progenitors from the default myeloid program; promoter methylation tracks expression only weakly (Farlik 2016). Directly interpretable on the Farlik-derived HSC/progenitor methylation columns.
4. **Accessibility and methylation are TEMPORALLY DECOUPLED** — accessibility flips in hours, demethylation lags; demethylation is not a prerequisite for TF binding (Barnett 2020). → render methylation and accessibility as **two separate, possibly-disagreeing layers**, not one fused rail.

## 4. Waddington formalism options (for the viewer)

The verified geometry (Buenrostro basin→canalization) *is* a Waddington landscape and supplies a defensible **"elevation": an accessibility-derived potential** — broad/low basin for HSC/MPP, deepening valleys for mature cells, saddles at branch points.

| Family | Examples | Elevation | Fit for our aggregated (12-node) data |
|---|---|---|---|
| Pseudotime/trajectory | Monocle3, Slingshot, PAGA, Palantir | graph distance / potential | PAGA fits a node-graph directly; others need single cells |
| Velocity flow | RNA velocity, CellRank | fate-prob / entropy | needs spliced/unspliced scRNA — not available |
| Explicit energy | Waddington-OT, quasi-potential/Hopfield, scEpath | a true potential U(x) | a real landscape; model-dependent; WOT needs time-series |
| GRN attractor | GATA1-PU.1 bistable switch | ODE basins | mechanistic saddles; low-dimensional |

**Constraint:** our data is **cell-type-aggregated (12 nodes), not single-cell** — Monocle/Slingshot/Palantir/velocity cannot run on it directly. Recommended path: **fix the topology** (this map) and make the **terrain = per-edge genomic-change magnitude** computed from our own layers (e.g. # distal cCREs flipping methylation/accessibility between adjacent nodes), with elevation = an accessibility potential or distance-from-HSC.

## 5. Verification ledger

**Confirmed (high confidence):** two-tier adult collapse (3-0), Er/Mk off HSC (3-0), CLOUD continuum (2-1), CMP/GMP continuum-derived (2-1), accessibility basin-and-canalization (3-0), distal-cCRE discrimination 91/78 (3-0), enhancer priming (3-0), lineage-asymmetric demethylation at GATA1/TAL1 (3-0), accessibility/methylation decoupling (3-0).

**Refuted — DO NOT assert in the viewer:**
- "lineage-restricted cells emerge *without any* transit through intermediates" (0-3)
- "~70% of HSC→progenitor expression change is lineage-independent" (0-3)
- "no progenitor occupies a mixed/co-primed state" (0-3) — co-primed states exist
- "LMPP/MLP keep lymphoid+myeloid coupled" (1-2)

## 6. Open questions (shape the viewer design)
1. Where do **eosinophil/neutrophil** terminal nodes attach? (generic GMP→granulocyte placement; not directly anchored in verified panels)
2. **MLP vs CLP** — safe merge, or separate nodes with different residual DC/myeloid potential?
3. Which **single scalar** is "elevation" — accessibility-potential vs WOT-energy — and do saddle points agree across methods?
4. Render methylation + accessibility as **two lagged layers**; is there a human dataset with simultaneous single-cell ATAC+methylation across the full hierarchy to validate against?

## Key sources
Velten 2017 (Nat Cell Biol); Notta 2016 (Science); Buenrostro 2018 (Cell); Corces 2016 (Nat Genet); **Farlik 2016 (Cell Stem Cell — our progenitor methylation source)**; Barnett 2020 (Mol Cell); Lara-Astiaso 2014 (Science, mouse); Paul 2015 (Cell); Laurenti & Göttgens 2018 (Nature review). URLs + verification votes in `hematopoiesis_graph.json` → `sources`.
