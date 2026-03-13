"""Tests for PolymerClient."""

import json

import httpx
import pytest

from polymer_genomics import (
    PolymerClient,
    PolymerAPIError,
    PolymerAuthError,
    PolymerNotFoundError,
    PolymerRateLimitError,
    PolymerValidationError,
)


@pytest.fixture
def client():
    c = PolymerClient(api_key="pk_test_abc", base_url="https://test.example.com")
    yield c
    c.close()


# ── Construction ──────────────────────────────────────────────────


def test_default_base_url():
    c = PolymerClient()
    assert str(c._client.base_url).rstrip("/") == "https://api.polymerbio.org"
    c.close()


def test_api_key_header():
    c = PolymerClient(api_key="pk_live_xyz")
    assert c._client.headers["X-API-Key"] == "pk_live_xyz"
    c.close()


def test_no_api_key_no_header():
    c = PolymerClient()
    assert "X-API-Key" not in c._client.headers
    c.close()


def test_context_manager():
    with PolymerClient() as c:
        assert repr(c).startswith("PolymerClient(")


def test_repr(client):
    assert "test.example.com" in repr(client)


# ── Error handling ────────────────────────────────────────────────


def test_handle_error_401():
    resp = httpx.Response(401, json={"error": {"message": "bad key"}})
    with pytest.raises(PolymerAuthError, match="bad key"):
        PolymerClient._handle_error(resp)


def test_handle_error_403():
    resp = httpx.Response(403, json={"error": {"message": "forbidden"}})
    with pytest.raises(PolymerAuthError, match="forbidden"):
        PolymerClient._handle_error(resp)


def test_handle_error_404():
    resp = httpx.Response(404, json={"error": {"message": "not found"}})
    with pytest.raises(PolymerNotFoundError, match="not found"):
        PolymerClient._handle_error(resp)


def test_handle_error_422():
    resp = httpx.Response(422, json={"error": {"message": "invalid"}})
    with pytest.raises(PolymerValidationError, match="invalid"):
        PolymerClient._handle_error(resp)


def test_handle_error_429():
    resp = httpx.Response(429, json={"error": {"message": "slow down"}})
    with pytest.raises(PolymerRateLimitError, match="slow down"):
        PolymerClient._handle_error(resp)


def test_handle_error_500():
    resp = httpx.Response(500, json={"error": {"message": "server error"}})
    with pytest.raises(PolymerAPIError, match="server error"):
        PolymerClient._handle_error(resp)


def test_handle_error_non_json():
    resp = httpx.Response(502, text="Bad Gateway")
    with pytest.raises(PolymerAPIError, match="Bad Gateway"):
        PolymerClient._handle_error(resp)


def test_handle_error_2xx_passes():
    resp = httpx.Response(200, json={"ok": True})
    PolymerClient._handle_error(resp)  # should not raise


# ── Exception hierarchy ──────────────────────────────────────────


def test_all_exceptions_inherit_from_base():
    assert issubclass(PolymerAuthError, PolymerAPIError)
    assert issubclass(PolymerNotFoundError, PolymerAPIError)
    assert issubclass(PolymerValidationError, PolymerAPIError)
    assert issubclass(PolymerRateLimitError, PolymerAPIError)


def test_exception_has_status_code():
    err = PolymerAPIError(503, "unavailable")
    assert err.status_code == 503
    assert err.message == "unavailable"
    assert "503" in str(err)


# ── Request building (via httpx transport mock) ──────────────────


class _MockTransport(httpx.BaseTransport):
    """Records requests and returns canned responses."""

    def __init__(self, response_json=None, status=200):
        self._response_json = response_json or {}
        self._status = status
        self.last_request = None

    def handle_request(self, request):
        self.last_request = request
        return httpx.Response(
            self._status,
            json=self._response_json,
            request=request,
        )


def _mock_client(response_json=None, status=200):
    transport = _MockTransport(response_json or {}, status)
    c = PolymerClient(api_key="pk_test_123", base_url="https://mock.api")
    c._client = httpx.Client(
        base_url="https://mock.api",
        headers={"X-API-Key": "pk_test_123"},
        transport=transport,
    )
    return c, transport


def test_evaluate_sends_post():
    c, t = _mock_client({"summary": {}})
    c.evaluate("ATGC", name="test", analysis="thermodynamic")
    assert t.last_request.method == "POST"
    assert "/v1/evaluate" in str(t.last_request.url)
    body = json.loads(t.last_request.content)
    assert body["sequence"] == "ATGC"
    assert body["name"] == "test"
    c.close()


def test_compare_sends_post():
    c, t = _mock_client({"comparison": {}})
    c.compare({"wt": "ATGC", "mut": "ATGG"})
    assert t.last_request.method == "POST"
    assert "/v1/compare" in str(t.last_request.url)
    c.close()


def test_gene_sends_get():
    c, t = _mock_client({"gene": "TP53"})
    c.gene("hg38", "TP53")
    assert t.last_request.method == "GET"
    assert "/v1/genes/hg38/TP53" in str(t.last_request.url)
    c.close()


def test_region_with_layers():
    c, t = _mock_client({"features": []})
    c.region("hg38", "chr17:7668402-7687550", layers=["cpg_islands", "genes"])
    url = str(t.last_request.url)
    assert "/v1/regions/hg38/chr17" in url
    assert "layers=cpg_islands%2Cgenes" in url or "layers=cpg_islands,genes" in url
    c.close()


def test_probe_sends_get():
    c, t = _mock_client({"probe_id": "cg00000029"})
    c.probe("hg38", "cg00000029")
    assert "/v1/probes/hg38/cg00000029" in str(t.last_request.url)
    c.close()


def test_batch_probes_sends_post():
    c, t = _mock_client({"probes": []})
    c.batch_probes("hg38", ["cg00000029", "cg00000108"])
    assert t.last_request.method == "POST"
    body = json.loads(t.last_request.content)
    assert len(body["probe_ids"]) == 2
    c.close()


def test_search():
    c, t = _mock_client({"results": []})
    c.search("BRC", build="hg38")
    url = str(t.last_request.url)
    assert "q=BRC" in url
    c.close()


def test_correlate():
    c, t = _mock_client({"r": 0.5})
    c.correlate("hg38", "chr1:1-100000", "cpg_islands", "genes", method="spearman")
    url = str(t.last_request.url)
    assert "method=spearman" in url
    c.close()


def test_intersect_sends_post():
    c, t = _mock_client({"positions": []})
    c.intersect("hg38", "chr1:1-100000", filters=[{"layer": "cpg_islands", "op": "overlaps"}])
    assert t.last_request.method == "POST"
    body = json.loads(t.last_request.content)
    assert body["build"] == "hg38"
    assert len(body["filters"]) == 1
    c.close()
