#!/usr/bin/env python3
"""Build the Jiawei video retrieval index from a lark-cli sheets export."""

from __future__ import annotations

import argparse
import json
import os
import re
from collections import Counter
from typing import Any

from search_video_index import KEYWORD_GROUPS


SKILL_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_OUTPUT = os.path.join(SKILL_DIR, "references", "video_index.jsonl")
DEFAULT_MANIFEST = os.path.join(SKILL_DIR, "references", "video_index_manifest.json")


CATEGORY_BY_KEYWORD = {
    "净水器": "家电",
    "燃气热水器": "家电",
    "油烟机": "家电",
    "燃气灶": "家电",
    "冰箱": "家电",
    "洗衣机": "家电",
    "电视": "家电",
    "空调": "家电",
    "洗碗机": "家电",
    "智能锁": "家电",
    "马桶": "卫生间",
    "花洒": "卫生间",
    "浴室柜": "卫生间",
    "地漏": "卫生间",
    "防水": "卫生间",
    "瓷砖": "材料",
    "美缝": "材料",
    "乳胶漆": "材料",
    "木门": "材料",
    "地板": "材料",
    "窗": "门窗",
    "橱柜": "厨房",
    "全屋定制": "全屋定制",
    "水电": "施工",
    "吊顶": "施工",
    "报价合同": "预算合同",
    "装修顺序": "施工",
    "预算省钱": "预算合同",
}


def clean(value: Any) -> str:
    return re.sub(r"[ \t]+", " ", str(value or "").replace("\r\n", "\n")).strip()


def first_text(text: str, size: int = 260) -> str:
    flat = re.sub(r"\s+", " ", text).strip()
    return flat[:size] + "..." if len(flat) > size else flat


def extract_hashtags(title: str) -> list[str]:
    return [match.group(1) for match in re.finditer(r"#([^#\s]+)", title)]


def build_entries(values: list[list[Any]]) -> list[dict[str, Any]]:
    entries: list[dict[str, Any]] = []

    for index, row_values in enumerate(values):
        row = index + 2
        title = clean(row_values[0] if len(row_values) > 0 else "")
        link = clean(row_values[1] if len(row_values) > 1 else "")
        source_text = clean(row_values[2] if len(row_values) > 2 else "")

        if not re.match(r"^https?://www\.douyin\.com/video/", link) or not source_text:
            continue

        haystack = f"{title}\n{source_text}".lower()
        categories: set[str] = set()
        keywords: set[str] = set(extract_hashtags(title))

        for canonical, aliases in KEYWORD_GROUPS:
            matched = False
            for alias in aliases:
                if alias.lower() in haystack:
                    matched = True
                    keywords.add(alias)
            if matched:
                categories.add(CATEGORY_BY_KEYWORD.get(canonical, "装修避坑"))
                keywords.add(canonical)

        if not categories:
            categories.add("装修避坑")
        keywords.add("装修避坑")

        entries.append(
            {
                "row": row,
                "title": title,
                "link": link,
                "categories": sorted(categories),
                "keywords": sorted(keywords, key=lambda item: (-len(item), item))[:40],
                "source_summary": first_text(source_text),
                "source_text": source_text,
            }
        )

    return entries


def main() -> int:
    parser = argparse.ArgumentParser(description="Build jiawei-interior-advisor video index.")
    parser.add_argument("--input", required=True, help="lark-cli sheets +read JSON export")
    parser.add_argument("--output", default=DEFAULT_OUTPUT)
    parser.add_argument("--manifest", default=DEFAULT_MANIFEST)
    parser.add_argument("--source-url", default="https://bytedance.larkoffice.com/sheets/JBQEsQTdMhhpi1tMZvUcAPmKn7e")
    parser.add_argument("--sheet-id", default="0yZLsi")
    args = parser.parse_args()

    with open(args.input, "r", encoding="utf-8") as handle:
        payload = json.load(handle)

    values = payload.get("data", {}).get("valueRange", {}).get("values", [])
    entries = build_entries(values)

    os.makedirs(os.path.dirname(args.output), exist_ok=True)
    with open(args.output, "w", encoding="utf-8") as handle:
        for entry in entries:
            handle.write(json.dumps(entry, ensure_ascii=False, separators=(",", ":")) + "\n")

    category_counts = Counter(category for entry in entries for category in entry["categories"])
    manifest = {
        "source_url": args.source_url,
        "sheet_id": args.sheet_id,
        "source_range": payload.get("data", {}).get("valueRange", {}).get("range"),
        "revision": payload.get("data", {}).get("revision")
        or payload.get("data", {}).get("valueRange", {}).get("revision"),
        "generated_from_columns": {
            "C": "title/description",
            "D": "Douyin video URL",
            "E": "extracted video copy",
        },
        "usable_rows": len(entries),
        "first_row": entries[0]["row"] if entries else None,
        "last_row": entries[-1]["row"] if entries else None,
        "category_counts": dict(category_counts.most_common()),
        "note": (
            "Local retrieval index for jiawei-interior-advisor. Do not reproduce full "
            "source_text in user answers; use it to summarize, recommend, and cite the "
            "D-column video link."
        ),
    }
    with open(args.manifest, "w", encoding="utf-8") as handle:
        json.dump(manifest, handle, ensure_ascii=False, indent=2)
        handle.write("\n")

    print(json.dumps({"usable_rows": len(entries), "output": args.output, "manifest": args.manifest}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
