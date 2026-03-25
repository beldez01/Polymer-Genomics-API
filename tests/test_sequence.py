"""Tests for the sequence endpoint (GET /v1/sequence/{build}/{region})."""

from unittest.mock import patch


MOCK_SEQUENCE = "ATCGATCGATCG"


def _mock_get_sequence(build, chr_name, start, end):
    """Return a deterministic mock sequence of the requested length."""
    length = end - start
    # Tile the mock pattern to fill the requested length
    full = (MOCK_SEQUENCE * ((length // len(MOCK_SEQUENCE)) + 1))[:length]
    return full


def _mock_get_sequence_file_not_found(build, chr_name, start, end):
    raise FileNotFoundError(f"Reference FASTA not found: data/{build}.fa")


def _mock_get_sequence_key_error(build, chr_name, start, end):
    raise KeyError(f"Chromosome {chr_name} not found in FASTA")


# ---------------------------------------------------------------------------
# Happy-path tests
# ---------------------------------------------------------------------------


@patch("polymer_genomics.routers.sequence.get_sequence", side_effect=_mock_get_sequence)
async def test_sequence_basic(mock_fn, client):
    """Valid region returns sequence with correct response structure."""
    resp = await client.get("/v1/sequence/hg38/chr16:70699930-70700000")
    assert resp.status_code == 200
    body = resp.json()
    data = body["data"]

    assert data["build"] == "hg38"
    assert data["chr"] == "chr16"
    assert data["start"] == 70699930
    assert data["end"] == 70700000
    assert body["coordinate_system"] == "1-based_closed"
    assert data["length"] == 71  # 1-based closed: 70700000 - 70699930 + 1 = 71
    assert len(data["sequence"]) == 71
    assert "timing" in body
    assert "query_time_ms" in body["timing"]


@patch("polymer_genomics.routers.sequence.get_sequence", side_effect=_mock_get_sequence)
async def test_sequence_response_fields(mock_fn, client):
    """All expected response fields are present."""
    resp = await client.get("/v1/sequence/hg38/chr1:100-200")
    body = resp.json()
    expected_keys = {"api_version", "data_version", "coordinate_system", "data", "timing"}
    assert expected_keys == set(body.keys())
    assert {"build", "chr", "start", "end", "length", "sequence"} <= set(body["data"].keys())


@patch("polymer_genomics.routers.sequence.get_sequence", side_effect=_mock_get_sequence)
async def test_sequence_0based_coords(mock_fn, client):
    """0-based coordinate input should work and return the same 1-based output."""
    resp = await client.get("/v1/sequence/hg38/chr1:99-200?coords=0based")
    assert resp.status_code == 200
    body = resp.json()
    data = body["data"]
    # Input echoed back as-is (user's coordinates)
    assert data["start"] == 99
    assert data["end"] == 200
    assert body["coordinate_system"] == "1-based_closed"
    # Length: 0-based [99, 200) = 101 bases
    assert data["length"] == 101


@patch("polymer_genomics.routers.sequence.get_sequence", side_effect=_mock_get_sequence)
async def test_sequence_coordinate_conversion(mock_fn, client):
    """1-based chr1:100-200 and 0-based chr1:99-200 produce the same internal range."""
    resp_1 = await client.get("/v1/sequence/hg38/chr1:100-200?coords=1based")
    resp_0 = await client.get("/v1/sequence/hg38/chr1:99-200?coords=0based")
    assert resp_1.status_code == 200
    assert resp_0.status_code == 200
    # Both should request the same internal range [99, 200) = 101 bases
    assert resp_1.json()["data"]["length"] == resp_0.json()["data"]["length"]


@patch("polymer_genomics.routers.sequence.get_sequence", side_effect=_mock_get_sequence)
async def test_sequence_single_base(mock_fn, client):
    """Requesting a single base (1-based: start==end) should return length 1."""
    resp = await client.get("/v1/sequence/hg38/chr1:100-100")
    assert resp.status_code == 200
    body = resp.json()
    assert body["data"]["length"] == 1
    assert len(body["data"]["sequence"]) == 1


# ---------------------------------------------------------------------------
# Validation / error tests
# ---------------------------------------------------------------------------


async def test_sequence_invalid_build(client):
    """Invalid build returns 400 with BUILD_MISMATCH code."""
    resp = await client.get("/v1/sequence/hg99/chr1:1-1000")
    assert resp.status_code == 400
    assert resp.json()["detail"]["error"]["code"] == "BUILD_MISMATCH"


async def test_sequence_invalid_region_format(client):
    """Malformed region string returns 400 with INVALID_REGION code."""
    resp = await client.get("/v1/sequence/hg38/notaregion")
    assert resp.status_code == 400
    assert resp.json()["detail"]["error"]["code"] == "INVALID_REGION"


async def test_sequence_unknown_chromosome(client):
    """Unknown chromosome returns 400 with INVALID_CHROMOSOME code."""
    resp = await client.get("/v1/sequence/hg38/chr99:1-1000")
    assert resp.status_code == 400
    assert resp.json()["detail"]["error"]["code"] == "INVALID_CHROMOSOME"


@patch("polymer_genomics.routers.sequence.get_sequence", side_effect=_mock_get_sequence)
async def test_sequence_region_too_large(mock_fn, client):
    """Region exceeding 100 kb returns 400 with REGION_TOO_LARGE code."""
    resp = await client.get("/v1/sequence/hg38/chr1:1-200001")
    assert resp.status_code == 400
    assert resp.json()["detail"]["error"]["code"] == "REGION_TOO_LARGE"


async def test_sequence_zero_length_region(client):
    """Region where start > end (after coordinate conversion) returns 400."""
    # 1-based: start=200, end=100 → internal start=199, end=100 → length=-99
    resp = await client.get("/v1/sequence/hg38/chr1:200-100")
    assert resp.status_code == 400
    assert resp.json()["detail"]["error"]["code"] == "INVALID_REGION"


@patch(
    "polymer_genomics.routers.sequence.get_sequence",
    side_effect=_mock_get_sequence_file_not_found,
)
async def test_sequence_fasta_unavailable(mock_fn, client):
    """Missing FASTA file returns 503 with FASTA_UNAVAILABLE code."""
    resp = await client.get("/v1/sequence/hg38/chr1:1-100")
    assert resp.status_code == 503
    assert resp.json()["detail"]["error"]["code"] == "FASTA_UNAVAILABLE"


@patch(
    "polymer_genomics.routers.sequence.get_sequence",
    side_effect=_mock_get_sequence_key_error,
)
async def test_sequence_key_error(mock_fn, client):
    """KeyError from pyfaidx (e.g., chr not in FASTA) returns 400 with SEQUENCE_ERROR."""
    resp = await client.get("/v1/sequence/hg38/chr1:1-100")
    assert resp.status_code == 400
    assert resp.json()["detail"]["error"]["code"] == "SEQUENCE_ERROR"


@patch("polymer_genomics.routers.sequence.get_sequence", side_effect=_mock_get_sequence)
async def test_sequence_max_boundary(mock_fn, client):
    """Exactly 100,000 bp request should succeed."""
    resp = await client.get("/v1/sequence/hg38/chr1:1-100000")
    assert resp.status_code == 200
    body = resp.json()
    assert body["data"]["length"] == 100000


@patch("polymer_genomics.routers.sequence.get_sequence", side_effect=_mock_get_sequence)
async def test_sequence_just_over_max(mock_fn, client):
    """100,001 bp request should fail."""
    resp = await client.get("/v1/sequence/hg38/chr1:1-100001")
    assert resp.status_code == 400
    assert resp.json()["detail"]["error"]["code"] == "REGION_TOO_LARGE"
