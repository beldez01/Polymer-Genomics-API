# cbc-multiome Waddington Landscape Viewer — Scope

**Status:** scope for review (not yet built)
**Date:** 2026-06-04
**Inputs:** `cbc-multiome/output/cbc_multiome.rds` (the MAE), `cbc-multiome/map/hematopoiesis_graph.json` (the map), `cbc-multiome/map/hematopoiesis_map.md` (the research synthesis).

## Goal
An interactive 3D Waddington differentiation landscape: a rotatable surface where HSC sits at a peak and lineages descend into canalized valleys, with cells/markers flowing downhill — and where selecting any transition reveals **where in the genome** the regulatory change concentrates as an HSC differentiates. The landscape is **topology-fixed** (the researched hematopoiesis graph is the skeleton); the MAE supplies the terrain and the genomic drill-down.

## Locked decisions
- **Render:** true 3D surface via **three.js** (react-three-fiber + drei), rotatable/zoomable, balls = cell-type markers. 2D genomic panels use **D3**.
- **Elevation (height/potential):** **data-driven potential** — a stemness/differentiation-potential score per node (PRIMARY). **Fallback documented + exposed as a UI toggle:** *cumulative genomic change from HSC* (option 3), in case the data-driven potential looks wrong or non-monotonic. See §4.
- **Home:** a **new small Next.js app** at `cbc-multiome/landscape-viewer/` (Next 16 + react-three-fiber + D3). Reads a precomputed static `landscape.json`; no API/DB dependency.

## Architecture (3 pieces)

### 1. Precompute (R) → `landscape.json`
A script `cbc-multiome/scripts/50_compute_landscape.R` reads the MAE + graph and emits ONE compact JSON the app loads. The browser never touches the 2.35M×N matrices. Contents:
- **nodes[]:** id, label, compartment, lineage, data_modalities, `elevation` (the potential, §4), `elevation_alt` (cumulative-change fallback), 2D layout hint `(x,y)` (§3), per-node summary stats.
- **edges[]:** from, to, branch_nature, `change` per layer = # distal cCREs that *flip* between the two nodes (methylation |Δβ|>τ; accessibility/ATAC Δ>τ), and a **drill-down payload**: chromosome-binned histogram of where flips land, breakdown by SCREEN cCRE class (promoter/enhancer/CTCF), and top-N changed cCREs with associated genes (via the existing `enhancer_gene_links` layer).
- **meta:** thresholds, layer list, provenance, the elevation definitions used.

### 2. 3D landscape (react-three-fiber)
- A **continuous height surface** interpolated from the 12 node positions+elevations (§3), shaded as terrain (contours/colormap).
- **Nodes** as labeled spheres seated on the surface; **edges** as troughs/ribbons between them, colored/sized by genomic-change magnitude.
- **Flow:** animated markers descending gradient from HSC along edges (the "ball rolling down").
- **Controls:** orbit/zoom/pan; layer selector (methylation / accessibility / expression — separate surfaces per the decoupling finding); elevation-metric toggle (potential ↔ cumulative-change).

### 3. Genomic drill-down (D3)
Selecting a node or edge opens a panel answering "where in the genome": a **chromosome ideogram/karyogram** of changed cCREs, **cCRE-class bars**, and a **top-loci/genes** list. Per active layer. This is the heart of the user's goal (e.g. CMP→GMP should light up GATA1/TAL1 distal demethylation).

## §3. Turning 12 nodes into a continuous surface
The non-obvious part. Plan:
1. **2D layout (x,y):** y = developmental depth (HSC top → mature bottom, from graph distance); x = lineage spread (lymphoid ↔ myeloid ↔ erythroid), laid out so sibling lineages separate. Computed in precompute, stored per node.
2. **z = elevation** (§4) at each node.
3. **Interpolate** a smooth height field over the (x,y) plane — radial-basis / thin-plate-spline or inverse-distance weighting — so nodes sit in local minima (valleys) and inter-lineage regions rise into ridges (commitment barriers). Early-basin nodes (HSC/MPP/CLP/CMP/GMP) get a broad shallow basin; mature nodes get deep narrow valleys (canalization), matching Buenrostro geometry.
4. Render the field as a three.js mesh; balls follow −∇z along edges.

## §4. Elevation definitions
- **PRIMARY — data-driven potential (stemness):** per node, a stemness score (HSC = peak). Concretely: transcriptional entropy of the RNA layer (Shannon entropy of the per-node TPM distribution — high diversity ≈ stem, à la CytoTRACE/SCENT), optionally blended with chromatin "openness" breadth. Scaled so HSC ≈ max, mature ≈ min. Rationale: height reflects molecular state, not just topology.
- **FALLBACK (toggle) — cumulative genomic change from HSC:** elevation = running sum of cCRE flips accumulated along the shortest path from HSC. Directly ties height to "how much genome has been remodeled." Use if the entropy potential is noisy/non-monotonic on the 12 aggregated nodes.
- Both are precomputed and shipped; the UI toggles between them so we can judge empirically which reads better — and the fallback is one click away if the primary looks off.

## §5. Honesty / styling constraints (from the research)
- Terrain uses **distal cCREs** (the discriminative feature space), not promoters.
- Methylation and accessibility are **separate toggleable surfaces** (temporally decoupled; may disagree).
- Early nodes rendered as a **blurry basin**; mature as **canalized valleys**. Canonical-only nodes (Er/Mk off HSC, MEP, etc.) shown faded as a reference layer.
- **Uncertainty styling** for eosinophil/neutrophil GMP-attachment and the MLP≈CLP merge (dashed edges / annotations).
- Do **not** assert refuted claims (see graph.json `refuted_do_not_assert`).

## §6. Coverage reality the UI must convey
Progenitors have only methylation+RNA+ATAC (3 layers); granulocytes lack ATAC; eosinophil lacks methylation. The viewer must gray out / annotate unavailable layers per node rather than imply data exists.

## §7. Tech stack
Next.js 16 (app router) · react-three-fiber + @react-three/drei (3D) · d3 (2D ideogram/bars) · static `landscape.json` in `/public`. No server runtime; `next build` → static export possible. Dev: `npm run dev`.

## §8. Phasing (for the implementation plan)
- **P1 — Precompute + contract:** `50_compute_landscape.R` → `landscape.json` (nodes/edges/elevations/drill-down). Validate schema. *Deliverable: the JSON, inspectable before any UI.*
- **P2 — 3D surface:** scaffold Next app; render interpolated terrain + nodes + edges + orbit controls; layer + elevation-metric toggles.
- **P3 — Flow + drill-down:** descending markers; D3 genomic panel (ideogram/class-bars/top-loci) wired to selection.
- **P4 — Polish:** basin/canalization styling, uncertainty cues, canonical reference layer, coverage graying, legend.

## §9. Open design questions (carry into the plan)
1. Layer blending for elevation if RNA-entropy is weak — fall to cumulative-change, or blend chromatin breadth?
2. Edge "flip" threshold τ per layer — pick defensible defaults (e.g. methylation |Δβ|>0.2; ATAC quantile-normalized Δ) and expose as a precompute parameter.
3. Surface interpolation method (TPS vs IDW vs RBF) — choose for stable, interpretable hills with only 12 control points.
4. Gene attribution for top loci — use `enhancer_gene_links` (migration 063) vs nearest-TSS.
