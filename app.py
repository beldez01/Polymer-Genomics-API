"""Vercel entrypoint — re-exports the FastAPI app from the installed package."""
from polymer_genomics.main import app  # noqa: F401
