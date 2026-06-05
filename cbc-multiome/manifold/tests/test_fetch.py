import hashlib
from manifold.fetch import should_fetch, sha256_of


def test_missing_file_should_fetch(tmp_path):
    assert should_fetch(tmp_path / "nope.h5ad", None) is True


def test_present_file_without_checksum_skips(tmp_path):
    p = tmp_path / "a.bin"
    p.write_bytes(b"hello")
    assert should_fetch(p, None) is False


def test_checksum_match_skips(tmp_path):
    p = tmp_path / "a.bin"
    p.write_bytes(b"hello")
    digest = hashlib.sha256(b"hello").hexdigest()
    assert should_fetch(p, digest) is False


def test_checksum_mismatch_refetches(tmp_path):
    p = tmp_path / "a.bin"
    p.write_bytes(b"hello")
    assert should_fetch(p, "deadbeef") is True


def test_sha256_of_matches_hashlib(tmp_path):
    p = tmp_path / "a.bin"
    p.write_bytes(b"hello world")
    assert sha256_of(p) == hashlib.sha256(b"hello world").hexdigest()
