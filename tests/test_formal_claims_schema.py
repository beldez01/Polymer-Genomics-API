"""Acceptance test for the Formal Claim IR schema (v1.1).

Loads the hand-encoded Exp 17 fixture and validates it through pydantic.
If this test fails, the schema and the fixture have drifted and one of them
must be updated. Fixture is the ground truth for M0; schema is the ground
truth thereafter.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from pydantic import ValidationError

from polymer_genomics.formal_claims import (
    SCHEMA_VERSION,
    SCHEMA_VERSIONS_SUPPORTED,
    Cohort,
    CohortDefinition,
    CohortSourceDataset,
    CompositeSubject,
    CVSplitOp,
    DataDerivedConstant,
    EstimatorOp,
    FormalClaim,
    GeneOrProtein,
    GeneOrProteinIdentifiers,
    GenomicRegion,
    LayerRef,
    LiteralSubject,
    OntologyTerm,
    PathwayRef,
    PhenopacketRef,
    PhenopacketRetrieval,
    S4ObjectRef,
    VariantVRS,
)

FIXTURES_DIR = (
    Path(__file__).resolve().parents[1]
    / "internal"
    / "epistemic_os"
    / "fixtures"
)


def _load(name: str) -> dict:
    with open(FIXTURES_DIR / name) as f:
        return json.load(f)


def test_schema_version_constant() -> None:
    assert SCHEMA_VERSION == "v1.2"


def test_exp17_fixture_validates() -> None:
    claim = FormalClaim.model_validate(_load("exp17_formal_claim.json"))
    assert claim.schema_version == "v1.1"
    assert claim.exp_number == 17
    assert claim.conclusion.outcome == "strong_positive"


def test_exp17_provenance_state_is_local_rds() -> None:
    """v1.1 patch 7: LayerRef.provenance_state must round-trip."""
    claim = FormalClaim.model_validate(_load("exp17_formal_claim.json"))
    for premise in claim.premises:
        assert isinstance(premise.source, LayerRef)
        assert premise.source.provenance_state == "local_rds"


def test_exp17_data_derived_threshold_parses() -> None:
    """v1.1 patch 4: the top-quartile threshold is a first-class DataDerivedConstant,
    not an opaque string."""
    claim = FormalClaim.model_validate(_load("exp17_formal_claim.json"))
    binarize = next(op for op in claim.operations if op.id == "o_binarize_top_quartile")
    # predicate is a CmpExpr; rhs is a DataDerivedConstant
    rhs = binarize.predicate.rhs  # type: ignore[union-attr]
    assert isinstance(rhs, DataDerivedConstant)
    assert rhs.fn == "quantile"
    assert rhs.col == "co_rate_avg"
    assert rhs.params == {"q": 0.75, "na_rm": True}


def test_exp17_cv_split_is_first_class_operation() -> None:
    """v1.1 patch 5: CV fold construction is its own Operation kind."""
    claim = FormalClaim.model_validate(_load("exp17_formal_claim.json"))
    cv_ops = [op for op in claim.operations if isinstance(op, CVSplitOp)]
    assert len(cv_ops) == 1
    assert cv_ops[0].scheme.kind == "k_fold_by_chromosome"
    assert cv_ops[0].scheme.k == 5
    assert cv_ops[0].scheme.seed == 42


def test_exp17_estimators_use_feature_sets() -> None:
    """v1.1 patch 3: estimator features are FeatureSet objects, not strings."""
    claim = FormalClaim.model_validate(_load("exp17_formal_claim.json"))
    est_ops = [op for op in claim.operations if isinstance(op, EstimatorOp)]
    assert len(est_ops) == 3
    labels = {op.estimator.features.label for op in est_ops if op.estimator.features}
    assert labels == {
        "gc_only",
        "all_24_biophysics_including_gc",
        "biophysics_minus_gc",
    }
    # M2 should subtract gc_content from M1
    m2 = next(op for op in est_ops if op.id == "o_rf_m2_biophysics_minus_gc")
    assert m2.estimator.features.label == "biophysics_minus_gc"
    assert m2.estimator.features.parent == "all_24_biophysics_including_gc"
    assert m2.estimator.features.exclude == ["gc_content"]


def test_exp17_impl_is_r_not_python() -> None:
    """v1.1 patch 2: impl supports namespace-prefixed R references."""
    claim = FormalClaim.model_validate(_load("exp17_formal_claim.json"))
    est_ops = [op for op in claim.operations if isinstance(op, EstimatorOp)]
    for op in est_ops:
        assert op.estimator.impl.startswith("R::")


def test_exp17_categorical_statistic_value() -> None:
    """v1.1 patch 1: Statistic.value accepts strings for categorical outputs."""
    claim = FormalClaim.model_validate(_load("exp17_formal_claim.json"))
    top = next(s for s in claim.statistics if s.id == "s_top_feature")
    assert top.value == "quantization_map"
    assert top.evidence_class == "S"


def test_exp17_composite_confidence_block() -> None:
    """v1.1 patch 6: claim-level confidence has its own block."""
    claim = FormalClaim.model_validate(_load("exp17_formal_claim.json"))
    cc = claim.conclusion.composite_confidence
    assert cc is not None
    assert cc.procedure == "bootstrap"
    assert cc.impl == "R::boot::boot"
    assert cc.n_resamples == 1000
    # interval and prob_inference_holds are null until evaluate.py fills them
    assert cc.interval is None
    assert cc.prob_inference_holds is None


def test_exp17_inference_rule_structure() -> None:
    """Sanity-check the three-conjunct inference licensing the strong-positive."""
    claim = FormalClaim.model_validate(_load("exp17_formal_claim.json"))
    root = claim.inference.expression
    assert root.kind == "and"  # type: ignore[union-attr]
    assert len(root.terms) == 3  # type: ignore[union-attr]
    # At least one conjunct compares an AUROC to the pre-registered 0.05 threshold
    assert any(
        t.kind == "cmp"  # type: ignore[union-attr]
        and t.lhs.stat_id == "s_delta_auroc_m1_m0"
        and t.rhs == 0.05
        for t in root.terms  # type: ignore[union-attr]
    )


def test_extra_fields_are_rejected() -> None:
    """The base model forbids extras so fixture typos surface loudly."""
    bad = _load("exp17_formal_claim.json")
    bad["unexpected_field"] = "should fail"
    with pytest.raises(Exception):  # pydantic.ValidationError
        FormalClaim.model_validate(bad)


# ---------------------------------------------------------------------------
# v1.2 — polymorphic subject slot + domain discriminator
# ---------------------------------------------------------------------------


def test_v12_is_in_supported_versions() -> None:
    assert "v1.1" in SCHEMA_VERSIONS_SUPPORTED
    assert "v1.2" in SCHEMA_VERSIONS_SUPPORTED


def test_genomic_region_validates() -> None:
    subj = GenomicRegion(
        id="hg38:chr6:29941000-29942000:+",
        display="HLA-A promoter",
        assembly="GRCh38.p14",
        chrom="chr6",
        start=29941000,
        end=29942000,
        strand="+",
    )
    assert subj.kind == "genomic_region"


def test_genomic_region_rejects_start_after_end() -> None:
    with pytest.raises(ValidationError, match="start.*>.*end"):
        GenomicRegion(
            id="bad",
            display="bad",
            assembly="GRCh38.p14",
            chrom="chr1",
            start=200,
            end=100,
        )


def test_variant_vrs_requires_ga4gh_prefix() -> None:
    with pytest.raises(ValidationError, match="ga4gh:VA"):
        VariantVRS(
            id="not-a-vrs-id",
            display="bad",
            vrs_version="1.3",
        )


def test_ontology_term_validates() -> None:
    term = OntologyTerm(
        id="HP:0001250",
        display="Seizure",
        ontology="HPO",
        ontology_release="2026-01-16",
        uri="http://purl.obolibrary.org/obo/HP_0001250",
        propagation="self_or_descendant",
    )
    assert term.kind == "ontology_term"


def test_gene_or_protein_requires_canonical_id() -> None:
    with pytest.raises(ValidationError, match="hgnc.*ensembl_gene.*uniprot"):
        GeneOrProtein(
            id="symbol:MLH1",
            display="MLH1",
            identifiers=GeneOrProteinIdentifiers(symbol="MLH1"),
            entity_type="gene",
        )


def test_gene_or_protein_with_hgnc_validates() -> None:
    gene = GeneOrProtein(
        id="HGNC:6840",
        display="MLH1",
        identifiers=GeneOrProteinIdentifiers(hgnc="HGNC:6840", symbol="MLH1"),
        entity_type="gene",
    )
    assert gene.identifiers.hgnc == "HGNC:6840"


def test_phenopacket_reference_mode_requires_uri() -> None:
    with pytest.raises(ValidationError, match="uri"):
        PhenopacketRef(
            id="zenodo:x#1",
            display="proband",
            phenopacket_version="2.0",
            retrieval=PhenopacketRetrieval(mode="reference"),
        )


def test_phenopacket_inline_mode_requires_payload() -> None:
    with pytest.raises(ValidationError, match="inline payload"):
        PhenopacketRef(
            id="local:p1",
            display="proband",
            phenopacket_version="2.0",
            retrieval=PhenopacketRetrieval(mode="inline"),
        )


def test_cohort_with_set_expression_inclusion() -> None:
    cohort = Cohort(
        id="polymer:cohorts/gtex_v8_whole_blood_eqtl_positive",
        display="GTEx v8 Whole Blood eQTL+",
        definition=CohortDefinition(
            source_dataset=CohortSourceDataset(
                name="GTEx", version="v8", tissue="Whole Blood"
            ),
            inclusion=[
                {"kind": "cmp", "col": "has_cis_eqtl", "op": "=", "rhs": True}
            ],
            cardinality=16692,
        ),
        members_hash="blake3:a1b2c3",
    )
    assert cohort.definition.cardinality == 16692
    assert cohort.definition.inclusion[0].kind == "cmp"


def test_composite_subject_requires_two_parts() -> None:
    part_a = GenomicRegion(
        id="hg38:chr3:37050655-37050656:+",
        display="MLH1 c.1852",
        assembly="GRCh38.p14",
        chrom="chr3",
        start=37050655,
        end=37050656,
        strand="+",
    )
    part_b = OntologyTerm(
        id="HP:0001250",
        display="Seizure",
        ontology="HPO",
        ontology_release="2026-01-16",
        uri="http://purl.obolibrary.org/obo/HP_0001250",
    )
    composite = CompositeSubject(
        id="composite:abc",
        display="MLH1 c.1852 × Seizure",
        parts=[part_a, part_b],
        relation="co_occurrence",
    )
    assert len(composite.parts) == 2

    with pytest.raises(ValidationError):
        CompositeSubject(
            id="composite:one",
            display="lonely",
            parts=[part_a],
            relation="co_occurrence",
        )


# ---------------------------------------------------------------------------
# v1.2 — end-to-end FormalClaim with subject + domain
# ---------------------------------------------------------------------------


def _exp17_as_v12_genomic() -> dict:
    """Synthesize a minimal v1.2 payload by wrapping the exp17 v1.1 fixture."""
    claim = _load("exp17_formal_claim.json")
    claim["schema_version"] = "v1.2"
    claim["domain"] = "genomic"
    claim["subject"] = {
        "kind": "genomic_region",
        "id": "hg38:autosomes:1Mb-windows",
        "display": "Autosomes in 1 Mb windows (hg38)",
        "assembly": "GRCh38.p14",
        "chrom": "chr1",
        "start": 1,
        "end": 248956422,
        "strand": ".",
    }
    claim["context"] = {"assembly": "GRCh38.p14"}
    return claim


def test_v12_requires_domain_when_schema_is_v12() -> None:
    bad = _exp17_as_v12_genomic()
    del bad["domain"]
    with pytest.raises(ValidationError, match="requires a `domain`"):
        FormalClaim.model_validate(bad)


def test_v12_requires_subject_when_schema_is_v12() -> None:
    bad = _exp17_as_v12_genomic()
    del bad["subject"]
    with pytest.raises(ValidationError, match="requires a `subject`"):
        FormalClaim.model_validate(bad)


def test_v12_genomic_region_on_clinical_domain_is_rejected() -> None:
    bad = _exp17_as_v12_genomic()
    bad["domain"] = "clinical"
    with pytest.raises(ValidationError, match="does not permit subject.kind"):
        FormalClaim.model_validate(bad)


def test_v12_wrapped_exp17_validates() -> None:
    claim = FormalClaim.model_validate(_exp17_as_v12_genomic())
    assert claim.schema_version == "v1.2"
    assert claim.domain == "genomic"
    assert claim.subject is not None
    assert claim.subject.kind == "genomic_region"
    # Inference tree unchanged from v1.1 — evaluator-compat is preserved.
    assert claim.inference.expression.kind == "and"


def test_v11_fixture_still_loads_on_v12_schema() -> None:
    """Backwards compatibility: unchanged v1.1 fixtures are still valid."""
    claim = FormalClaim.model_validate(_load("exp17_formal_claim.json"))
    assert claim.schema_version == "v1.1"
    assert claim.domain is None
    assert claim.subject is None
