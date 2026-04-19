"""Formal Claim IR (v3-formal, schema v1.1).

Executable logical-statistical claim objects — the ⟨P, O, S, I, C⟩ 5-tuple.

Spec: internal/epistemic_os/13_FORMAL_CLAIM_IR.md §3 (v1.1).
Fixtures: internal/epistemic_os/fixtures/*.json.
"""

from polymer_genomics.formal_claims.feature_extractor import (
    FEATURE_DIM,
    FEATURE_NAMES,
    INSILICO_ROOT,
    build_feature_matrix,
    extract_features,
    load_all_formal_claims,
)
from polymer_genomics.formal_claims.projection import ProjectionResult, project
from polymer_genomics.formal_claims.schema import (
    SCHEMA_VERSION,
    Agg,
    AggregateOp,
    AndExpr,
    Audit,
    CmpExpr,
    CompositeConfidence,
    # Conclusion
    Conclusion,
    CorrectOp,
    CVScheme,
    CVSplitOp,
    DataDerivedConstant,
    EstimatorOp,
    EstimatorSpec,
    EvidenceClass,
    # External
    ExternalAssumption,
    FeatureSet,
    FilterOp,
    # Root
    FormalClaim,
    InferenceExpression,
    # Inference
    InferenceRule,
    JoinExpr,
    JoinOp,
    # Shared
    LayerRef,
    NotExpr,
    NullModelOp,
    NullModelSpec,
    # Operations
    Operation,
    OrExpr,
    Outcome,
    # Premises
    Premise,
    ProjectOp,
    ProvenanceState,
    # Predicates
    SetExpression,
    # Statistics
    Statistic,
    StatRef,
)

__all__ = [
    "SCHEMA_VERSION",
    "LayerRef",
    "ProvenanceState",
    "EvidenceClass",
    "FeatureSet",
    "DataDerivedConstant",
    "SetExpression",
    "AndExpr",
    "OrExpr",
    "NotExpr",
    "CmpExpr",
    "JoinExpr",
    "Premise",
    "Operation",
    "FilterOp",
    "ProjectOp",
    "JoinOp",
    "AggregateOp",
    "CVSplitOp",
    "EstimatorOp",
    "NullModelOp",
    "CorrectOp",
    "Agg",
    "CVScheme",
    "EstimatorSpec",
    "NullModelSpec",
    "Statistic",
    "InferenceRule",
    "InferenceExpression",
    "StatRef",
    "Conclusion",
    "CompositeConfidence",
    "Outcome",
    "ExternalAssumption",
    "Audit",
    "FormalClaim",
    # Projection
    "FEATURE_DIM",
    "FEATURE_NAMES",
    "INSILICO_ROOT",
    "extract_features",
    "build_feature_matrix",
    "load_all_formal_claims",
    "ProjectionResult",
    "project",
]
