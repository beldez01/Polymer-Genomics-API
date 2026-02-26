"""Export the FastAPI auto-generated OpenAPI spec to a static YAML file.

Usage:
    uv run python scripts/export_openapi.py

Outputs:
    docs/openapi.yaml — validated OpenAPI 3.1 specification
"""

from __future__ import annotations

import sys
from pathlib import Path

import yaml
from openapi_spec_validator import validate

from polymer_genomics.main import app

REPO_ROOT = Path(__file__).resolve().parent.parent
OUTPUT_DIR = REPO_ROOT / "docs"
OUTPUT_FILE = OUTPUT_DIR / "openapi.yaml"


def main() -> None:
    # --- generate -----------------------------------------------------------
    schema = app.openapi()
    print(f"Generated OpenAPI {schema.get('openapi', '?')} spec: {schema['info']['title']} v{schema['info']['version']}")

    # --- validate -----------------------------------------------------------
    try:
        validate(schema)
    except Exception as exc:
        print(f"VALIDATION FAILED: {exc}", file=sys.stderr)
        sys.exit(1)
    print("Spec passed openapi-spec-validator checks.")

    # --- write --------------------------------------------------------------
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_FILE, "w") as fh:
        yaml.dump(schema, fh, default_flow_style=False, sort_keys=False, allow_unicode=True)
    print(f"Wrote {OUTPUT_FILE.relative_to(REPO_ROOT)}")


if __name__ == "__main__":
    main()
