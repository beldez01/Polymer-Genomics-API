

async def test_probe_lookup_basic(client, seed_probe_data):
    resp = await client.get("/v1/probes/hg38/cg08796240")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "complete"
    assert body["coordinate_system"] == "1-based_closed"
    assert body["data"]["probe"]["probe_id"] == "cg08796240"


async def test_probe_lookup_coordinate_convention(client, seed_probe_data):
    """Probe at pos=70699929 (0-based) -> API start=70699930, end=70699930, width=1."""
    resp = await client.get("/v1/probes/hg38/cg08796240")
    body = resp.json()
    probe = body["data"]["probe"]
    assert probe["start"] == 70699930
    assert probe["end"] == 70699930
    assert probe["width"] == 1


async def test_probe_lookup_metadata(client, seed_probe_data):
    """Probe should include gene_symbol and cpg_context."""
    resp = await client.get("/v1/probes/hg38/cg08796240")
    body = resp.json()
    probe = body["data"]["probe"]
    assert probe["gene_symbol"] == "VAC14"
    assert probe["cpg_context"] == "island"
    assert probe["seqname"] == "chr16"


async def test_probe_crossmap(client, seed_probe_data):
    """Probe lookup should include crossmap edges."""
    resp = await client.get("/v1/probes/hg38/cg08796240")
    body = resp.json()
    crossmap = body["data"]["crossmap"]
    assert len(crossmap) == 1
    assert crossmap[0]["dst_platform"] == "epic_v1"
    assert crossmap[0]["dst_probe_id"] == "cg08796240"
    assert crossmap[0]["method"] == "exact_id"
    assert crossmap[0]["confidence"] == 1.0


async def test_probe_no_crossmap(client, seed_probe_data):
    """Probe without crossmap edges should return empty list."""
    resp = await client.get("/v1/probes/hg38/cg14514483")
    body = resp.json()
    assert body["data"]["crossmap"] == []


async def test_probe_not_found(client, seed_layers):
    resp = await client.get("/v1/probes/hg38/cg99999999")
    assert resp.status_code == 404
    assert resp.json()["detail"]["error"]["code"] == "NOT_FOUND"


async def test_probe_invalid_build(client):
    resp = await client.get("/v1/probes/hg99/cg08796240")
    assert resp.status_code == 400
    assert resp.json()["detail"]["error"]["code"] == "BUILD_MISMATCH"


async def test_probe_query_echo(client, seed_probe_data):
    resp = await client.get("/v1/probes/hg38/cg08796240")
    body = resp.json()
    assert body["query"]["build"] == "hg38"
    assert body["query"]["probe_id"] == "cg08796240"


# --- Batch endpoint ---


async def test_probe_batch_basic(client, seed_probe_data):
    resp = await client.post(
        "/v1/probes/hg38/batch",
        json={"probe_ids": ["cg08796240", "cg14514483"]},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "complete"
    assert body["data"]["class"] == "GRanges"
    assert body["data"]["n"] == 2


async def test_probe_batch_all_three(client, seed_probe_data):
    resp = await client.post(
        "/v1/probes/hg38/batch",
        json={"probe_ids": ["cg08796240", "cg14514483", "cg27457201"]},
    )
    body = resp.json()
    assert body["data"]["n"] == 3
    # Should be ordered by chr_id, pos
    assert body["data"]["mcols"]["probe_id"] == ["cg08796240", "cg14514483", "cg27457201"]


async def test_probe_batch_coordinate_convention(client, seed_probe_data):
    """Batch probe coordinates should also be 1-based closed."""
    resp = await client.post(
        "/v1/probes/hg38/batch",
        json={"probe_ids": ["cg08796240"]},
    )
    body = resp.json()
    assert body["data"]["ranges"]["start"][0] == 70699930
    assert body["data"]["ranges"]["end"][0] == 70699930
    assert body["data"]["ranges"]["width"][0] == 1


async def test_probe_batch_partial_match(client, seed_probe_data):
    """Non-existent probes should be silently omitted."""
    resp = await client.post(
        "/v1/probes/hg38/batch",
        json={"probe_ids": ["cg08796240", "cg99999999"]},
    )
    body = resp.json()
    assert body["data"]["n"] == 1


async def test_probe_batch_empty(client, seed_probe_data):
    """Empty probe_ids list should return 400."""
    resp = await client.post(
        "/v1/probes/hg38/batch",
        json={"probe_ids": []},
    )
    assert resp.status_code == 400


async def test_probe_batch_too_many(client, seed_probe_data):
    """More than 10K probe IDs should return 400."""
    resp = await client.post(
        "/v1/probes/hg38/batch",
        json={"probe_ids": [f"cg{i:08d}" for i in range(10001)]},
    )
    assert resp.status_code == 400
    assert resp.json()["detail"]["error"]["code"] == "BATCH_TOO_LARGE"


async def test_probe_batch_invalid_build(client):
    resp = await client.post(
        "/v1/probes/hg99/batch",
        json={"probe_ids": ["cg08796240"]},
    )
    assert resp.status_code == 400
    assert resp.json()["detail"]["error"]["code"] == "BUILD_MISMATCH"
