#!/usr/bin/env python3
"""MCP Harness Benchmark — Tool Selection & Behavior Scoring.

Reads a Claude Code .jsonl transcript and scores MCP tool calls against
15 predefined test cases. No external dependencies.

Usage:
    python score_harness.py transcript.jsonl --case A1
    python score_harness.py transcript.jsonl --all
    python score_harness.py --list
"""
from __future__ import annotations

import argparse
import json
import sys
from dataclasses import dataclass, field
from pathlib import Path

MCP_PREFIX = "mcp__polymer-genomics__"


# ---------------------------------------------------------------------------
# Test case definitions
# ---------------------------------------------------------------------------

@dataclass
class TestCase:
    id: str
    category: str
    prompt: str
    expected_first: list[str]
    expected_sequence: list[str] = field(default_factory=list)
    fail_tools: list[str] = field(default_factory=list)
    description: str = ""


CASES: list[TestCase] = [
    # --- Category A: Tool Selection ---
    TestCase(
        id="A1",
        category="tool_selection",
        prompt="What probes are near TP53?",
        expected_first=["query_proximity"],
        expected_sequence=["query_proximity"],
        fail_tools=[],
        description="Prefer query_proximity over lookup_gene + query_region",
    ),
    TestCase(
        id="A2",
        category="tool_selection",
        prompt="Look up probe cg08796240",
        expected_first=["lookup_probe"],
        expected_sequence=["lookup_probe"],
        fail_tools=["query_region", "search"],
        description="Direct probe lookup, not region query or search",
    ),
    TestCase(
        id="A3",
        category="tool_selection",
        prompt="What genes start with BRC?",
        expected_first=["search"],
        expected_sequence=["search"],
        fail_tools=["lookup_gene"],
        description="Prefix search, not guessing a gene name",
    ),
    TestCase(
        id="A4",
        category="tool_selection",
        prompt="Get the DNA sequence around chr7:117548628-117548880",
        expected_first=["get_sequence"],
        expected_sequence=["get_sequence"],
        fail_tools=["query_region"],
        description="Sequence retrieval, not annotation query",
    ),
    TestCase(
        id="A5",
        category="tool_selection",
        prompt="What data layers are available for hg37?",
        expected_first=["list_layers"],
        expected_sequence=["list_layers"],
        fail_tools=[],
        description="Discovery via list_layers, not guessing",
    ),
    TestCase(
        id="A6",
        category="tool_selection",
        prompt="How much does it cost the cell to make albumin?",
        expected_first=["lookup_gene_cost"],
        expected_sequence=["lookup_gene_cost"],
        fail_tools=["lookup_gene"],
        description="Bioenergetic cost tool, not gene model",
    ),
    TestCase(
        id="A7",
        category="tool_selection",
        prompt="I need coordinates for these probes: cg08796240, cg16755922, cg27457201",
        expected_first=["batch_probes"],
        expected_sequence=["batch_probes"],
        fail_tools=["lookup_probe"],
        description="Batch probe lookup, not 3 individual calls",
    ),
    # --- Category B: Truncation & Scale ---
    TestCase(
        id="B1",
        category="truncation",
        prompt="Show me everything on chromosome 7",
        expected_first=["aggregate_region"],
        expected_sequence=["aggregate_region"],
        fail_tools=["query_region"],
        description="Whole-chromosome must use aggregate, not query_region",
    ),
    TestCase(
        id="B2",
        category="truncation",
        prompt="What's in chr16:70000000-72000000?",
        expected_first=["aggregate_region"],
        expected_sequence=["aggregate_region"],
        fail_tools=[],
        description="2 Mb region should aggregate first, then drill down",
    ),
    TestCase(
        id="B3",
        category="truncation",
        prompt="List all CpG sites in the BRCA1 locus",
        expected_first=["lookup_gene"],
        expected_sequence=["lookup_gene", "query_region"],
        fail_tools=[],
        description="Gene lookup then layer-filtered query_region",
    ),
    TestCase(
        id="B4",
        category="truncation",
        prompt="Download the full EPIC v2 probe manifest",
        expected_first=["bulk_download"],
        expected_sequence=["bulk_download"],
        fail_tools=["query_region", "batch_probes"],
        description="Bulk download, not piecemeal querying",
    ),
    # --- Category C: Composition Patterns ---
    TestCase(
        id="C1",
        category="composition",
        prompt="Analyze the VAC14 locus — give me genes, probes, and CpG context",
        expected_first=["lookup_gene", "query_proximity"],
        expected_sequence=["lookup_gene"],
        fail_tools=[],
        description="Start with gene lookup, don't guess coordinates",
    ),
    TestCase(
        id="C2",
        category="composition",
        prompt="Is cg08796240 on the 450K array?",
        expected_first=["lookup_probe"],
        expected_sequence=["lookup_probe"],
        fail_tools=["list_layers", "batch_probes"],
        description="Crossmap field in lookup_probe answers this directly",
    ),
    TestCase(
        id="C3",
        category="composition",
        prompt="Compare CpG density between the TP53 and BRCA1 promoters",
        expected_first=["lookup_gene", "query_proximity"],
        expected_sequence=[],
        fail_tools=[],
        description="Needs two gene/proximity lookups to compare",
    ),
    TestCase(
        id="C4",
        category="composition",
        prompt="What's the genomic context of probe cg16972240?",
        expected_first=["lookup_probe"],
        expected_sequence=["lookup_probe"],
        fail_tools=[],
        description="Probe lookup then follow-up context query",
    ),
]

CASES_BY_ID = {c.id: c for c in CASES}

CATEGORY_LABELS = {
    "tool_selection": "Tool Selection",
    "truncation": "Truncation",
    "composition": "Composition",
}


# ---------------------------------------------------------------------------
# Transcript parsing
# ---------------------------------------------------------------------------

@dataclass
class ToolCall:
    name: str          # short name (prefix stripped)
    params: dict
    index: int         # position in transcript

@dataclass
class UserMessage:
    text: str
    index: int


def parse_transcript(path: Path) -> tuple[list[UserMessage], list[ToolCall]]:
    """Extract user messages and MCP tool calls from a .jsonl transcript."""
    user_msgs: list[UserMessage] = []
    tool_calls: list[ToolCall] = []
    idx = 0

    with open(path) as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                event = json.loads(line)
            except json.JSONDecodeError:
                continue

            msg_type = event.get("type", "")

            # User messages (type is "user" in Claude Code transcripts)
            if msg_type in ("human", "user"):
                content = event.get("message", {}).get("content", "")
                if isinstance(content, str) and content.strip():
                    user_msgs.append(UserMessage(text=content.strip(), index=idx))
                elif isinstance(content, list):
                    for block in content:
                        if isinstance(block, dict) and block.get("type") == "text":
                            text = block.get("text", "").strip()
                            if text:
                                user_msgs.append(UserMessage(text=text, index=idx))

            # Assistant tool calls
            if msg_type == "assistant":
                content = event.get("message", {}).get("content", [])
                if isinstance(content, list):
                    for block in content:
                        if isinstance(block, dict) and block.get("type") == "tool_use":
                            name = block.get("name", "")
                            if name.startswith(MCP_PREFIX):
                                short = name[len(MCP_PREFIX):]
                                tool_calls.append(ToolCall(
                                    name=short,
                                    params=block.get("input", {}),
                                    index=idx,
                                ))

            idx += 1

    return user_msgs, tool_calls


def find_prompt_segment(
    prompt: str,
    user_msgs: list[UserMessage],
    tool_calls: list[ToolCall],
) -> list[ToolCall]:
    """Find tool calls belonging to a specific prompt.

    Matches the test-case prompt as a substring of any user message, then
    returns tool calls between that message and the next user message.
    """
    # Find the user message containing our prompt
    match_msg = None
    next_msg_index = None

    for i, um in enumerate(user_msgs):
        if prompt.lower() in um.text.lower():
            match_msg = um
            if i + 1 < len(user_msgs):
                next_msg_index = user_msgs[i + 1].index
            break

    if match_msg is None:
        return []

    # Collect tool calls between this message and the next
    segment = []
    for tc in tool_calls:
        if tc.index > match_msg.index:
            if next_msg_index is not None and tc.index >= next_msg_index:
                break
            segment.append(tc)

    return segment


# ---------------------------------------------------------------------------
# Scoring
# ---------------------------------------------------------------------------

@dataclass
class Score:
    case_id: str
    result: str              # "PASS", "FAIL", "PARTIAL", "SKIP"
    first_tool: str | None
    tool_sequence: list[str]
    detail: str


def is_subsequence(expected: list[str], actual: list[str]) -> bool:
    """Check if expected is a subsequence of actual."""
    if not expected:
        return True
    it = iter(actual)
    return all(item in it for item in expected)


def score_case(case: TestCase, calls: list[ToolCall]) -> Score:
    """Score a single test case against extracted tool calls."""
    tool_seq = [c.name for c in calls]

    if not tool_seq:
        return Score(
            case_id=case.id,
            result="SKIP",
            first_tool=None,
            tool_sequence=[],
            detail="No MCP tool calls found for this prompt",
        )

    first = tool_seq[0]
    first_ok = first in case.expected_first

    # Check fail tools: did a fail tool appear before any expected tool?
    fail_hit = False
    if case.fail_tools:
        for t in tool_seq:
            if t in case.fail_tools:
                fail_hit = True
                break
            if t in case.expected_first:
                break

    seq_ok = is_subsequence(case.expected_sequence, tool_seq)

    if fail_hit:
        result = "FAIL"
        detail = f"Fail-tool '{first}' used"
    elif first_ok and seq_ok:
        result = "PASS"
        detail = ""
    elif first_ok and not seq_ok:
        result = "PARTIAL"
        detail = f"First tool correct but expected sequence {case.expected_sequence} not found in {tool_seq}"
    else:
        result = "FAIL"
        detail = f"Expected first tool in {case.expected_first}, got '{first}'"

    return Score(
        case_id=case.id,
        result=result,
        first_tool=first,
        tool_sequence=tool_seq,
        detail=detail,
    )


# ---------------------------------------------------------------------------
# Output
# ---------------------------------------------------------------------------

def print_list():
    """Print all test cases."""
    print("MCP Harness Benchmark — 15 Test Cases")
    print("=" * 60)
    current_cat = None
    for c in CASES:
        if c.category != current_cat:
            current_cat = c.category
            label = CATEGORY_LABELS.get(current_cat, current_cat)
            print(f"\n  {label}")
            print(f"  {'-' * 40}")
        print(f"  {c.id:4s}  {c.description}")
        print(f"        Prompt: \"{c.prompt}\"")
        print(f"        Expect: {c.expected_first}")
    print()


def print_scorecard(scores: list[Score]):
    """Print the full scorecard."""
    print()
    print("MCP Harness Benchmark — Scorecard")
    print("\u2550" * 65)

    for s in scores:
        case = CASES_BY_ID[s.case_id]
        label = CATEGORY_LABELS.get(case.category, case.category)
        desc = case.description[:40]
        tag = s.result
        line = f"  {s.case_id:4s}  {label:16s}  {desc:40s}  {tag}"
        if s.detail:
            line += f"  ({s.detail})"
        print(line)

    print("\u2550" * 65)

    total = len(scores)
    passed = sum(1 for s in scores if s.result == "PASS")
    partial = sum(1 for s in scores if s.result == "PARTIAL")
    failed = sum(1 for s in scores if s.result == "FAIL")
    skipped = sum(1 for s in scores if s.result == "SKIP")

    scored = total - skipped
    pct = (passed / scored * 100) if scored else 0
    parts = [f"{passed}/{scored} PASS"]
    if partial:
        parts.append(f"{partial} PARTIAL")
    if failed:
        parts.append(f"{failed} FAIL")
    if skipped:
        parts.append(f"{skipped} SKIP")
    print(f"\n  Overall: {', '.join(parts)} ({pct:.0f}%)")

    # By category
    cats = {}
    for s in scores:
        cat = CASES_BY_ID[s.case_id].category
        cats.setdefault(cat, []).append(s)

    print("  By category:")
    for cat in ["tool_selection", "truncation", "composition"]:
        if cat in cats:
            cat_scores = cats[cat]
            cat_pass = sum(1 for s in cat_scores if s.result == "PASS")
            cat_total = len(cat_scores)
            label = CATEGORY_LABELS.get(cat, cat)
            print(f"    {label:16s}  {cat_pass}/{cat_total}")
    print()


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        description="MCP Harness Benchmark — score tool selection against transcripts"
    )
    parser.add_argument(
        "transcript",
        nargs="?",
        type=Path,
        help="Path to Claude Code .jsonl transcript",
    )
    parser.add_argument("--case", help="Score a single case (e.g. A1)")
    parser.add_argument("--all", action="store_true", help="Score all cases in session")
    parser.add_argument("--list", action="store_true", help="List all test cases")
    parser.add_argument(
        "--verbose", "-v", action="store_true", help="Show tool sequences"
    )

    args = parser.parse_args()

    if args.list:
        print_list()
        return

    if not args.transcript:
        parser.error("transcript path is required (unless using --list)")

    if not args.transcript.exists():
        print(f"Error: transcript not found: {args.transcript}", file=sys.stderr)
        sys.exit(1)

    user_msgs, tool_calls = parse_transcript(args.transcript)

    if not tool_calls:
        print("Warning: no MCP tool calls found in transcript", file=sys.stderr)

    if args.case:
        case_id = args.case.upper()
        if case_id not in CASES_BY_ID:
            print(f"Error: unknown case '{case_id}'", file=sys.stderr)
            print(f"Valid cases: {', '.join(CASES_BY_ID.keys())}", file=sys.stderr)
            sys.exit(1)

        case = CASES_BY_ID[case_id]
        calls = find_prompt_segment(case.prompt, user_msgs, tool_calls)
        result = score_case(case, calls)

        if args.verbose:
            print(f"Tools found: {result.tool_sequence}")

        print_scorecard([result])

    elif args.all:
        scores = []
        for case in CASES:
            calls = find_prompt_segment(case.prompt, user_msgs, tool_calls)
            result = score_case(case, calls)
            if args.verbose and result.tool_sequence:
                print(f"  {case.id}: {result.tool_sequence}")
            scores.append(result)

        print_scorecard(scores)

    else:
        parser.error("specify --case, --all, or --list")


if __name__ == "__main__":
    main()
