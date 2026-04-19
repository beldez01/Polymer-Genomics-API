"""Pydantic models for the Formal Claim IR (v3-formal, schema v1.1).

Mirror of internal/epistemic_os/13_FORMAL_CLAIM_IR.md §3.
Canonical fixture: internal/epistemic_os/fixtures/exp17_formal_claim.json.

Recursive types (SetExpression, InferenceExpression) use forward references
resolved via model_rebuild() at the end of the module.
"""

from __future__ import annotations

from typing import Annotated, Literal, Union

from pydantic import BaseModel, ConfigDict, Field

SCHEMA_VERSION = "v1.1"


# ---------------------------------------------------------------------------
# Shared enums / literal types
# ---------------------------------------------------------------------------

ProvenanceState = Literal[
    "fly_postgres",
    "local_rds",
    "remote_url",
    "reference_genome",
    "unknown",
]

EvidenceClass = Literal["M", "R", "D", "S", "K", "H", "L"]

Outcome = Literal[
    "strong_positive",
    "positive",
    "qualified_positive",
    "negative",
    "fail",
]


# ---------------------------------------------------------------------------
# Shared value types
# ---------------------------------------------------------------------------


class _Model(BaseModel):
    """Project base: forbid extras so typos in fixtures fail loudly."""

    model_config = ConfigDict(extra="forbid", populate_by_name=True)


class LayerRef(_Model):
    """A versioned reference to a named layer.

    v1.1: adds `provenance_state` so claims citing not-yet-ingested data
    (e.g., local RDS) are explicit rather than hiding the fact in `note`.
    """

    layer: str
    version: str
    provenance_state: ProvenanceState = "unknown"
    note: str | None = None


class DataDerivedConstant(_Model):
    """A scalar that is computed at evaluation time from a named operation's output.

    Lets thresholds like `quantile(co_rate_avg, 0.75)` stay first-class —
    hashable and recomputable — instead of being embedded as opaque strings
    inside `cmp.rhs`.
    """

    kind: Literal["derived"] = "derived"
    source_operation: str
    fn: Literal["quantile", "mean", "median", "sd", "min", "max", "count"]
    col: str
    params: dict | None = None


class FeatureSet(_Model):
    """Named column subset consumed by an estimator.

    Lets dynamic sets ("all biophysics minus gc_content") be hashable and
    audit-able. `resolved` is populated by evaluate.py from the premise schema.
    """

    label: str
    select: list[str] | None = None
    exclude: list[str] | None = None
    parent: str | None = None
    resolved: list[str] | None = None


# ---------------------------------------------------------------------------
# SetExpression — recursive, discriminated on `kind`
# ---------------------------------------------------------------------------

# cmp.rhs is a union of JSON-native scalars/arrays plus DataDerivedConstant.
CmpRhs = Union[
    int,
    float,
    bool,
    str,
    list[int],
    list[float],
    list[str],
    list[bool],
    DataDerivedConstant,
]


class AndExpr(_Model):
    kind: Literal["and"] = "and"
    terms: list["SetExpression"]


class OrExpr(_Model):
    kind: Literal["or"] = "or"
    terms: list["SetExpression"]


class NotExpr(_Model):
    kind: Literal["not"] = "not"
    term: "SetExpression"


class CmpExpr(_Model):
    kind: Literal["cmp"] = "cmp"
    col: str
    op: Literal["=", "!=", "<", "<=", ">", ">=", "in", "overlaps"]
    rhs: CmpRhs


class JoinExpr(_Model):
    kind: Literal["join"] = "join"
    on: str
    other: LayerRef
    where: "SetExpression | None" = None


SetExpression = Annotated[
    Union[AndExpr, OrExpr, NotExpr, CmpExpr, JoinExpr],
    Field(discriminator="kind"),
]


# ---------------------------------------------------------------------------
# Premise
# ---------------------------------------------------------------------------


class Premise(_Model):
    id: str
    source: LayerRef
    predicate: SetExpression
    cardinality: int | None = None
    content_hash: str
    note: str | None = None


# ---------------------------------------------------------------------------
# Operation — discriminated on `kind`
# ---------------------------------------------------------------------------


class Agg(_Model):
    col: str
    fn: Literal["mean", "median", "sum", "count", "min", "max", "sd"]
    na_rm: bool = True


# CV schemes
class CVKFoldByChromosome(_Model):
    kind: Literal["k_fold_by_chromosome"] = "k_fold_by_chromosome"
    k: int
    seed: int


class CVKFoldRandom(_Model):
    kind: Literal["k_fold_random"] = "k_fold_random"
    k: int
    seed: int


class CVLeaveOneOut(_Model):
    kind: Literal["leave_one_out"] = "leave_one_out"


class CVStratifiedKFold(_Model):
    kind: Literal["stratified_k_fold"] = "stratified_k_fold"
    k: int
    by: str
    seed: int


CVScheme = Annotated[
    Union[CVKFoldByChromosome, CVKFoldRandom, CVLeaveOneOut, CVStratifiedKFold],
    Field(discriminator="kind"),
]


class EstimatorSpec(_Model):
    """A pinned, version-locked estimator implementation.

    `impl` uses namespace-prefixed conventions:
      - Python: "scipy.stats.spearmanr"       (implicit Python namespace)
      - Python explicit: "python::sklearn.ensemble.RandomForestClassifier"
      - R:      "R::ranger::ranger"
    """

    name: str
    impl: str
    version: str
    response: str | None = None
    features: FeatureSet | None = None
    params: dict = Field(default_factory=dict)


class NullModelSpec(_Model):
    kind: Literal["label_shuffle", "circular_shift", "parametric", "block_bootstrap"]
    n_perms: int | None = None
    seed: int | None = None
    params: dict = Field(default_factory=dict)


# Operation variants


class FilterOp(_Model):
    id: str
    kind: Literal["filter"] = "filter"
    inputs: list[str] = Field(min_length=1, max_length=1)
    predicate: SetExpression
    note: str | None = None


class ProjectOp(_Model):
    id: str
    kind: Literal["project"] = "project"
    inputs: list[str] = Field(min_length=1, max_length=1)
    cols: list[str]
    note: str | None = None


class JoinOp(_Model):
    id: str
    kind: Literal["join"] = "join"
    inputs: list[str] = Field(min_length=2, max_length=2)
    on: str
    note: str | None = None


class AggregateOp(_Model):
    id: str
    kind: Literal["aggregate"] = "aggregate"
    inputs: list[str] = Field(min_length=1, max_length=1)
    by: list[str]
    agg: list[Agg]
    note: str | None = None


class CVSplitOp(_Model):
    id: str
    kind: Literal["cv_split"] = "cv_split"
    inputs: list[str] = Field(min_length=1, max_length=1)
    scheme: CVScheme
    note: str | None = None


class EstimatorOp(_Model):
    id: str
    kind: Literal["estimator"] = "estimator"
    inputs: list[str] = Field(min_length=1)
    estimator: EstimatorSpec
    note: str | None = None


class NullModelOp(_Model):
    id: str
    kind: Literal["null_model"] = "null_model"
    inputs: list[str] = Field(min_length=1)
    spec: NullModelSpec
    note: str | None = None


class CorrectOp(_Model):
    id: str
    kind: Literal["correct"] = "correct"
    inputs: list[str] = Field(min_length=1, max_length=1)
    method: Literal["bh", "bonf", "perm", "knockoff"]
    note: str | None = None


Operation = Annotated[
    Union[
        FilterOp,
        ProjectOp,
        JoinOp,
        AggregateOp,
        CVSplitOp,
        EstimatorOp,
        NullModelOp,
        CorrectOp,
    ],
    Field(discriminator="kind"),
]


# ---------------------------------------------------------------------------
# Statistic
# ---------------------------------------------------------------------------


class LabeledValue(_Model):
    label: str
    value: float


StatValue = Union[
    float,
    int,
    str,
    list[float],
    list[int],
    list[str],
    list[LabeledValue],
]


class Statistic(_Model):
    id: str
    produced_by: str
    name: str
    value: StatValue
    ci: tuple[float, float] | None = None
    n: int | None = None
    evidence_class: EvidenceClass
    note: str | None = None


# ---------------------------------------------------------------------------
# Inference rule — recursive, discriminated on `kind`
# ---------------------------------------------------------------------------


class StatRef(_Model):
    stat_id: str
    transform: Literal["abs", "neg", "log"] | None = None


class InferenceAnd(_Model):
    kind: Literal["and"] = "and"
    terms: list["InferenceExpression"]


class InferenceOr(_Model):
    kind: Literal["or"] = "or"
    terms: list["InferenceExpression"]


class InferenceNot(_Model):
    kind: Literal["not"] = "not"
    term: "InferenceExpression"


class InferenceCmp(_Model):
    kind: Literal["cmp"] = "cmp"
    lhs: StatRef
    op: Literal["<", "<=", "=", "!=", ">", ">="]
    rhs: Union[float, int, StatRef]


InferenceExpression = Annotated[
    Union[InferenceAnd, InferenceOr, InferenceNot, InferenceCmp],
    Field(discriminator="kind"),
]


class InferenceRule(_Model):
    expression: InferenceExpression
    justification: str
    failure_mode: str | None = None


# ---------------------------------------------------------------------------
# Conclusion
# ---------------------------------------------------------------------------


class ScopeBlock(_Model):
    layers: list[LayerRef]
    restrictions: SetExpression | None = None
    scale_note: str | None = None


class Confidence(_Model):
    type: Literal["frequentist", "bayesian", "proof"]
    value: float | None = None
    note: str | None = None


class CompositeConfidence(_Model):
    procedure: Literal[
        "bootstrap", "permutation", "bayesian_posterior", "proof_certificate"
    ]
    impl: str
    n_resamples: int | None = None
    seed: int | None = None
    interval: tuple[float, float] | None = None
    prob_inference_holds: float | None = None
    note: str | None = None


class Conclusion(_Model):
    assertion: str
    formal: SetExpression | None = None
    scope: ScopeBlock
    confidence: Confidence
    composite_confidence: CompositeConfidence | None = None
    outcome: Outcome


# ---------------------------------------------------------------------------
# External assumptions + audits
# ---------------------------------------------------------------------------


class Audit(_Model):
    auditor: str
    verdict: Literal["endorse", "contest", "revise_confidence", "defer"]
    revised_confidence: float | None = None
    rationale: str
    timestamp: str


class ExternalAssumption(_Model):
    statement: str
    kind: Literal[
        "literature", "mechanistic", "design_choice", "training_data_not_in_api"
    ]
    citation: str | None = None
    confidence: float = Field(ge=0.0, le=1.0)
    audits: list[Audit] | None = None


# ---------------------------------------------------------------------------
# Root: FormalClaim
# ---------------------------------------------------------------------------


class FormalClaim(_Model):
    # JSON-Schema pointer (optional, used by editors)
    schema_ref: str | None = Field(default=None, alias="$schema")

    schema_version: Literal["v1.1"] = "v1.1"

    id: str
    exp_number: int | None = None
    title: str
    posted_at: str
    api_version: str
    data_version: str
    version: str

    premises: list[Premise]
    operations: list[Operation]
    statistics: list[Statistic]
    inference: InferenceRule
    conclusion: Conclusion

    depends_on: list[str] = Field(default_factory=list)
    external_assumptions: list[ExternalAssumption] = Field(default_factory=list)
    notebook: str | None = None


# ---------------------------------------------------------------------------
# Resolve forward refs
# ---------------------------------------------------------------------------

AndExpr.model_rebuild()
OrExpr.model_rebuild()
NotExpr.model_rebuild()
JoinExpr.model_rebuild()
InferenceAnd.model_rebuild()
InferenceOr.model_rebuild()
InferenceNot.model_rebuild()
Premise.model_rebuild()
FilterOp.model_rebuild()
ProjectOp.model_rebuild()
AggregateOp.model_rebuild()
CVSplitOp.model_rebuild()
EstimatorOp.model_rebuild()
NullModelOp.model_rebuild()
Conclusion.model_rebuild()
FormalClaim.model_rebuild()
