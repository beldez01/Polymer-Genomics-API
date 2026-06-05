"""Download the reference atlases into data/manifold/ (idempotent).

Multiome: GSE194122 (NeurIPS 2021 BMMC 10x Multiome, processed h5ad).
Reference: Setty 2019 CD34+ bone marrow (Palantir), figshare h5ad.

URLs are resolved at runtime from the records; if a download fails the script
prints the source URL and exits non-zero so the failure is loud.
"""
from __future__ import annotations

import sys
import urllib.request
from pathlib import Path

from manifold.fetch import should_fetch

DATA = Path(__file__).resolve().parents[2] / "data" / "manifold"

SOURCES = {
    "neurips_bmmc_multiome.h5ad": (
        "https://ftp.ncbi.nlm.nih.gov/geo/series/GSE194nnn/GSE194122/suppl/"
        "GSE194122_openproblems_neurips2021_multiome_BMMC_processed.h5ad.gz"
    ),
    "setty2019_cd34.h5ad": (
        "https://figshare.com/ndownloader/files/53393684"
    ),
}


def main() -> int:
    DATA.mkdir(parents=True, exist_ok=True)
    for name, url in SOURCES.items():
        dest = DATA / name
        if not should_fetch(dest, None):
            print(f"[skip] {name} already present at {dest}")
            continue
        print(f"[fetch] {name} <- {url}")
        try:
            tmp = dest.with_suffix(dest.suffix + ".part")
            urllib.request.urlretrieve(url, tmp)
            tmp.rename(dest)
            print(f"[done]  {dest} ({dest.stat().st_size/1e6:.0f} MB)")
        except Exception as exc:  # noqa: BLE001
            print(f"[FAIL]  {name}: {exc}\n         source: {url}", file=sys.stderr)
            return 1
    print("\nNOTE: if the multiome arrives gzip'd (.h5ad.gz), decompress in place:")
    print(f"  gunzip -k {DATA/'neurips_bmmc_multiome.h5ad'}.gz  (then rename if needed)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
