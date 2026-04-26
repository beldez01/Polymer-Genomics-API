"""Migrate FormalClaim IR fixtures from schema v1.1 to v1.2.

Walks every `*.json` under `internal/InSilico/**/claims/` and
`internal/epistemic_os/fixtures/` that is a v1.1 FormalClaim (i.e. not an
`*.evaluation.json` sibling), synthesizes `domain` + `subject` + `context`,
validates the result with the v1.2 pydantic model, and writes it back.

Synthesis follows MASTER_PLAN.md §5.5 and swarm/C_ir_v1_2_design.md §6.2:

  bucket                                domain        subject kind
  ------                                ------        ------------
  withdrawn / FALSIFIED metadata        other         literal
  synthesis / dichotomy / depends_on>=2 multi_modal   composite    (MANUAL)
  HLA topic (path)                      genomic       cohort  (HLA loci)
  everything else                       genomic       cohort  (source layer)

Manual cases are written to `<fixture_parent>/PENDING_MANUAL_V1_2_MIGRATION.md`
with the reason, never silently downgraded to `literal`.

Usage:
    # report what would change
    uv run python scripts/migrate_claims_v1_1_to_v1_2.py

    # actually write files
    uv run python scripts/migrate_claims_v1_1_to_v1_2.py --apply
"""

from __future__ import annotations

import argparse
import json
import sys
from collections import defaultdict
from pathlib import Path

from polymer_genomics.formal_claims import FormalClaim

REPO = Path(__file__).resolve().parents[1]
INSILICO_ROOT = REPO / "internal" / "InSilico"
FIXTURES_ROOT = REPO / "internal" / "epistemic_os" / "fixtures"

# `exp17_formal_claim.json` is the canonical v1.1 back-compat oracle in the
# test suite — it must stay v1.1 so `test_v11_fixture_still_loads_on_v12_schema`
# continues to assert the compatibility contract. The v1.2-wrapped form is
# synthesized inline inside the test (`_exp17_as_v12_genomic`) rather than
# persisted.
EXCLUDED_ABS_PATHS = frozenset(
    {
        (FIXTURES_ROOT / "exp17_formal_claim.json").resolve(),
    }
)


def _is_claim_file(path: Path) -> bool:
    if not path.is_file():
        return False
    if path.suffix != ".json":
        return False
    if path.name.endswith(".evaluation.json"):
        return False
    return True


def _walk_claim_files() -> list[Path]:
    paths: list[Path] = []
    for root in (INSILICO_ROOT, FIXTURES_ROOT):
        if not root.exists():
            continue
        for p in root.rglob("*.json"):
            if "/claims/" in str(p) or root == FIXTURES_ROOT:
                if _is_claim_file(p) and p.resolve() not in EXCLUDED_ABS_PATHS:
                    paths.append(p)
    return sorted(set(paths))


def _synthesize_literal(claim: dict) -> dict:
    return {
        "kind": "literal",
        "id": f"literal:migration/{claim.get('version','unknown')}/{claim.get('exp_number','na')}",
        "display": claim.get("title", "v1.1 migration (literal wrap)"),
        "prose": (
            "Migrated from v1.1 as a literal subject because the claim was "
            "marked withdrawn/falsified at migration time. "
            "Re-author with a typed subject when resuming."
        ),
        "structured": {
            "migration_source": "v1.1",
            "note": "literal wrap chosen due to withdrawn/falsified status",
        },
    }


def _synthesize_cohort(claim: dict, slug: str, dataset_name: str) -> dict:
    first_source = claim["premises"][0]["source"] if claim.get("premises") else {}
    layer = first_source.get("layer", "unknown")
    version = first_source.get("version", "unknown")
    return {
        "kind": "cohort",
        "id": f"polymer:cohorts/migration/{slug}",
        "display": f"Migration cohort for '{claim.get('title','')[:80]}'",
        "definition": {
            "source_dataset": {
                "name": dataset_name,
                "version": version,
                "extra": {"first_premise_layer": layer},
            },
            "inclusion": [],
            "exclusion": [],
            "cardinality": None,
            "random_seed": None,
        },
        "members_hash": f"migration:v1_1_to_v1_2/{slug}",
        "note": (
            "Inclusion predicates intentionally empty at migration time; the "
            "implicit member set is defined by the v1.1 premises. Re-author "
            "with explicit inclusion predicates to tighten the subject."
        ),
    }


def _classify(claim: dict, path: Path) -> tuple[str | None, dict | None, str | None]:
    """Return (domain, subject_dict, manual_reason).

    If manual_reason is not None, the claim is skipped and recorded in the
    pending-manual file instead of migrated.
    """
    slug = path.stem
    topic_dir = path.parent.parent.name.lower()
    text = f"{slug} {claim.get('title','')}".lower()

    # 1. Withdrawn / falsified → literal
    if (
        "withdrawn" in text
        or "falsified" in text
        or slug.endswith("_FALSIFIED")
    ):
        return "other", _synthesize_literal(claim), None

    # 2. Synthesis / dichotomy / multi-claim composition → manual
    depends_on = claim.get("depends_on", [])
    if "dichotomy" in text or "synthesis" in text or len(depends_on) >= 2:
        return (
            "multi_modal",
            None,
            f"composite synthesis claim (depends_on={depends_on}, title hints at synthesis)",
        )

    # 3. HLA-topic cohort
    if "hla" in topic_dir:
        return "genomic", _synthesize_cohort(claim, slug, "IPD-IMGT/HLA"), None

    # 4. TE surveillance topic
    if "te surveillance" in topic_dir:
        return (
            "genomic",
            _synthesize_cohort(claim, slug, "Polymer TE surveillance corpus"),
            None,
        )

    # 5. Recombination hotspots topic
    if "recombination" in topic_dir:
        return (
            "genomic",
            _synthesize_cohort(claim, slug, "Polymer recombination hotspots corpus"),
            None,
        )

    # 6. Dual-channel topic
    if "dual_channel" in topic_dir:
        return (
            "genomic",
            _synthesize_cohort(claim, slug, "Polymer dual-channel corpus"),
            None,
        )

    # 7. Everything else → generic genomic cohort using the premise source
    return (
        "genomic",
        _synthesize_cohort(claim, slug, "Polymer v1.1 migration"),
        None,
    )


def _default_context(domain: str) -> dict:
    if domain == "genomic":
        return {"assembly": "GRCh38.p14"}
    if domain == "clinical":
        return {"consent_scope": "unknown_at_migration", "study_id": "unknown"}
    if domain == "transcriptomic":
        return {"assay": "unknown_at_migration", "organism": "Homo sapiens"}
    if domain == "single_cell":
        return {
            "assay": "unknown_at_migration",
            "organism": "Homo sapiens",
            "n_cells": None,
        }
    if domain == "multi_modal":
        return {"modalities": []}
    return {"free_form": "migrated from v1.1 without domain-specific context"}


def _insert_v12_fields_in_place(claim: dict, domain: str, subject: dict, context: dict) -> dict:
    """Rebuild the dict with v1.2 fields inserted before `premises` for readability."""
    out: dict = {}
    for key, value in claim.items():
        if key == "premises":
            out["domain"] = domain
            out["subject"] = subject
            out["context"] = context
        out[key] = value
    return out


def _plan(paths: list[Path]) -> tuple[list[tuple[Path, str]], list[tuple[Path, str]], list[Path]]:
    """Return (migrate_plan, manual_cases, already_v12)."""
    migrate: list[tuple[Path, str]] = []
    manual: list[tuple[Path, str]] = []
    already: list[Path] = []
    for path in paths:
        try:
            raw = json.loads(path.read_text())
        except Exception as exc:
            manual.append((path, f"unreadable JSON: {exc}"))
            continue
        if raw.get("schema_version") == "v1.2":
            already.append(path)
            continue
        if raw.get("schema_version") != "v1.1":
            manual.append((path, f"unexpected schema_version={raw.get('schema_version')!r}"))
            continue
        domain, subject, reason = _classify(raw, path)
        if reason is not None or subject is None:
            manual.append((path, reason or "could not synthesize subject"))
        else:
            migrate.append((path, domain))
    return migrate, manual, already


def _apply_one(path: Path, domain: str) -> tuple[bool, str]:
    raw = json.loads(path.read_text())
    _, subject, reason = _classify(raw, path)
    if subject is None:
        return False, reason or "classifier rejected"
    context = _default_context(domain)
    upgraded = dict(raw)
    upgraded["schema_version"] = "v1.2"
    upgraded = _insert_v12_fields_in_place(upgraded, domain, subject, context)
    try:
        FormalClaim.model_validate(upgraded)
    except Exception as exc:
        return False, f"post-migration validation failed: {exc}"
    path.write_text(json.dumps(upgraded, indent=2, ensure_ascii=False) + "\n")
    return True, "ok"


def _write_pending_file(manual: list[tuple[Path, str]]) -> Path | None:
    if not manual:
        return None
    # Group by topic-dir so each InSilico topic has its own pending list.
    by_parent: dict[Path, list[tuple[Path, str]]] = defaultdict(list)
    for path, reason in manual:
        by_parent[path.parent].append((path, reason))
    # Write a single consolidated file at fixtures root for visibility.
    out = FIXTURES_ROOT / "PENDING_MANUAL_V1_2_MIGRATION.md"
    lines = [
        "# Pending manual v1.2 migration",
        "",
        "Claims the automatic migrator could not upgrade.",
        "Each needs a hand-authored `domain` + `subject` before shipping the v1.2 release.",
        "",
    ]
    for parent, items in sorted(by_parent.items()):
        try:
            rel_parent = parent.relative_to(REPO)
        except ValueError:
            rel_parent = parent
        lines.append(f"## `{rel_parent}`")
        lines.append("")
        for path, reason in sorted(items):
            lines.append(f"- `{path.name}` — {reason}")
        lines.append("")
    out.write_text("\n".join(lines))
    return out


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Actually write files. Without this flag the script reports the plan only.",
    )
    parser.add_argument(
        "--path",
        action="append",
        type=Path,
        help="Restrict migration to specific paths (repeatable). Defaults to all.",
    )
    args = parser.parse_args()

    paths = [p.resolve() for p in (args.path or _walk_claim_files())]
    migrate, manual, already = _plan(paths)

    print(f"Scanned {len(paths)} claim files.")
    print(f"  already v1.2: {len(already)}")
    print(f"  will migrate: {len(migrate)}")
    print(f"  manual:       {len(manual)}")

    if args.apply:
        print()
        successes: list[Path] = []
        failures: list[tuple[Path, str]] = []
        for path, domain in migrate:
            ok, msg = _apply_one(path, domain)
            if ok:
                successes.append(path)
                print(f"  [ok] {path.relative_to(REPO)} → domain={domain}")
            else:
                failures.append((path, msg))
                print(f"  [FAIL] {path.relative_to(REPO)} — {msg}")
        # Failures join manual list so operator sees everything in one place.
        manual_plus_failures = list(manual) + failures
        pending = _write_pending_file(manual_plus_failures)
        print()
        print(f"  migrated: {len(successes)}")
        print(f"  failed:   {len(failures)}")
        if pending:
            print(f"  pending manual → {pending.relative_to(REPO)}")
        return 0 if not failures else 1
    else:
        print("\nDRY RUN — pass --apply to write.\n")
        for path, domain in migrate[:10]:
            print(f"  [plan] {path.relative_to(REPO)} → domain={domain}")
        if len(migrate) > 10:
            print(f"  ... and {len(migrate) - 10} more")
        if manual:
            print("\nMANUAL cases:")
            for path, reason in manual:
                print(f"  [manual] {path.relative_to(REPO)} — {reason}")
        return 0


if __name__ == "__main__":
    sys.exit(main())
