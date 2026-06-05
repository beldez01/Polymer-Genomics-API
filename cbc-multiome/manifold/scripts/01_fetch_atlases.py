"""Download the reference atlases into data/manifold/ (idempotent).

Multiome (canvas): GSE194122 (NeurIPS 2021 BMMC 10x Multiome, processed h5ad,
served gzip'd -> decompressed on arrival).
Reference: Setty 2019 CD34+ bone marrow (Palantir), figshare h5ad.

If a download fails the script prints the source URL and exits non-zero.
"""
from __future__ import annotations

import gzip
import shutil
import sys
import urllib.request
from pathlib import Path

from manifold.fetch import should_fetch

DATA = Path(__file__).resolve().parents[2] / "data" / "manifold"

# name -> (url, gunzip?)
SOURCES = {
    "neurips_bmmc_multiome.h5ad": (
        "https://ftp.ncbi.nlm.nih.gov/geo/series/GSE194nnn/GSE194122/suppl/"
        "GSE194122_openproblems_neurips2021_multiome_BMMC_processed.h5ad.gz",
        True,
    ),
    "setty2019_cd34.h5ad": (
        "https://ndownloader.figshare.com/files/35848268",
        False,
    ),
}


def main() -> int:
    DATA.mkdir(parents=True, exist_ok=True)
    for name, (url, do_gunzip) in SOURCES.items():
        dest = DATA / name
        if not should_fetch(dest, None):
            print(f"[skip] {name} already present at {dest}")
            continue
        print(f"[fetch] {name} <- {url}")
        try:
            tmp = dest.with_suffix(dest.suffix + ".part")
            urllib.request.urlretrieve(url, tmp)
            if do_gunzip:
                with gzip.open(tmp, "rb") as fin, open(dest, "wb") as fout:
                    shutil.copyfileobj(fin, fout)
                tmp.unlink()
            else:
                tmp.rename(dest)
            print(f"[done]  {dest} ({dest.stat().st_size/1e6:.0f} MB)")
        except Exception as exc:  # noqa: BLE001
            print(f"[FAIL]  {name}: {exc}\n         source: {url}", file=sys.stderr)
            return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
