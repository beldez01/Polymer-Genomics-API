"""Hand-migrate the 4 composite-synthesis claims to v1.2.

These are the cases the automatic migrator (`migrate_claims_v1_1_to_v1_2.py`)
flagged as MANUAL because they're synthesis claims with multiple
``depends_on`` targets — they want a `composite` subject under
``domain: multi_modal``, not a generic cohort.

This script:
  * reads each of the 4 known composite claims,
  * builds a `composite` subject whose `parts` are `literal` references
    to the depended-on claims (machine-traceable; fuller subject types
    can be added later when the dependents themselves carry richer
    subjects),
  * sets `domain: multi_modal` and a minimal `context`,
  * validates the result with the v1.2 pydantic model,
  * writes back in-place.

After this runs, the migration loop is closed: every claim in the corpus
is v1.2.
"""

from __future__ import annotations

import json
from pathlib import Path

from polymer_genomics.formal_claims import FormalClaim

REPO = Path(__file__).resolve().parents[1]

# (path-from-repo, declared modality strings, narrative for the composite subject)
COMPOSITES = [
    {
        "path": REPO
        / "internal/InSilico/HLA experiment/claims/hla_a_expression_prediction_robust_across_premise_sets.json",
        "modalities": ["genomic-coupling", "expression"],
        "relation": "co_occurrence",
        "narrative": "HLA-A expression prediction is robust across two independent premise sets (ΔG37 + CpG density), supporting the joint coupling hypothesis.",
    },
    {
        "path": REPO
        / "internal/InSilico/HLA experiment/claims/stimulation_amplifies_biophysical_signal.json",
        "modalities": ["resting", "stimulated"],
        "relation": "conditional",
        "narrative": "The biophysical signal in HLA-A expression coupling amplifies under stimulation, conditional on baseline (resting) coupling.",
    },
    {
        "path": REPO
        / "internal/InSilico/TE surveillance/claims/te_surveillance_dichotomy_composition_vs_identity.json",
        "modalities": ["composition-channel", "identity-channel"],
        "relation": "correlational",
        "narrative": "The TE surveillance dichotomy: composition-mode silencing (overall AUROC), identity-mode silencing (within-age bivalent), and the H3K9me3 negative control jointly partition the surveillance landscape into composition vs identity channels.",
    },
    {
        "path": REPO
        / "internal/InSilico/dual_channel/claims/human_ecoli_effect_ratio_consistent_with_ne_scaling.json",
        "modalities": ["human", "e-coli"],
        "relation": "causal_hypothesis",
        "narrative": "The ratio of cost-expression effect sizes (human vs E. coli + B. subtilis) is consistent with effective-population-size scaling, proposing a causal selection mechanism for the dual-channel hypothesis.",
    },
]


def _literal_part(claim_id: str, narrative_hint: str) -> dict:
    return {
        "kind": "literal",
        "id": f"literal:claim_ref/{claim_id}",
        "display": f"Reference to claim '{claim_id}'",
        "prose": narrative_hint,
        "structured": {
            "referenced_claim_id": claim_id,
            "reference_type": "depends_on",
        },
    }


def _composite_subject(claim: dict, narrative: str, relation: str) -> dict:
    deps: list[str] = list(claim.get("depends_on", []))
    parts = [
        _literal_part(d, f"Constituent claim {d} of the composite synthesis: {narrative}")
        for d in deps
    ]
    return {
        "kind": "composite",
        "id": f"composite:synthesis/{claim.get('id','unknown')[-32:]}",
        "display": claim.get("title", "Composite synthesis")[:240],
        "parts": parts,
        "relation": relation,
    }


def _insert_v12(claim: dict, domain: str, subject: dict, context: dict) -> dict:
    out: dict = {}
    for k, v in claim.items():
        if k == "premises":
            out["domain"] = domain
            out["subject"] = subject
            out["context"] = context
        out[k] = v
    return out


def main() -> int:
    failures = 0
    for spec in COMPOSITES:
        path: Path = spec["path"]  # type: ignore[assignment]
        if not path.exists():
            print(f"[MISSING] {path.relative_to(REPO)}")
            failures += 1
            continue
        raw = json.loads(path.read_text())
        if raw.get("schema_version") == "v1.2":
            print(f"[skip already-v1.2] {path.relative_to(REPO)}")
            continue
        if raw.get("schema_version") != "v1.1":
            print(f"[skip unexpected version {raw.get('schema_version')!r}] {path.relative_to(REPO)}")
            continue
        if len(raw.get("depends_on", [])) < 2:
            print(f"[skip not actually composite] {path.relative_to(REPO)}")
            continue

        subject = _composite_subject(raw, spec["narrative"], spec["relation"])  # type: ignore[arg-type]
        upgraded = dict(raw)
        upgraded["schema_version"] = "v1.2"
        upgraded = _insert_v12(
            upgraded,
            domain="multi_modal",
            subject=subject,
            context={"modalities": spec["modalities"]},
        )
        try:
            FormalClaim.model_validate(upgraded)
        except Exception as exc:
            print(f"[FAIL validation] {path.relative_to(REPO)} — {exc}")
            failures += 1
            continue

        path.write_text(json.dumps(upgraded, indent=2, ensure_ascii=False) + "\n")
        print(f"[ok composite] {path.relative_to(REPO)} → multi_modal / composite ({len(subject['parts'])} parts, relation={spec['relation']})")

    return 0 if not failures else 1


if __name__ == "__main__":
    import sys

    sys.exit(main())
