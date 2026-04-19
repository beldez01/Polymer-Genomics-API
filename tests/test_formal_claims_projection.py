"""Acceptance tests for the FormalClaim projection pipeline.

Runs the full pipeline (load -> features -> PCA -> artifact write) on the live
30-claim corpus under internal/InSilico/**/claims/ and asserts deterministic,
well-formed output.

If a test fails after a fixture is added or removed, update the count
constants below first.
"""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pytest

from polymer_genomics.formal_claims.feature_extractor import (
    FEATURE_DIM,
    FEATURE_NAMES,
    OUTCOMES,
    build_feature_matrix,
    extract_features,
    load_all_formal_claims,
)
from polymer_genomics.formal_claims.projection import project

EXPECTED_N_CLAIMS = 30
EXPECTED_TOPIC_COUNTS = {
    "HLA experiment": 10,
    "TE surveillance": 8,
    "recombination hotspots": 6,
    "dual_channel": 5,
    "RC": 1,
}
EXPECTED_DEPENDS_ON_EDGES = 7  # see CONTINUATION.md


@pytest.fixture(scope="module")
def loaded():
    """Load all 30 claims once per test module run."""
    claims, topics = load_all_formal_claims()
    outcomes = {cid: c.conclusion.outcome for cid, c in claims.items()}
    depends_on = {
        cid: list(c.depends_on) for cid, c in claims.items() if c.depends_on
    }
    return claims, topics, outcomes, depends_on


@pytest.fixture(scope="module")
def feature_matrix(loaded):
    claims, topics, _outcomes, _depends_on = loaded
    return build_feature_matrix(claims, topics)


@pytest.fixture(scope="module")
def projection_result(loaded, feature_matrix):
    claims, topics, outcomes, depends_on = loaded
    ids, X, names = feature_matrix
    return project(
        ids=ids,
        X=X,
        feature_names=names,
        topics=topics,
        outcomes=outcomes,
        depends_on=depends_on,
        random_state=0,
    )


def test_loads_all_30_fixtures(loaded):
    claims, topics, _outcomes, _depends_on = loaded
    assert len(claims) == EXPECTED_N_CLAIMS
    counts: dict[str, int] = {}
    for t in topics.values():
        counts[t] = counts.get(t, 0) + 1
    assert counts == EXPECTED_TOPIC_COUNTS


def test_feature_matrix_shape(feature_matrix):
    ids, X, names = feature_matrix
    assert X.shape == (EXPECTED_N_CLAIMS, FEATURE_DIM)
    assert len(ids) == EXPECTED_N_CLAIMS
    assert len(names) == FEATURE_DIM
    assert names == list(FEATURE_NAMES)
    assert np.all(np.isfinite(X))


def test_feature_extractor_deterministic(loaded):
    """Re-running the extractor on the same claim must produce identical bytes."""
    claims, topics, _outcomes, _depends_on = loaded
    cid = next(iter(claims))
    v1 = extract_features(claims[cid], topic=topics[cid])
    v2 = extract_features(claims[cid], topic=topics[cid])
    assert np.array_equal(v1, v2)


def test_pca_deterministic(loaded, feature_matrix):
    """Two pipeline runs must produce identical 3D coords."""
    claims, topics, outcomes, depends_on = loaded
    ids, X, names = feature_matrix
    r1 = project(ids, X, names, topics, outcomes, depends_on, random_state=0)
    r2 = project(ids, X, names, topics, outcomes, depends_on, random_state=0)
    assert np.array_equal(r1.coords_3d, r2.coords_3d)
    assert r1.explained_variance == r2.explained_variance
    assert r1.depends_on_distance_summary == r2.depends_on_distance_summary


def test_explained_variance_monotone_non_increasing(projection_result):
    evr = projection_result.explained_variance
    assert len(evr) == 3
    assert evr[0] >= evr[1] >= evr[2]
    # PCA on standardized data — total cumulative ratio over 3 PCs must be in (0, 1].
    assert 0.0 < sum(evr) <= 1.0


def test_outcome_one_hot_sums_to_one(loaded):
    """Every claim has exactly one outcome — the one-hot block must sum to 1.0."""
    claims, topics, _outcomes, _depends_on = loaded
    for cid in claims:
        v = extract_features(claims[cid], topic=topics[cid])
        outcome_block = v[: len(OUTCOMES)]
        assert outcome_block.sum() == pytest.approx(1.0)


def test_depends_on_distance_summary_has_seven_edges(projection_result):
    summary = projection_result.depends_on_distance_summary
    assert summary["n_edges"] == EXPECTED_DEPENDS_ON_EDGES
    assert summary["n_perm"] == 1000
    assert summary["mean_observed"] is not None
    assert summary["mean_null"] is not None
    assert 0.0 <= summary["p_value"] <= 1.0


def test_artifact_round_trip(tmp_path, loaded, feature_matrix):
    """Build script -> write to tmp -> reload -> coords match the projection result."""
    from scripts.build_formal_claim_projection import (  # type: ignore[import-not-found]
        build_artifact,
        write_json_deterministic,
    )

    claims, topics, outcomes, depends_on = loaded
    ids, X, names = feature_matrix
    result = project(ids, X, names, topics, outcomes, depends_on, random_state=0)
    artifact = build_artifact(result, topics, outcomes, depends_on)
    out_path = tmp_path / "round_trip.json"
    write_json_deterministic(out_path, artifact)

    reloaded = json.loads(out_path.read_text(encoding="utf-8"))
    assert reloaded["n_claims"] == EXPECTED_N_CLAIMS
    assert len(reloaded["claims"]) == EXPECTED_N_CLAIMS
    # Coords match (modulo COORD_DECIMALS rounding).
    by_id = {c["id"]: c for c in reloaded["claims"]}
    for i, cid in enumerate(result.ids):
        coord_in = result.coords_3d[i]
        coord_out = by_id[cid]["projection_3d"]
        assert len(coord_out) == 3
        np.testing.assert_allclose(coord_in, coord_out, atol=1e-5)


def test_silhouette_by_topic_excludes_singleton_classes(projection_result):
    """RC has only 1 fixture; topic silhouette must still be computable on the rest."""
    sil = projection_result.silhouette_by_topic
    assert sil is not None, "Singleton-class exclusion should leave 4 topics ≥ 2 each"
    assert -1.0 <= sil <= 1.0


def test_dropped_zero_variance_features_includes_outcome_fail(projection_result):
    """`outcome::fail` is unused in the active corpus — should be in dropped list."""
    assert "outcome::fail" in projection_result.dropped_zero_variance_features


def test_repo_artifact_is_byte_deterministic_after_make_projection():
    """The committed artifact at internal/InSilico/projection/ should match a fresh build."""
    import subprocess

    repo_root = Path(__file__).resolve().parents[1]
    artifact_path = (
        repo_root / "internal" / "InSilico" / "projection" / "formal_claim_projection_v1.json"
    )
    if not artifact_path.exists():
        pytest.skip("Artifact not yet built; run `make projection` first.")

    before = artifact_path.read_bytes()
    subprocess.run(
        ["uv", "run", "python", "scripts/build_formal_claim_projection.py"],
        check=True,
        cwd=repo_root,
        capture_output=True,
    )
    after = artifact_path.read_bytes()
    assert before == after, "make projection produced non-deterministic output"
