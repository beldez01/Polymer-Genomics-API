"""Polymer Genomics API exceptions."""


class PolymerAPIError(Exception):
    """Base exception for API errors."""

    def __init__(self, status_code: int, message: str):
        self.status_code = status_code
        self.message = message
        super().__init__(f"HTTP {status_code}: {message}")


class PolymerAuthError(PolymerAPIError):
    """Authentication or authorization failure (401/403)."""

    def __init__(self, message: str = "Authentication failed"):
        super().__init__(401, message)


class PolymerNotFoundError(PolymerAPIError):
    """Resource not found (404)."""

    def __init__(self, message: str = "Not found"):
        super().__init__(404, message)


class PolymerValidationError(PolymerAPIError):
    """Request validation error (422)."""

    def __init__(self, message: str = "Validation error"):
        super().__init__(422, message)


class PolymerRateLimitError(PolymerAPIError):
    """Rate limit exceeded (429)."""

    def __init__(self, message: str = "Rate limit exceeded"):
        super().__init__(429, message)
