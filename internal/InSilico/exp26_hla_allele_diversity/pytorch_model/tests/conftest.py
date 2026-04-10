"""Ensure PolymerGenomicsAPI root is on sys.path for pytest imports."""
import sys
from pathlib import Path

# parents[5] = PolymerGenomicsAPI root
PROJECT_ROOT = Path(__file__).resolve().parents[5]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))
