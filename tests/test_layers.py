

async def test_list_layers_returns_valid_response(client):
    resp = await client.get("/v1/layers")
    assert resp.status_code == 200
    body = resp.json()
    assert "layers" in body
    assert isinstance(body["layers"], list)


async def test_list_layers_filtered_by_type(client, seed_layers):
    resp = await client.get("/v1/layers?type=probe&build=hg38")
    assert resp.status_code == 200
    layers = resp.json()["layers"]
    assert len(layers) >= 1
    assert all(l["type"] == "probe" for l in layers)


async def test_list_layers_filtered_by_build(client, seed_layers):
    resp = await client.get("/v1/layers?build=hg38")
    assert resp.status_code == 200
    layers = resp.json()["layers"]
    assert len(layers) >= 2  # both seeded layers are hg38


async def test_get_layer_by_key(client, seed_layers):
    resp = await client.get("/v1/layers/probe_epic_v2")
    assert resp.status_code == 200
    body = resp.json()
    assert body["layer_key"] == "probe_epic_v2"
    assert body["version"] == "1.0"
    assert body["type"] == "probe"
    assert body["build"] == "hg38"


async def test_get_layer_not_found(client):
    resp = await client.get("/v1/layers/nonexistent")
    assert resp.status_code == 404


async def test_get_layer_includes_epistemic_fields(client, seed_layers):
    resp = await client.get("/v1/layers/probe_epic_v2")
    assert resp.status_code == 200
    body = resp.json()
    for field in ("evidence_class", "tier", "equilibrium_regime", "statefulness",
                  "validation_status", "interpretability", "is_composite"):
        assert field in body, f"Missing epistemic field: {field}"


async def test_list_layers_includes_epistemic_fields(client, seed_layers):
    resp = await client.get("/v1/layers?build=hg38")
    assert resp.status_code == 200
    layers = resp.json()["layers"]
    assert len(layers) >= 1
    for layer in layers:
        assert "evidence_class" in layer


async def test_list_layers_filter_by_evidence_class(client, seed_layers):
    resp = await client.get("/v1/layers?build=hg38&evidence_class=D")
    assert resp.status_code == 200
    layers = resp.json()["layers"]
    # Should have at least probe_epic_v2 and cpg_sites (both are D class)
    registry_layers = [l for l in layers if l.get("evidence_class") is not None]
    assert len(registry_layers) >= 2
    for layer in registry_layers:
        assert layer["evidence_class"] == "D"


async def test_list_layers_filter_by_tier(client, seed_layers):
    resp = await client.get("/v1/layers?build=hg38&tier=intrinsic")
    assert resp.status_code == 200
    layers = resp.json()["layers"]
    registry_layers = [l for l in layers if l.get("tier") is not None]
    assert len(registry_layers) >= 1
    for layer in registry_layers:
        assert layer["tier"] == "intrinsic"
