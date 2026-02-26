

async def test_list_layers_empty(client):
    resp = await client.get("/v1/layers")
    assert resp.status_code == 200
    body = resp.json()
    assert body["layers"] == []


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
