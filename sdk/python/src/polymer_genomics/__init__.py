"""Polymer Genomics — Python client for DNA biophysical properties and curated genomic reference data."""

from polymer_genomics.client import PolymerClient
from polymer_genomics.exceptions import (
    PolymerAPIError,
    PolymerAuthError,
    PolymerNotFoundError,
    PolymerRateLimitError,
    PolymerValidationError,
)

__all__ = [
    "PolymerClient",
    "PolymerAPIError",
    "PolymerAuthError",
    "PolymerNotFoundError",
    "PolymerRateLimitError",
    "PolymerValidationError",
]
__version__ = "0.1.0"
