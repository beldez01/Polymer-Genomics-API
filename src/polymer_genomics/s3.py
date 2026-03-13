"""Boto3 wrapper for S3 / MinIO presigned URL generation."""

import boto3
from botocore.config import Config

from polymer_genomics.config import settings

_s3_client = None
_s3_public_client = None


def get_s3_client():
    """Return a shared boto3 S3 client configured for MinIO compatibility."""
    global _s3_client
    if _s3_client is None:
        endpoint = settings.s3_endpoint if settings.s3_endpoint else None
        _s3_client = boto3.client(
            "s3",
            endpoint_url=endpoint,
            aws_access_key_id=settings.s3_access_key or None,
            aws_secret_access_key=settings.s3_secret_key or None,
            region_name=settings.s3_region,
            config=Config(signature_version="s3v4"),
        )
    return _s3_client


def _get_public_client():
    """Return an S3 client using the public endpoint (for presigned URLs)."""
    global _s3_public_client
    if _s3_public_client is None:
        public_endpoint = settings.s3_public_endpoint or settings.s3_endpoint or None
        _s3_public_client = boto3.client(
            "s3",
            endpoint_url=public_endpoint,
            aws_access_key_id=settings.s3_access_key or None,
            aws_secret_access_key=settings.s3_secret_key or None,
            region_name=settings.s3_region,
            config=Config(signature_version="s3v4"),
        )
    return _s3_public_client


def generate_presigned_url(bucket: str, key: str, expiry_seconds: int = 3600) -> str:
    """Generate a presigned GET URL for an S3/MinIO object.

    Uses s3_public_endpoint so URLs are reachable by external clients.
    This is a synchronous operation (just cryptographic signing, no network call).
    """
    client = _get_public_client()
    return client.generate_presigned_url(
        "get_object",
        Params={"Bucket": bucket, "Key": key},
        ExpiresIn=expiry_seconds,
    )
