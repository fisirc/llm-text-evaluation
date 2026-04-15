#!/usr/bin/env python3
"""Add unique 'id' property to each exercise in output JSON files."""

import json
from pathlib import Path

OUTPUT_DIR = Path("./output")


def add_ids_to_file(json_file: Path) -> tuple[int, int]:
    """Add 'id' property to each exercise. Returns (total, added)."""
    with open(json_file, "r", encoding="utf-8") as f:
        exercises = json.load(f)

    if not isinstance(exercises, list):
        exercises = [exercises]

    total = len(exercises)
    added = 0

    for idx, ex in enumerate(exercises):
        if isinstance(ex, dict):
            if "id" not in ex:
                ex["id"] = idx
                added += 1
            elif ex["id"] != idx:
                # Fix incorrect id
                ex["id"] = idx
                added += 1

    with open(json_file, "w", encoding="utf-8") as f:
        json.dump(exercises, f, ensure_ascii=False, indent=2)

    return total, added


def main():
    if not OUTPUT_DIR.exists():
        print("❌ Output directory does not exist")
        return

    json_files = list(OUTPUT_DIR.rglob("*.json"))

    if not json_files:
        print("❌ No JSON files found in output directory")
        return

    print("=" * 60)
    print("🔢 ADDING IDs TO EXERCISES")
    print("=" * 60)

    total_exercises = 0
    total_added = 0
    files_modified = 0

    for json_file in sorted(json_files):
        try:
            total, added = add_ids_to_file(json_file)
            total_exercises += total
            total_added += added

            if added > 0:
                files_modified += 1
                rel_path = str(json_file.relative_to(OUTPUT_DIR))
                print(f"  ✓ {rel_path}: {added}/{total} ids added")

        except Exception as e:
            print(f"  ✗ {json_file}: {e}")

    print("\n" + "-" * 60)
    print("📊 SUMMARY")
    print("-" * 60)
    print(f"  Total files: {len(json_files)}")
    print(f"  Files modified: {files_modified}")
    print(f"  Total exercises: {total_exercises}")
    print(f"  IDs added/fixed: {total_added}")
    print("\n" + "=" * 60)
    print("✅ Done!")


if __name__ == "__main__":
    main()
