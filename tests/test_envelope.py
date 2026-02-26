from polymer_genomics.envelope import build_envelope


def test_complete_envelope():
    env = build_envelope(
        status="complete",
        query={"build": "hg38", "region": {"chr": "chr16", "start": 70699930, "end": 70700000}},
        layers_resolved=[{"layer_key": "cpg_sites", "version": "1.0"}],
        data={"cpg_sites": []},
    )
    assert env["status"] == "complete"
    assert env["coordinate_system"] == "1-based_closed"
    assert "query" in env
    assert "layers_resolved" in env
    assert "timing" in env


def test_partial_envelope():
    env = build_envelope(
        status="partial",
        query={"build": "hg38"},
        layers_resolved=[
            {"layer_key": "cpg_sites", "version": "1.0", "status": "ok"},
            {"layer_key": "meth_monocyte", "version": "1.0", "status": "timeout"},
        ],
        data={"cpg_sites": [], "meth_monocyte": None},
    )
    assert env["status"] == "partial"
    assert len(env["layers_resolved"]) == 2


def test_paginated_envelope():
    env = build_envelope(
        status="paginated",
        query={"build": "hg38"},
        layers_resolved=[],
        data={},
        pagination={"cursor": "abc123", "has_more": True, "total_estimate": 50000},
    )
    assert env["status"] == "paginated"
    assert env["pagination"]["cursor"] == "abc123"
    assert env["pagination"]["has_more"] is True


def test_envelope_no_pagination_key_when_none():
    env = build_envelope(
        status="complete",
        query={},
        layers_resolved=[],
        data={},
    )
    assert "pagination" not in env
