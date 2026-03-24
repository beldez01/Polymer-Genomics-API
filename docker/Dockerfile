# ============================================================
# Polymer Genomics API — Multi-stage Production Dockerfile
# ============================================================

# --- Stage 1: Builder (install dependencies with uv) --------
FROM python:3.12-slim AS builder

# Install uv for fast dependency resolution
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

WORKDIR /app

# Copy dependency metadata first (layer caching)
COPY pyproject.toml uv.lock ./

# Install production dependencies only (no dev extras)
RUN uv sync --frozen --no-install-project --no-dev

# Copy source code and install the project itself
COPY src/ src/
RUN uv sync --frozen --no-dev


# --- Stage 2: Runtime (slim image, non-root) ----------------
FROM python:3.12-slim AS runtime

# Security: run as non-root user
RUN groupadd --gid 1000 app \
    && useradd --uid 1000 --gid app --shell /bin/bash --create-home app

WORKDIR /app

# Copy the virtual environment and source from the builder stage
COPY --from=builder /app/.venv /app/.venv
COPY --from=builder /app/src /app/src

# Copy the init SQL for cases where the API container needs it
# (primarily used by docker-compose postgres init)
COPY docker/postgres/init.sql /app/docker/postgres/init.sql

# Put the venv on PATH so `uvicorn` is directly available
ENV PATH="/app/.venv/bin:$PATH" \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

# Switch to non-root user
USER app

EXPOSE 8000

# Production: multiple workers, bind to all interfaces
CMD ["uvicorn", "polymer_genomics.main:app", \
     "--host", "0.0.0.0", \
     "--port", "8000", \
     "--workers", "4", \
     "--log-level", "info", \
     "--no-access-log"]
