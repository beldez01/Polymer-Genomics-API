"""Polymer Methylation Compute Engine.

Manages R subprocess calls and session state for the methylation pipeline.
Aligns with AGENT_HARNESS.md Step 4: R/Bioconductor bridge via async subprocess.

Sessions are stored in /tmp/polymer/sessions/{session_id}/ with .rds checkpoints.
R scripts live in engine/r_scripts/ and follow JSON-in/JSON-out contract.
"""

from __future__ import annotations

import asyncio
import json
import os
import shutil
import subprocess
import time
import uuid
from pathlib import Path

# R script location: engine/r_scripts/ relative to repo root,
# or override via POLYMER_R_SCRIPTS env var
_REPO_ROOT = Path(__file__).resolve().parent.parent.parent
R_SCRIPTS = Path(
    os.environ.get("POLYMER_R_SCRIPTS", str(_REPO_ROOT / "engine" / "r_scripts"))
)

SESSIONS_DIR = Path(
    os.environ.get("POLYMER_SESSIONS_DIR", "/tmp/polymer/sessions")
)

# Check if R is available
_r_available: bool | None = None


def r_available() -> bool:
    """Check if Rscript is on PATH."""
    global _r_available
    if _r_available is None:
        _r_available = shutil.which("Rscript") is not None
    return _r_available


def require_r() -> None:
    """Raise RuntimeError if R is not available."""
    if not r_available():
        raise RuntimeError(
            "R is not installed. Compute tools require R + Bioconductor packages.\n"
            "Install R from https://cran.r-project.org/ and run:\n"
            "  Rscript -e \"install.packages('BiocManager'); "
            "BiocManager::install(c('minfi','sesame','limma','matrixStats','maxprobes'))\"\n"
            "Or use Docker: docker run polymerbio/methylation-toolkit"
        )


def create_session() -> str:
    """Create a new session directory, return session ID."""
    sid = uuid.uuid4().hex[:12]
    session_dir = SESSIONS_DIR / sid
    session_dir.mkdir(parents=True, exist_ok=True)
    # Write creation timestamp
    (session_dir / "created_at").write_text(str(time.time()))
    return sid


def session_dir(session_id: str) -> Path:
    """Return the session directory path, validated."""
    d = SESSIONS_DIR / session_id
    if not d.exists():
        raise ValueError(f"Session not found: {session_id}")
    return d


def list_sessions() -> list[dict]:
    """List all active sessions."""
    if not SESSIONS_DIR.exists():
        return []
    sessions = []
    for d in SESSIONS_DIR.iterdir():
        if d.is_dir():
            created = None
            ts_file = d / "created_at"
            if ts_file.exists():
                created = float(ts_file.read_text().strip())
            checkpoints = [f.stem for f in d.glob("*.rds")]
            sessions.append({
                "session_id": d.name,
                "created_at": created,
                "checkpoints": checkpoints,
            })
    return sessions


def cleanup_session(session_id: str) -> bool:
    """Remove a session directory."""
    d = SESSIONS_DIR / session_id
    if d.exists():
        shutil.rmtree(d)
        return True
    return False


async def call_r(script: str, args: dict, timeout: int = 300) -> dict:
    """Call an R script asynchronously with JSON I/O.

    Args:
        script: Script name without extension (e.g., "load_idats").
        args: Dictionary of parameters, serialized to JSON as CLI arg.
        timeout: Timeout in seconds (default 5 min).

    Returns:
        Parsed JSON dict from R stdout.

    Raises:
        RuntimeError: If R is not available, script not found, or R exits non-zero.
        TimeoutError: If script exceeds timeout.
    """
    require_r()

    script_path = R_SCRIPTS / f"{script}.R"
    if not script_path.exists():
        raise FileNotFoundError(f"R script not found: {script_path}")

    cmd = ["Rscript", str(script_path), json.dumps(args)]

    try:
        result = await asyncio.to_thread(
            subprocess.run,
            cmd,
            capture_output=True,
            text=True,
            timeout=timeout,
            cwd=str(R_SCRIPTS),  # so source("utils.R") works
        )
    except subprocess.TimeoutExpired:
        raise TimeoutError(f"R script '{script}' timed out after {timeout}s")

    if result.returncode != 0:
        # Try to parse structured error from stderr
        stderr = result.stderr.strip()
        try:
            err = json.loads(stderr)
            raise RuntimeError(err.get("error", stderr))
        except json.JSONDecodeError:
            raise RuntimeError(f"R error in {script}: {stderr}")

    stdout = result.stdout.strip()
    if not stdout:
        raise RuntimeError(f"R script '{script}' produced no output")

    try:
        return json.loads(stdout)
    except json.JSONDecodeError:
        raise RuntimeError(
            f"R script '{script}' produced invalid JSON: {stdout[:200]}"
        )
