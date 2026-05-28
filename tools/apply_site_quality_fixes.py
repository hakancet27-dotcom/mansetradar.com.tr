"""
Site kalite düzeltme aracı.

Ne işe yarar?
- Denetimde yakalanan güvenli ve mekanik HTML sorunlarını düzeltir.
- UTF-8 mojibake izlerini onarır, tekrar eden yorum bloklarını teke indirir,
  haber paylaşım ikonlarını SVG yapar, breadcrumb schema ekler, bozuk ilgili
  haber linklerini temizler ve gereksiz ikinci H1 başlıklarını H2'ye indirir.

İş akışı:
1. Bu dosya `site_edit/tools/` içinde çalışır ve sadece site dosyalarını düzenler.
2. Editoryal karar gerektiren kategori değişikliklerini otomatik yapmaz.
3. Yayındaki dosyaları değiştirmeden önce ayrıca yerel yedek alınmalıdır.
4. Düzeltmelerden sonra `site_quality_audit.py` tekrar çalıştırılarak sonuç
   kontrol edilir.

Kullanım:
    python tools/apply_site_quality_fixes.py
"""

import json
import re
from pathlib import Path


SITE_URL = "https://mansetradar.com.tr"
ROOT = Path(__file__).resolve().parents[1]

MOJIBAKE_REPLACEMENTS = {
    "Ã¼": "ü", "Ãœ": "Ü", "Ã¶": "ö", "Ã–": "Ö", "Ã§": "ç", "Ã‡": "Ç",
    "Ä±": "ı", "Ä°": "İ", "ÄŸ": "ğ", "Äž": "Ğ", "ÅŸ": "ş", "Åž": "Ş",
    "Ã¢": "â", "Ã‚": "Â", "Ã®": "î", "Ã¯": "ï", "Ã©": "é", "Ã¨": "è",
    "Ã¡": "á", "Ã­": "í", "Ã³": "ó", "Ãº": "ú", "Ã±": "ñ", "Ã¤": "ä",
    "Ã„": "Ä", "ÃŸ": "ß", "â€™": "’", "â€˜": "‘", "â€œ": "“",
    "â€�": "”", "â€“": "–", "â€”": "—", "â€¦": "…", "â†’": "→",
    "â†": "←", "Â·": "·", "Â©": "©", "Â°": "°", "Â ": " ",
}

SHARE_SVGS = {
    "x": '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4l14 16M19 4L5 20"/></svg>',
    "facebook": '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 8h2V4h-2c-3 0-5 2-5 5v2H7v4h2v5h4v-5h3l1-4h-4V9c0-.6.4-1 1-1z"/></svg>',
    "whatsapp": '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 19l1.2-3.4A7 7 0 1 1 9 18.4L5 19z"/><path d="M9.5 8.8c.3-.5.6-.5.9-.2l.7 1c.2.3.2.6 0 .9l-.3.4c.5.9 1.2 1.6 2.2 2.1l.5-.4c.3-.2.6-.2.9 0l1 .7c.3.2.3.6.1.9-.4.7-1 1-1.8.8-2.7-.6-4.6-2.5-5.3-5.1-.2-.5.1-1 .5-1.1z"/></svg>',
    "telegram": '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 5L4 11.5l5.8 2.1L12 19l3-4.2 4.2-8.9z"/><path d="M9.8 13.6L20 5"/></svg>',
    "instagram": '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="5" width="14" height="14" rx="4"/><circle cx="12" cy="12" r="3.2"/><circle cx="16.4" cy="7.6" r="1"/></svg>',
    "youtube": '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="6" width="18" height="12" rx="3"/><path d="M10 9l5 3-5 3z"/></svg>',
}


def safe_write(path: Path, content: str):
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(content, encoding="utf-8", newline="")
    tmp.replace(path)


def repair_mojibake(content: str) -> str:
    for bad, good in MOJIBAKE_REPLACEMENTS.items():
        content = content.replace(bad, good)
    return content


def replace_icon_for_class(content: str, class_name: str, svg_key: str) -> str:
    pattern = re.compile(
        rf'(<a\b(?=[^>]*class=["\'][^"\']*\b{re.escape(class_name)}\b[^"\']*["\'])[^>]*>)([\s\S]*?)(</a>)',
        flags=re.IGNORECASE,
    )
    return pattern.sub(lambda m: f"{m.group(1)}{SHARE_SVGS[svg_key]}{m.group(3)}", content)


def replace_share_icons(content: str) -> str:
    replacements = [
        ("share-x", "x"),
        ("share-fb", "facebook"),
        ("share-wa", "whatsapp"),
        ("share-tg", "telegram"),
        ("social-x", "x"),
        ("social-ig", "instagram"),
        ("social-yt", "youtube"),
        ("social-tg", "telegram"),
    ]
    for class_name, svg_key in replacements:
        content = replace_icon_for_class(content, class_name, svg_key)
    if ".share-btn svg" not in content:
        content = content.replace(
            ".share-btn {",
            ".share-btn svg, .share-link svg, .social-link svg { width:15px; height:15px; fill:currentColor; stroke:currentColor; stroke-width:2; }\n    .share-btn {",
        )
    return content


def dedupe_comment_sections(content: str) -> str:
    pattern = re.compile(
        r'<section\b(?=[^>]*class=["\'][^"\']*\barticle-comments\b[^"\']*["\'])[^>]*>[\s\S]*?</section>',
        flags=re.IGNORECASE,
    )
    matches = list(pattern.finditer(content))
    if len(matches) <= 1:
        return content

    keep = matches[0].group(0)
    content = pattern.sub("", content)
    return content.replace("</article>", f"{keep}\n    </article>", 1)


def article_section_for_path(path: Path):
    rel = path.relative_to(ROOT).as_posix()
    if rel.startswith("news/articles/"):
        return "US News", f"{SITE_URL}/news/"
    if rel.startswith("nachrichten/artikel/"):
        return "Deutschland Nachrichten", f"{SITE_URL}/nachrichten/"
    if rel.startswith("articles/"):
        return "Haberler", f"{SITE_URL}/haber"
    return None


def scope_for_path(path: Path) -> str:
    rel = path.relative_to(ROOT).as_posix()
    if rel.startswith("news/articles/"):
        return "news/articles"
    if rel.startswith("nachrichten/artikel/"):
        return "nachrichten/artikel"
    if rel.startswith("articles/"):
        return "articles"
    return rel.rsplit("/", 1)[0] if "/" in rel else "."


def normalize_key(value: str) -> str:
    value = re.sub(r"<[^>]+>", " ", value or "")
    value = re.sub(r"[^0-9A-Za-zÇĞİÖŞÜçğıöşüÄÖÜäöüß]+", " ", value).casefold()
    return re.sub(r"\s+", " ", value).strip()


def extract_first(pattern: str, content: str):
    match = re.search(pattern, content, flags=re.IGNORECASE)
    return re.sub(r"\s+", " ", match.group(1)).strip() if match else ""


def add_breadcrumb_schema(path: Path, content: str) -> str:
    if "BreadcrumbList" in content:
        return content
    section = article_section_for_path(path)
    if not section or "</head>" not in content:
        return content

    title = extract_first(r"<h1\b[^>]*>([\s\S]*?)</h1>", content) or path.stem
    title = re.sub(r"<[^>]+>", "", title)
    canonical = extract_first(r'<link\b[^>]*rel=["\']canonical["\'][^>]*href=["\']([^"\']+)["\']', content)
    if not canonical:
        rel = path.relative_to(ROOT).as_posix()
        canonical = f"{SITE_URL}/{rel}"
    section_name, section_url = section
    schema = {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": [
            {"@type": "ListItem", "position": 1, "name": "mansetradar.com.tr", "item": SITE_URL},
            {"@type": "ListItem", "position": 2, "name": section_name, "item": section_url},
            {"@type": "ListItem", "position": 3, "name": title, "item": canonical},
        ],
    }
    script = (
        '  <script type="application/ld+json">'
        + json.dumps(schema, ensure_ascii=False).replace("</", "<\\/")
        + "</script>\n"
    )
    return content.replace("</head>", script + "</head>", 1)


def demote_extra_h1(content: str) -> str:
    matches = list(re.finditer(r"<h1\b[^>]*>[\s\S]*?</h1>", content, flags=re.IGNORECASE))
    if len(matches) <= 1:
        return content

    first_end = matches[0].end()

    def replace_extra(match):
        if match.start() < first_end:
            return match.group(0)
        inner = re.sub(r"^<h1\b[^>]*>|</h1>$", "", match.group(0), flags=re.IGNORECASE)
        return f"<h2>{inner}</h2>"

    return re.sub(r"<h1\b[^>]*>[\s\S]*?</h1>", replace_extra, content, flags=re.IGNORECASE)


def add_index_heading_bridge(content: str) -> str:
    if "showcase-heading-bridge" in content:
        return content
    if "showcase-title" not in content:
        return content
    content = re.sub(
        r'(<h1\b[^>]*class=["\'][^"\']*\bshowcase-title\b[^"\']*["\'][^>]*>[\s\S]*?</h1>)',
        r'\1\n            <h2 class="visually-hidden showcase-heading-bridge">Manşet haberler</h2>',
        content,
        count=1,
        flags=re.IGNORECASE,
    )
    if ".visually-hidden" not in content:
        content = content.replace(
            "</style>",
            "    .visually-hidden { position:absolute; width:1px; height:1px; padding:0; margin:-1px; overflow:hidden; clip:rect(0,0,0,0); white-space:nowrap; border:0; }\n  </style>",
            1,
        )
    return content


def absolute_url(path: Path) -> str:
    return f"{SITE_URL}/{path.relative_to(ROOT).as_posix()}"


def mark_duplicate_title_pages(summary: dict[str, list[str]]):
    groups = {}
    paths = [
        *sorted((ROOT / "articles").glob("*.html")),
        *sorted((ROOT / "news" / "articles").glob("*.html")),
        *sorted((ROOT / "nachrichten" / "artikel").glob("*.html")),
    ]
    for path in paths:
        content = path.read_text(encoding="utf-8", errors="replace")
        if 'name="robots" content="noindex' in content.lower():
            continue
        title = extract_first(r"<h1\b[^>]*>([\s\S]*?)</h1>", content) or extract_first(r"<title\b[^>]*>([\s\S]*?)</title>", content)
        key = normalize_key(title)
        if key:
            groups.setdefault((scope_for_path(path), key), []).append(path)

    for (_scope, _key), duplicates in groups.items():
        if len(duplicates) < 2:
            continue
        keep = sorted(duplicates, key=lambda item: (len(item.name), item.name))[0]
        keep_url = absolute_url(keep)
        for path in duplicates:
            if path == keep:
                continue
            content = path.read_text(encoding="utf-8", errors="replace")
            original = content
            if 'name="robots"' not in content.lower():
                content = content.replace(
                    '<meta name="viewport" content="width=device-width, initial-scale=1.0">',
                    '<meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <meta name="robots" content="noindex,follow">',
                    1,
                )
            if re.search(r'<link\b[^>]*rel=["\']canonical["\']', content, flags=re.IGNORECASE):
                content = re.sub(
                    r'<link\b[^>]*rel=["\']canonical["\'][^>]*>',
                    f'<link rel="canonical" href="{keep_url}">',
                    content,
                    count=1,
                    flags=re.IGNORECASE,
                )
            else:
                content = content.replace("</head>", f'  <link rel="canonical" href="{keep_url}">\n</head>', 1)
            if content != original:
                safe_write(path, content)
                summary.setdefault(str(path.relative_to(ROOT)), []).append("duplicate-noindex")


def remove_broken_related_cards(path: Path, content: str) -> str:
    def card_replacer(match):
        card = match.group(0)
        href_match = re.search(r'href=["\']([^"\']+)["\']', card, flags=re.IGNORECASE)
        if not href_match:
            return card
        href = href_match.group(1)
        if href.startswith(("http://", "https://", "mailto:", "tel:", "#")) or "${" in href:
            return card
        target = (path.parent / href.split("#", 1)[0].split("?", 1)[0]).resolve()
        try:
            target.relative_to(ROOT.resolve())
        except ValueError:
            return ""
        return card if target.exists() else ""

    updated = re.sub(
        r'<article\b(?=[^>]*class=["\'][^"\']*\brelated-card\b[^"\']*["\'])[^>]*>[\s\S]*?</article>',
        card_replacer,
        content,
        flags=re.IGNORECASE,
    )
    updated = re.sub(
        r'<section\b(?=[^>]*class=["\'][^"\']*\brelated-news\b[^"\']*["\'])[^>]*>\s*<h2\b[^>]*>[\s\S]*?</h2>\s*<div\b[^>]*class=["\'][^"\']*\brelated-grid\b[^"\']*["\'][^>]*>\s*</div>\s*</section>',
        "",
        updated,
        flags=re.IGNORECASE,
    )
    return updated


def fix_slider_interval(content: str) -> str:
    return re.sub(
        r"setInterval\(\(\) => showSlide\(current \+ 1\),\s*6500\)",
        "setInterval(() => showSlide(current + 1), 3000)",
        content,
    )


def process_html(path: Path) -> list[str]:
    original = path.read_text(encoding="utf-8")
    content = original
    applied = []

    updated = repair_mojibake(content)
    if updated != content:
        content = updated
        applied.append("utf8")

    updated = replace_share_icons(content)
    if updated != content:
        content = updated
        applied.append("share-svg")

    updated = dedupe_comment_sections(content)
    if updated != content:
        content = updated
        applied.append("comment-dedupe")

    updated = add_breadcrumb_schema(path, content)
    if updated != content:
        content = updated
        applied.append("breadcrumb")

    updated = demote_extra_h1(content)
    if updated != content:
        content = updated
        applied.append("h1-demote")

    updated = add_index_heading_bridge(content)
    if updated != content:
        content = updated
        applied.append("heading-bridge")

    updated = remove_broken_related_cards(path, content)
    if updated != content:
        content = updated
        applied.append("related-link-clean")

    updated = fix_slider_interval(content)
    if updated != content:
        content = updated
        applied.append("slider-3000")

    if content != original:
        safe_write(path, content)
    return applied


def process_json(path: Path) -> list[str]:
    original = path.read_text(encoding="utf-8")
    content = repair_mojibake(original)
    if content != original:
        safe_write(path, content)
        return ["utf8"]
    return []


def main():
    summary = {}
    html_targets = [
        ROOT / "haber.html",
        ROOT / "news" / "index.html",
        ROOT / "nachrichten" / "index.html",
        *sorted((ROOT / "articles").glob("*.html")),
        *sorted((ROOT / "news" / "articles").glob("*.html")),
        *sorted((ROOT / "nachrichten" / "artikel").glob("*.html")),
    ]
    for path in html_targets:
        if not path.exists():
            continue
        applied = process_html(path)
        if applied:
            summary[str(path.relative_to(ROOT))] = applied
    for path in sorted(ROOT.rglob("*.json")):
        if any(part in {".git", "admin", "reports"} for part in path.parts):
            continue
        applied = process_json(path)
        if applied:
            summary[str(path.relative_to(ROOT))] = applied

    mark_duplicate_title_pages(summary)

    report_path = ROOT / "reports" / "site-quality-fixes.json"
    report_path.parent.mkdir(exist_ok=True)
    safe_write(report_path, json.dumps(summary, ensure_ascii=False, indent=2))
    print(json.dumps({"changed_files": len(summary), "report": str(report_path)}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()

