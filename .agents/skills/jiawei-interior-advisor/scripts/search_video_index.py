#!/usr/bin/env python3
"""Search the Jiawei renovation video index by user need.

The index stores source text for local retrieval. Default output returns only
short snippets so answers can cite videos without reproducing full transcripts.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from typing import Any


SKILL_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_INDEX = os.path.join(SKILL_DIR, "references", "video_index.jsonl")


KEYWORD_GROUPS = [
    ("净水器", ["净水器", "净水", "直饮", "反渗透", "ro", "tds", "通量", "滤芯", "纯水", "矿泉水"]),
    ("燃气热水器", ["燃气热水器", "热水器", "零冷水", "水压", "升数", "防冻", "回水", "燃气"]),
    ("油烟机", ["油烟机", "烟机", "吸油烟", "风量", "风压", "静压", "止逆阀"]),
    ("燃气灶", ["燃气灶", "灶具", "灶台", "火力", "热效率", "熄火保护"]),
    ("冰箱", ["冰箱", "制冷", "冷冻", "冷藏", "嵌入式冰箱", "散热"]),
    ("洗衣机", ["洗衣机", "烘干机", "洗烘", "滚筒", "波轮", "热泵"]),
    ("电视", ["电视", "屏幕", "刷新率", "峰值亮度", "背光", "客厅电视"]),
    ("空调", ["空调", "中央空调", "风管机", "挂机", "柜机", "新风"]),
    ("洗碗机", ["洗碗机", "嵌入式洗碗机", "水槽洗碗机", "套数"]),
    ("智能锁", ["智能锁", "门锁", "指纹锁", "锁体", "猫眼"]),
    ("马桶", ["马桶", "智能马桶", "坐便", "坑距", "虹吸", "直冲"]),
    ("花洒", ["花洒", "淋浴", "恒温花洒", "喷枪"]),
    ("浴室柜", ["浴室柜", "洗手盆", "台盆", "镜柜", "浴室镜"]),
    ("地漏", ["地漏", "返味", "防臭", "排水", "下水"]),
    ("防水", ["防水", "闭水", "漏水", "卫生间防水", "二次排水"]),
    ("瓷砖", ["瓷砖", "地砖", "墙砖", "柔光砖", "木纹砖", "通铺", "空鼓"]),
    ("美缝", ["美缝", "环氧彩砂", "聚脲", "真瓷胶", "勾缝"]),
    ("乳胶漆", ["乳胶漆", "墙漆", "底漆", "面漆", "色号", "环保漆"]),
    ("木门", ["木门", "卧室门", "门套", "门芯", "合页", "静音门"]),
    ("地板", ["地板", "木地板", "强化地板", "实木复合", "地暖地板"]),
    ("窗", ["窗", "窗户", "断桥铝", "系统窗", "玻璃", "密封"]),
    ("橱柜", ["橱柜", "厨房柜", "台面", "吊柜", "地柜", "洗菜盆", "水槽"]),
    ("全屋定制", ["全屋定制", "定制柜", "衣柜", "鞋柜", "餐边柜", "柜门", "柜体", "五金", "封边"]),
    ("水电", ["水电", "电线", "电路", "插座", "开关", "水管", "改水改电"]),
    ("吊顶", ["吊顶", "石膏板", "双眼皮", "无主灯", "灯槽"]),
    ("报价合同", ["报价", "合同", "装修公司", "半包", "全包", "增项", "套餐", "同等品牌", "按现场实际"]),
    ("装修顺序", ["装修顺序", "流程", "开工", "拆改", "瓦工", "木工", "油工", "验收"]),
    ("预算省钱", ["预算", "省钱", "性价比", "品牌", "加钱", "智商税"]),
]


STOPWORDS = {
    "怎么",
    "如何",
    "什么",
    "推荐",
    "装修",
    "购买",
    "想买",
    "选择",
    "避坑",
    "原因",
    "视频",
    "链接",
}

ROUGH_WORD_PATTERNS = [
    "\u9e21\u5df4",
    "\u903c",
    r"掏[^，。,.]{0,6}裆[^，。,.]{0,4}",
    r"掏裆",
    r"狗都不使",
    r"狗东西",
]


def normalize(value: Any) -> str:
    text = "" if value is None else str(value)
    text = text.replace("\u3000", " ")
    text = re.sub(r"\s+", " ", text)
    return text.strip().lower()


def extract_query_terms(query: str) -> list[str]:
    normalized = normalize(query)
    terms: set[str] = set()

    for canonical, aliases in KEYWORD_GROUPS:
        if canonical.lower() in normalized or any(alias.lower() in normalized for alias in aliases):
            terms.add(canonical.lower())
            terms.update(alias.lower() for alias in aliases)

    for token in re.findall(r"[a-zA-Z0-9]+|[\u4e00-\u9fff]{2,}", normalized):
        if token not in STOPWORDS:
            terms.add(token)

    return sorted(terms, key=lambda item: (-len(item), item))


def load_entries(path: str) -> list[dict[str, Any]]:
    entries: list[dict[str, Any]] = []
    with open(path, "r", encoding="utf-8") as handle:
        for line_number, line in enumerate(handle, 1):
            line = line.strip()
            if not line:
                continue
            try:
                entries.append(json.loads(line))
            except json.JSONDecodeError as exc:
                raise SystemExit(f"Bad JSONL at {path}:{line_number}: {exc}") from exc
    return entries


def score_entry(entry: dict[str, Any], terms: list[str], query: str) -> tuple[float, list[str]]:
    title = normalize(entry.get("title"))
    text = normalize(entry.get("source_text"))
    keywords = [normalize(item) for item in entry.get("keywords", [])]
    categories = [normalize(item) for item in entry.get("categories", [])]
    haystack = f"{title} {text}"
    reasons: list[str] = []
    score = 0.0

    for term in terms:
        term_score = 0.0
        if term in title:
            term_score += 12.0
        if term in keywords:
            term_score += 9.0
        if term in categories:
            term_score += 7.0
        count = haystack.count(term)
        if count:
            term_score += min(8.0, count * 1.5)
        if term_score:
            score += term_score
            if len(reasons) < 6:
                reasons.append(term)

    q = normalize(query)
    if q and q in haystack:
        score += 16.0
        reasons.insert(0, q)

    if title and any(term in title for term in terms):
        score += 3.0

    return score, reasons


def make_snippet(text: str, terms: list[str], width: int = 180) -> str:
    clean = re.sub(r"\s+", " ", text or "").strip()
    if len(clean) <= width:
        return sanitize_snippet(clean)

    lower = clean.lower()
    hits = [lower.find(term) for term in terms if term and lower.find(term) >= 0]
    pos = min(hits) if hits else 0
    start = max(0, pos - width // 3)
    end = min(len(clean), start + width)
    start = max(0, end - width)
    snippet = clean[start:end].strip()
    if start:
        snippet = "..." + snippet
    if end < len(clean):
        snippet += "..."
    return sanitize_snippet(snippet)


def sanitize_snippet(text: str) -> str:
    sanitized = text
    for pattern in ROUGH_WORD_PATTERNS:
        sanitized = re.sub(pattern, "[口头语]", sanitized, flags=re.IGNORECASE)
    return sanitized


def unique(items: list[str]) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for item in items:
        if item in seen:
            continue
        seen.add(item)
        result.append(item)
    return result


def search(index_path: str, query: str, limit: int, include_source: bool) -> list[dict[str, Any]]:
    entries = load_entries(index_path)
    terms = extract_query_terms(query)
    scored: list[tuple[float, int, dict[str, Any], list[str]]] = []

    for entry in entries:
        score, reasons = score_entry(entry, terms, query)
        if score <= 0:
            continue
        scored.append((score, int(entry.get("row", 0) or 0), entry, reasons))

    scored.sort(key=lambda item: (-item[0], item[1]))
    results: list[dict[str, Any]] = []
    for score, _row, entry, reasons in scored[:limit]:
        result = {
            "row": entry.get("row"),
            "title": entry.get("title"),
            "link": entry.get("link"),
            "categories": entry.get("categories", []),
            "keywords": entry.get("keywords", [])[:12],
            "match_terms": unique(reasons),
            "score": round(score, 2),
            "snippet": make_snippet(entry.get("source_text", ""), terms),
        }
        if include_source:
            result["source_text"] = entry.get("source_text", "")
        results.append(result)

    return results


def main() -> int:
    parser = argparse.ArgumentParser(description="Search Jiawei renovation video index.")
    parser.add_argument("--query", required=True, help="User renovation need, e.g. 燃气热水器怎么选")
    parser.add_argument("--limit", type=int, default=5, help="Maximum matches to return")
    parser.add_argument("--index", default=DEFAULT_INDEX, help="Path to video_index.jsonl")
    parser.add_argument("--json", action="store_true", help="Print JSON instead of Markdown")
    parser.add_argument("--show-source", action="store_true", help="Include full local source text in JSON output")
    args = parser.parse_args()

    results = search(args.index, args.query, max(1, args.limit), args.show_source)

    if args.json:
        json.dump(results, sys.stdout, ensure_ascii=False, indent=2)
        sys.stdout.write("\n")
        return 0

    if not results:
        print("No direct video match found.")
        return 1

    for idx, item in enumerate(results, 1):
        terms = "、".join(item["match_terms"][:5]) or "related"
        print(f"{idx}. row {item['row']} | {item['title']}")
        print(f"   link: {item['link']}")
        print(f"   why: matched {terms}")
        print(f"   snippet: {item['snippet']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
