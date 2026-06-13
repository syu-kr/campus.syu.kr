"""Validate repository Python scripts without creating bytecode files."""

from __future__ import annotations

import ast
from pathlib import Path


def main() -> None:
    scripts = sorted(Path("scripts").glob("*.py"))
    if not scripts:
        raise RuntimeError("No Python scripts found")

    for script in scripts:
        source = script.read_text(encoding="utf-8-sig")
        ast.parse(source, filename=str(script))

    print(f"Validated {len(scripts)} Python scripts")


if __name__ == "__main__":
    main()
