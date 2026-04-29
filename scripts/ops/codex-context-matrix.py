#!/usr/bin/env python3

from __future__ import annotations

import argparse
from pathlib import Path
import re


ROOT = Path(__file__).resolve().parents[2] / "core" / "Pluri-Health"


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def count_tokens_rough(text: str) -> int:
    words = re.findall(r"\S+", text)
    return max(1, round(len(words) * 1.33))


def note_kind(text: str) -> str:
    match = re.search(r"^kind:\s*(.+)$", text, re.M)
    return match.group(1).strip() if match else "unknown"


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate a compact context matrix for the Codex vault.")
    parser.add_argument("--limit", type=int, default=30, help="Maximum notes to include.")
    args = parser.parse_args()

    rows = []
    for path in sorted(ROOT.rglob("*.md")):
        rel = path.relative_to(ROOT)
        if rel.parts and rel.parts[0] == "Users":
            continue
        text = read_text(path)
        rows.append((count_tokens_rough(text), note_kind(text), rel.as_posix()))

    rows.sort(key=lambda item: (item[0], item[2]))

    print("| tokens~ | kind | note |")
    print("| --- | --- | --- |")
    for tokens, kind, note in rows[: args.limit]:
        print(f"| {tokens} | {kind} | {note} |")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
