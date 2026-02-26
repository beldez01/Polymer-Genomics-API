"""Boto3 wrapper for S3 / MinIO presigned URL generation."""

import boto3
from botocore.config import Config

from polymer_genomics.config import settings


def _get_s3_client():
    """Create a boto3 S3 client configured for MinIO compatibility."""
    return boto3.client(
        "s3",
        endpoint_url=settings.s3_endpoint,
        aws_access_key_id=settings.s3_access_key,
        aws_secret_access_key=settings.s3_secret_key,
        region_name=settings.s3_region,
        config=Config(signature_version="s3v4"),
    )


def generate_presigned_url(bucket: str, key: str, expiry_seconds: int = 3600) -> str:
    """Generate a presigned GET URL for an S3/MinIO object.

    This is a synchronous operation (just cryptographic signing, no network call).
    """
    client = _get_s3_client()
    return client.generate_presigned_url(
        "get_object",
        Params={"Bucket": bucket, "Key": key},
        ExpiresIn=expiry_seconds,
    )
