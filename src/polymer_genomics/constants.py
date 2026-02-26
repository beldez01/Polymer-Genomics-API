"""Shared constants for the Polymer Genomics API."""

VALID_BUILDS = {"hg37", "hg38"}

CHR_NAME_TO_ID = {f"chr{i}": i for i in range(1, 23)}
CHR_NAME_TO_ID.update({"chrX": 23, "chrY": 24, "chrM": 25})

CHR_ID_TO_NAME = {v: k for k, v in CHR_NAME_TO_ID.items()}
