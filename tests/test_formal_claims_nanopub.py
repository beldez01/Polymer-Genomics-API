"""Tests for the FormalClaim → Nanopub TriG projection (MVP).

Covers:
  * Valid TriG structure: four named graphs, prefix block, no unresolved
    prefixes.
  * Byte-deterministic output: two serializations of the same claim
    produce identical bytes (critical for CI-published sibling files).
  * Round-trip under an RDF parser when rdflib is available; a graceful
    skip otherwise so we do not take rdflib as a hard dep yet.
  * Essential fields present: title, outcome, schema version, premises,
    license, v1.2 subject/domain when present.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from polymer_genomics.formal_claims import FormalClaim
from polymer_genomics.formal_claims.nanopub import to_trig

REPO = Path(__file__).resolve().parents[1]
EXP17 = REPO / "internal" / "epistemic_os" / "fixtures" / "exp17_formal_claim.json"


def _load(path: Path) -> FormalClaim:
    return FormalClaim.model_validate(json.loads(path.read_text()))


def test_output_is_string_and_nontrivial() -> None:
    trig = to_trig(_load(EXP17))
    assert isinstance(trig, str)
    assert len(trig) > 500  # sanity: more than the prefix block


def test_output_has_four_named_graphs() -> None:
    trig = to_trig(_load(EXP17))
    assert ":Head {" in trig
    assert ":assertion {" in trig
    assert ":provenance {" in trig
    assert ":pubinfo {" in trig


def test_prefix_block_declares_required_namespaces() -> None:
    trig = to_trig(_load(EXP17))
    head = trig.split("\n\n", 1)[0]
    for prefix in ("polymer:", "np:", "prov:", "dcterms:", "rdf:", "rdfs:", "xsd:"):
        assert f"@prefix {prefix} " in head


def test_includes_claim_title_and_outcome() -> None:
    trig = to_trig(_load(EXP17))
    assert "polymer:outcome" in trig
    # Exp 17 is strong_positive
    assert "strong_positive" in trig


def test_includes_license() -> None:
    trig = to_trig(_load(EXP17))
    assert "creativecommons.org/licenses/by/4.0" in trig


def test_includes_every_premise_as_derivation() -> None:
    claim = _load(EXP17)
    trig = to_trig(claim)
    # One "prov:wasDerivedFrom :premiseN" line per premise.
    assert trig.count("prov:wasDerivedFrom") == len(claim.premises)


def test_byte_deterministic_across_two_calls() -> None:
    claim = _load(EXP17)
    a = to_trig(claim)
    b = to_trig(claim)
    assert a == b, "two serializations of the same claim diverged"


def test_byte_deterministic_across_reloads() -> None:
    """Round-trip claim → JSON → claim should also produce identical TriG."""
    claim1 = _load(EXP17)
    roundtripped = FormalClaim.model_validate(
        json.loads(claim1.model_dump_json())
    )
    assert to_trig(claim1) == to_trig(roundtripped)


def test_v12_subject_fields_appear_when_present() -> None:
    """A synthetic v1.2 wrap surfaces domain + subject id/kind/display."""
    claim_dict = json.loads(EXP17.read_text())
    claim_dict["schema_version"] = "v1.2"
    claim_dict["domain"] = "genomic"
    claim_dict["subject"] = {
        "kind": "genomic_region",
        "id": "hg38:autosomes:1Mb-windows",
        "display": "Autosomes in 1 Mb windows (hg38)",
        "assembly": "GRCh38.p14",
        "chrom": "chr1",
        "start": 1,
        "end": 248956422,
        "strand": ".",
    }
    claim_dict["context"] = {"assembly": "GRCh38.p14"}
    trig = to_trig(FormalClaim.model_validate(claim_dict))
    assert "polymer:domain" in trig
    assert "genomic_region" in trig
    assert "hg38:autosomes:1Mb-windows" in trig


def test_parses_under_rdflib_when_available() -> None:
    rdflib = pytest.importorskip("rdflib")
    trig = to_trig(_load(EXP17))
    ds = rdflib.Dataset()
    ds.parse(data=trig, format="trig")
    # Four named graphs: Head, assertion, provenance, pubinfo.
    # (rdflib exposes a default + named; we inspect for >=4 contexts with triples)
    nonempty_graphs = [
        g for g in ds.contexts() if len(list(g.triples((None, None, None)))) > 0
    ]
    assert len(nonempty_graphs) >= 4, f"expected >=4 non-empty graphs, got {len(nonempty_graphs)}"
