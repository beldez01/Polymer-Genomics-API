from polymer_genomics.coordinates import db_to_api, api_to_db, parse_region
import pytest


def test_db_to_api_cpg():
    """CpG at internal [70699929, 70699931) -> API [70699930, 70699931]"""
    result = db_to_api(start=70699929, end=70699931)
    assert result == {"start": 70699930, "end": 70699931, "width": 2}


def test_db_to_api_single_base():
    """Probe at internal [70699929, 70699930) -> API [70699930, 70699930]"""
    result = db_to_api(start=70699929, end=70699930)
    assert result == {"start": 70699930, "end": 70699930, "width": 1}


def test_api_to_db_default_1based():
    """1-based query [70699930, 70699931] -> internal [70699929, 70699931)"""
    result = api_to_db(start=70699930, end=70699931, coords="1based")
    assert result == {"start": 70699929, "end": 70699931}


def test_api_to_db_0based():
    """0-based query [70699929, 70699931) -> internal [70699929, 70699931)"""
    result = api_to_db(start=70699929, end=70699931, coords="0based")
    assert result == {"start": 70699929, "end": 70699931}


def test_roundtrip():
    """Internal -> API -> query -> internal should be identity."""
    internal_start, internal_end = 100, 102
    api = db_to_api(internal_start, internal_end)
    back = api_to_db(api["start"], api["end"], coords="1based")
    assert back == {"start": internal_start, "end": internal_end}


def test_parse_region():
    result = parse_region("chr16:70699930-70700000")
    assert result == {"chr": "chr16", "start": 70699930, "end": 70700000}


def test_parse_region_chrX():
    result = parse_region("chrX:1000-2000")
    assert result == {"chr": "chrX", "start": 1000, "end": 2000}


def test_parse_region_invalid():
    with pytest.raises(ValueError):
        parse_region("invalid")


def test_parse_region_no_colon():
    with pytest.raises(ValueError):
        parse_region("chr1-1000-2000")
