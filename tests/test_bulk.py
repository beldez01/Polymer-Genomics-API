"""Tests for the bulk download endpoint (GET /v1/bulk/{layer_key})."""

from unittest.mock import patch

import boto3
import pytest
from botocore.config import Config

from tests.conftest import _admin_connect

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
async def seed_storage_object(seed_layers):
    """Upload a test file to MinIO, insert storage.objects row, and clean up."""
    conn = await _admin_connect()

    layer = await conn.fetchrow(
        "SELECT id, layer_key FROM registry.layers WHERE layer_key = 'probe_epic_v2'"
    )
    layer_id = layer["id"]
    bucket = "polymer-genomics-api"
    key = "test/probe_epic_v2.parquet"
    test_content = b"fake parquet content for testing"

    # Upload to MinIO
    s3 = boto3.client(
        "s3",
        endpoint_url="http://localhost:9000",
        aws_access_key_id="minioadmin",
        aws_secret_access_key="minioadmin",
        region_name="us-east-1",
        config=Config(signature_version="s3v4"),
    )

    # Ensure bucket exists
    try:
        s3.head_bucket(Bucket=bucket)
    except Exception:
        s3.create_bucket(Bucket=bucket)

    s3.put_object(Bucket=bucket, Key=key, Body=test_content)

    # Insert storage.objects row
    await conn.execute(
        """
        INSERT INTO storage.objects
            (layer_id, provider, bucket, key, region,
             content_hash, size_bytes, file_type, description)
        VALUES
            ($1, 'aws_s3', $2, $3, 'us-east-1', 'sha256:abc123', $4, 'parquet', 'test data')
        """,
        layer_id,
        bucket,
        key,
        len(test_content),
    )
    await conn.close()

    yield {
        "layer_id": layer_id,
        "layer_key": "probe_epic_v2",
        "bucket": bucket,
        "key": key,
        "content": test_content,
    }

    # Cleanup
    conn = await _admin_connect()
    await conn.execute("DELETE FROM storage.objects WHERE layer_id = $1", layer_id)
    await conn.close()

    try:
        s3.delete_object(Bucket=bucket, Key=key)
    except Exception:
        pass


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


async def test_bulk_layer_not_found(client):
    """GET /v1/bulk/nonexistent -> 404 LAYER_NOT_FOUND."""
    resp = await client.get("/v1/bulk/nonexistent_layer")
    assert resp.status_code == 404
    assert resp.json()["detail"]["error"]["code"] == "LAYER_NOT_FOUND"


async def test_bulk_no_storage_object(client, seed_layers):
    """Layer exists but no storage.objects row -> 404 NO_BULK_DATA."""
    resp = await client.get("/v1/bulk/probe_epic_v2")
    assert resp.status_code == 404
    assert resp.json()["detail"]["error"]["code"] == "NO_BULK_DATA"


async def test_bulk_presigned_url_mocked(client, seed_layers):
    """Unit test with mocked S3 — verifies response shape without MinIO."""
    # Insert a storage.objects row without actually uploading to MinIO
    conn = await _admin_connect()
    layer_id = await conn.fetchval(
        "SELECT id FROM registry.layers WHERE layer_key = 'probe_epic_v2'"
    )
    await conn.execute(
        """
        INSERT INTO storage.objects
            (layer_id, provider, bucket, key, region, content_hash, size_bytes, file_type)
        VALUES
            ($1, 'aws_s3', 'test-bucket', 'test/file.parquet', 'us-east-1',
             'sha256:mock123', 42000, 'parquet')
        """,
        layer_id,
    )
    await conn.close()

    try:
        mock_url = "https://mock-s3.example.com/test-bucket/test/file.parquet?signed=yes"
        with patch(
            "polymer_genomics.routers.bulk.generate_presigned_url", return_value=mock_url
        ):
            resp = await client.get("/v1/bulk/probe_epic_v2")
            assert resp.status_code == 200
            body = resp.json()
            assert body["layer_key"] == "probe_epic_v2"
            assert body["version"] == "1.0"
            assert body["content_hash"] == "sha256:mock123"
            assert body["size_bytes"] == 42000
            assert body["file_type"] == "parquet"
            assert body["download_url"] == mock_url
            assert body["expires_in_seconds"] == 3600
    finally:
        conn = await _admin_connect()
        await conn.execute("DELETE FROM storage.objects WHERE layer_id = $1", layer_id)
        await conn.close()


async def test_bulk_presigned_url_minio_roundtrip(client, seed_storage_object):
    """Integration test: presigned URL from real MinIO, then fetch the file."""
    import httpx

    info = seed_storage_object

    resp = await client.get(f"/v1/bulk/{info['layer_key']}")
    assert resp.status_code == 200
    body = resp.json()
    assert body["layer_key"] == "probe_epic_v2"
    assert body["version"] == "1.0"
    assert body["content_hash"] == "sha256:abc123"
    assert body["size_bytes"] == len(info["content"])
    assert body["file_type"] == "parquet"
    assert body["expires_in_seconds"] == 3600

    # The presigned URL should be a valid URL containing our bucket and key
    url = body["download_url"]
    assert info["bucket"] in url
    assert "probe_epic_v2" in url

    # Actually fetch the presigned URL to verify it works
    async with httpx.AsyncClient() as http:
        download_resp = await http.get(url)
        assert download_resp.status_code == 200
        assert download_resp.content == info["content"]
