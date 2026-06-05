import numpy as np
from manifold.projection import ManifoldModel, project_node, _align


def _toy_model():
    rng = np.random.default_rng(0)
    cluster_a = rng.normal([0.0, 0.0], 0.05, size=(50, 2))
    cluster_b = rng.normal([10.0, 10.0], 0.05, size=(50, 2))
    pcs = np.vstack([cluster_a, cluster_b])
    genes = ["g0", "g1"]
    model = ManifoldModel(
        genes=genes,
        mean_=np.zeros(2),
        components_=np.eye(2),
        cell_pcs=pcs,
        cell_xy=pcs.copy(),
        cell_diff_potential=np.concatenate([np.full(50, 0.9), np.full(50, 0.1)]),
        cell_pseudotime=np.concatenate([np.full(50, 0.0), np.full(50, 1.0)]),
        cell_density=np.ones(100),
    )
    return model, genes


def test_node_lands_near_matching_cluster():
    model, genes = _toy_model()
    proj = project_node(np.array([0.1, 0.1]), genes, model, k=10)
    assert abs(proj.x - 0.0) < 1.0 and abs(proj.y - 0.0) < 1.0
    assert proj.diff_potential > 0.7
    assert proj.pseudotime < 0.2


def test_confidence_is_worse_for_off_manifold_node():
    model, genes = _toy_model()
    near = project_node(np.array([0.0, 0.0]), genes, model, k=10)
    far = project_node(np.array([100.0, 100.0]), genes, model, k=10)
    assert far.mean_neighbor_distance > near.mean_neighbor_distance


def test_align_reorders_to_model_gene_order():
    out = _align(np.array([0.1, 10.0]), ["g1", "g0"], ["g0", "g1"])
    assert np.allclose(out, [10.0, 0.1])  # g0<-10.0, g1<-0.1


def test_align_missing_gene_is_zero():
    out = _align(np.array([5.0]), ["g0"], ["g0", "g1"])
    assert np.allclose(out, [5.0, 0.0])  # g1 absent in bulk -> 0
