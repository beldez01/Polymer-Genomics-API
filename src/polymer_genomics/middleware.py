"""Simple API key middleware for personal deployment.

Checks for a valid API key in the ``X-API-Key`` header or ``api_key``
query parameter.  When ``POLYMER_API_KEY`` is not set (local dev), all
requests are allowed through.

This is intentionally simple — a single static key for personal use.
Replace with OAuth2 / JWT when you have real multi-user needs.
"""

from __future__ import annotations

import os
import secrets

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

# Paths that never require authentication.
PUBLIC_PATHS = frozenset({
    "/health",
    "/docs",
    "/openapi.json",
    "/redoc",
})


class APIKeyMiddleware(BaseHTTPMiddleware):
    """Validate API key on incoming requests.

    If ``POLYMER_API_KEY`` is not set, the middleware is a no-op (all
    requests pass through).  This lets you develop locally without
    configuring a key.
    """

    def __init__(self, app, *, api_key: str | None = None):
        super().__init__(app)
        self.api_key = api_key or os.environ.get("POLYMER_API_KEY")

    async def dispatch(self, request: Request, call_next):
        # No key configured → open access (local dev mode).
        if self.api_key is None:
            return await call_next(request)

        # Public paths are always accessible.
        if request.url.path in PUBLIC_PATHS:
            return await call_next(request)

        # Allow CORS preflight.
        if request.method == "OPTIONS":
            return await call_next(request)

        # Check header first, then query param.
        provided_key = request.headers.get("X-API-Key") or request.query_params.get(
            "api_key"
        )

        if provided_key is None:
            return JSONResponse(
                status_code=401,
                content={
                    "detail": "Missing API key. Provide via X-API-Key header or api_key query parameter."
                },
            )

        if not secrets.compare_digest(provided_key, self.api_key):
            return JSONResponse(
                status_code=403,
                content={"detail": "Invalid API key."},
            )

        return await call_next(request)
