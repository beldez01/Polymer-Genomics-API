# Material Channel Integration Plan

**Date**: 2026-03-15
**Status**: Active
**Premise**: The symbolic channel is production-ready. The material channel — the scientific moat — is computed (2.1 GB, Phases 1-3.5) but not yet operationalized in the API.

---

## The Central Problem

The Dressed Hamiltonian `H = H₀ + V_meth + V_nuc + V_hist` is proven in theory and computed genome-wide, but the API only serves H₀ (Layer 0 biophysics). Layers 1, 2, and 3.5 exist as BigWig files in Polymer_Evolution but have no database schema, no ingestion code, and no API surface.

## Current Material Layer Status

| Material Layer | Computed (Evolution) | In Database | In API | In MCP |
|---|---|---|---|---|
| L0: Bare Polymer (8 core tracks) | Yes | Partial (loading) | Yes | Yes |
| L1: Methylation Perturbation (10 tracks) | Yes | No migration | No | No |
| L2: Nucleosome Wrapping (6 tracks) | Yes | **POSTPONED** — requires extensive validation before public posting | No | No |
| L3.5: Green's Function (4 scalar + 24 sparse) | Yes | No migration | No | No |
| L3: Histone Modifications | Not computed | No | No | No |

## Five Architectural Absences

### 1. The Layer Stack Is Flat
The API treats biophysics tracks as independent columns in a single table. No concept of layers building on layers. The Dressed Hamiltonian is invisible to the consumer.

**Need**: `query_layer_stack` endpoint that returns the full vertical slice with coupling metadata.

### 2. No Perturbation Engine (TIS)
No deformation operator — no way to ask "what happens to the material channel when I make this change?"

**Need**: `perturbation_impact` endpoint — variant → δE per layer → propagation range → net ΔH_dressed.

### 3. No Cross-Layer Physical Coupling
`correlate_layers` computes statistical correlation, not physical coupling constants (Shon 2019 Lp convergence, elastic bending model).

**Need**: Physics-informed coupling alongside statistical coupling.

### 4. No Cell-Type Contextualization
All material properties are genome-wide averages. FlowSorted methylation reference (6 blood cell types) exists but isn't used for cell-type-specific dressed energies.

**Need**: Cell-type-aware biophysics queries.

### 5. Theoretical Identity Is Invisible
No endpoint, documentation, or MCP tool description references the two-channel model, Dressed Hamiltonian, or epistemic architecture.

**Need**: Framework surfaced as first-class API metadata.

---

## Accretive Build Order

### Phase A: Complete the Material Stack ← START HERE
Create 3 migrations (038-040) and 3 ingestion scripts for L1, L2, L3.5. ~20 new columns on `biophysics.sequence_properties`. Pure plumbing — data exists, patterns exist.

**Migration 038**: L1 Methylation Perturbation (10 columns)
- Source: `~/Desktop/Polymer_Evolution/phase2/output/window_1000/`
- Tracks: cpg_count, cpg_density, cpg_obs_exp, meth_delta_G, meth_delta_Tm, meth_sensitivity, methylation_capacity, demethylation_cost, oxidation_depth, taut_relaxed

~~**Migration 039**: L2 Nucleosome Wrapping (6 columns)~~ — **INDEFINITELY POSTPONED.** Requires extensive independent validation before any public posting. Do not ingest.

**Migration 039**: L3.5 Green's Function (4 columns)
- Source: `~/Desktop/Polymer_Evolution/phase3_5/output/window_1000/`
- Tracks: correlation_length, integrated_response, perturbation_reach, response_asymmetry

### Phase B: Layer-Aware Query
Add `query_layer_stack` — vertical slice returning all layers in physical hierarchy: `{L0: {...}, L1: {...}, L2: {...}, L3_5: {...}}` with coupling metadata.

### Phase C: Perturbation Engine
Implement deformation operator δH. For any variant: δE at L0, propagate through L1 sensitivity, predict L2 wrapping change, estimate propagation range from L3.5 correlation length.

### Phase D: Cell-Type Dressing
Use FlowSorted methylation to compute cell-type-specific L1 states → dress L2 per cell type. 6 blood cell types immediately, expandable to 127 Roadmap epigenomes.

### Phase E: Framework Surfacing
Update AGENT.md, MCP tools, layer metadata to express theoretical identity. Add `/framework` endpoint with equations, layer model, epistemic classification.

---

## Intensification Opportunities

1. **evaluate_design → full material evaluation**: Compute through full layer stack, not just L0.
2. **correlate_layers → physics-informed coupling**: Add coupling constant estimation alongside statistical correlation.
3. **SBS spectrum → material-channel mutagenesis**: Cross-reference δΔG₃₇ with fragility composite and Green's function.
