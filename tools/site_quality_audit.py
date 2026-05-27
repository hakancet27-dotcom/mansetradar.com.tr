"""
Site kalite denetim aracı.

Ne işe yarar?
- Yayındaki HTML/JSON haber dosyalarını ve bazı canlı URL'leri okur.
- UTF-8 bozulması, kırık link, kopya başlık/içerik, hatalı kategori,
  H etiket hiyerarşisi, yorum alanı tekrarı, eski paylaşım ikonları,
  schema eksikleri, manşet/mobil/üyelik UX riskleri ve yönlendirme durumlarını raporlar.

Katı kural:
- Bu araç site dosyalarını değiştirmez, düzeltme uygulamaz, içerik taşımaz.
- Tek yazdığı yer `reports/` klasörüdür; workflow bunu artifact olarak saklar.

İş akışı:
1. GitHub Actions veya yerelden `python tools/site_quality_audit.py` ile çalışır.
2. Site kökündeki ana sayfaları, haber listelerini, makale HTML/JSON dosyalarını okur.
3. Canlı sitede seçili URL'lerin 200/301 davranışını kontrol eder.
4. `reports/site-quality-audit.json` ve `reports/site-quality-audit.md` üretir.
"""

from __future__ import annotations

import hashlib
import json
import re
import urllib.error
import urllib.request
from collections import Counter, defaultdict
from html import unescape
from pathlib import Path
from typing import Any
from urllib.parse import unquote, urlparse


ROOT = Path(__file__).resolve().parents[1]
REPORT_DIR = ROOT / "reports"
SITE_ORIGIN = "https://hakancetin.com.tr"

HTML_ROOTS = [
    ROOT / "index.html",
    ROOT / "haber.html",
    ROOT / "haber" / "index.html",
    ROOT / "news" / "index.html",
    ROOT / "nachrichten" / "index.html",
    *sorted((ROOT / "articles").glob("*.html")),
    *sorted((ROOT / "news" / "articles").glob("*.html")),
    *sorted((ROOT / "nachrichten" / "artikel").glob("*.html")),
]
JSON_ROOTS = [
    *sorted((ROOT / "articles").glob("*.json")),
    *sorted((ROOT / "news" / "articles").glob("*.json")),
    *sorted((ROOT / "nachrichten" / "artikel").glob("*.json")),
    *sorted((ROOT / "review" / "pending").glob("*.json")),
]

MOJIBAKE_RE = re.compile(
    r"(Ã.|Ä[^\s<]{0,3}|Å[^\s<]{0,3}|Â[^\s<]{0,3}|â(?:€|„|œ||†|™|œ|”|“|’|‘|¦|€¦|†’|†)|�)"
)
TAG_RE = re.compile(r"<(/?)(h[1-6])\b[^>]*>", re.IGNORECASE)
HREF_RE = re.compile(r"\b(?:href|src)=['\"]([^'\"]+)['\"]", re.IGNORECASE)
COMMENT_SECTION_RE = re.compile(
    r"<section\b[^>]*class=['\"][^'\"]*article-comments[^'\"]*['\"][\s\S]*?</section>",
    re.IGNORECASE,
)
SCRIPT_RE = re.compile(r"<script[\s\S]*?</script>", re.IGNORECASE)
STYLE_RE = re.compile(r"<style[\s\S]*?</style>", re.IGNORECASE)
TAG_STRIP_RE = re.compile(r"<[^>]+>")
JSONLD_RE = re.compile(
    r"<script\b[^>]*type=['\"]application/ld\+json['\"][^>]*>([\s\S]*?)</script>",
    re.IGNORECASE,
)

CATEGORY_KEYWORDS = {
    "Son Dakika": ["son dakika", "acil", "patlama", "saldırı", "saldiri", "öldü", "deprem"],
    "Gündem": ["gündem", "gundem", "belediye", "mahkeme", "soruşturma", "trafik", "kaza"],
    "Siyaset": ["başkan", "bakan", "erdoğan", "trump", "putin", "seçim", "meclis", "parti", "hükümet", "koalisyon"],
    "Ekonomi": ["ekonomi", "piyasa", "faiz", "enflasyon", "dolar", "euro", "borsa", "petrol", "vergi", "ticaret", "şirket"],
    "Dünya": ["abd", "iran", "israil", "rusya", "çin", "china", "germany", "ukraine", "gazze", "nato", "avrupa", "suriye"],
    "Spor": ["spor", "futbol", "basketbol", "maç", "mac", "liga", "world cup", "kupası", "transfer"],
    "Magazin": ["magazin", "sanatçı", "ünlü", "festival", "film", "müzik", "eurovision", "oyuncu"],
    "Teknoloji": ["teknoloji", "yapay zeka", "ai", "openai", "çip", "chip", "robot", "yazılım"],
    "Sağlık": ["sağlık", "saglik", "virüs", "virus", "ebola", "hastalık", "hastane", "salgın", "vaccine"],
    "Video": ["video", "youtube", "kanal"],
}

LIVE_URL_EXPECTATIONS = [
    {"url": f"{SITE_ORIGIN}/haber.html", "statuses": [301, 302], "location_contains": "/haber"},
    {"url": f"{SITE_ORIGIN}/haber", "statuses": [200]},
    {"url": f"{SITE_ORIGIN}/haber/", "statuses": [200, 301, 302]},
    {"url": f"{SITE_ORIGIN}/news/", "statuses": [200]},
    {"url": f"{SITE_ORIGIN}/nachrichten/", "statuses": [200]},
    *[
        {"url": f"{SITE_ORIGIN}/haber/?kategori={topic}", "statuses": [200]}
        for topic in ["son-dakika", "gundem", "siyaset", "ekonomi", "dunya", "spor", "magazin", "teknoloji", "saglik"]
    ],
]


def rel(path: Path) -> str:
    return str(path.relative_to(ROOT)).replace("\\", "/")


def scope_for_path(path_label: str) -> str:
    if path_label.startswith("news/articles/"):
        return "news/articles"
    if path_label.startswith("nachrichten/artikel/"):
        return "nachrichten/artikel"
    if path_label.startswith("articles/"):
        return "articles"
    return path_label.rsplit("/", 1)[0] if "/" in path_label else "."


def canonical_file_key(path_label: str) -> str:
    if path_label.endswith("/index.html"):
        return path_label.removesuffix("/index.html")
    if path_label.endswith(".html"):
        return path_label.removesuffix(".html")
    return path_label


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8", errors="replace")


def clean_text(value: str) -> str:
    value = SCRIPT_RE.sub(" ", value)
    value = STYLE_RE.sub(" ", value)
    value = TAG_STRIP_RE.sub(" ", value)
    value = unescape(value)
    value = re.sub(r"\s+", " ", value)
    return value.strip()


def normalize_key(value: str) -> str:
    value = clean_text(value).lower()
    value = re.sub(r"[^a-z0-9ığüşöçİĞÜŞÖÇäöüß\s-]", " ", value)
    value = re.sub(r"\s+", " ", value).strip()
    return value


def parse_json(path: Path) -> dict[str, Any]:
    try:
        return json.loads(path.read_text(encoding="utf-8-sig"))
    except Exception as exc:
        return {"__error__": str(exc)}


def html_title(text: str) -> str:
    match = re.search(r"<h1\b[^>]*>([\s\S]*?)</h1>", text, re.IGNORECASE)
    if match:
        return clean_text(match.group(1))
    match = re.search(r"<title\b[^>]*>([\s\S]*?)</title>", text, re.IGNORECASE)
    return clean_text(match.group(1)) if match else ""


def is_article_page(path_label: str) -> bool:
    return path_label.startswith(("articles/", "news/articles/", "nachrichten/artikel/"))


def heading_issues(text: str) -> list[str]:
    headings = [(int(tag[1]), closing) for closing, tag in TAG_RE.findall(text) if not closing]
    h1_count = sum(1 for level, _ in headings if level == 1)
    issues = []
    if h1_count != 1:
        issues.append(f"h1_count={h1_count}")
    previous = 0
    for level, _ in headings:
        if previous and level > previous + 1:
            issues.append(f"heading_skip_h{previous}_to_h{level}")
            break
        previous = level
    return issues


def resolve_internal_link(page: Path, link: str) -> Path | None:
    if not link or link.startswith(("#", "mailto:", "tel:", "javascript:", "data:")):
        return None
    if "${" in link or "}" in link:
        return None
    parsed = urlparse(link)
    if parsed.scheme in {"http", "https"}:
        if parsed.netloc and "hakancetin.com.tr" not in parsed.netloc:
            return None
        raw_path = parsed.path
    else:
        raw_path = link.split("#", 1)[0].split("?", 1)[0]
    raw_path = unquote(raw_path)
    if not raw_path:
        return None
    target = ROOT / raw_path.lstrip("/") if raw_path.startswith("/") else (page.parent / raw_path).resolve()
    try:
        target.relative_to(ROOT)
    except ValueError:
        return None
    if raw_path.endswith("/") or target.is_dir():
        target = target / "index.html"
    return target


def infer_category(data: dict[str, Any]) -> tuple[str, int]:
    text = normalize_key(" ".join([
        str(data.get("title", "")),
        str(data.get("spot", "")),
        str(data.get("summary", "")),
        clean_text(str(data.get("content_html", "")))[:1200],
    ]))
    scores = Counter()
    for category, keywords in CATEGORY_KEYWORDS.items():
        for keyword in keywords:
            if keyword in text:
                scores[category] += 1
    if not scores:
        return "", 0
    return scores.most_common(1)[0]


def slug_for_json(path: Path, data: dict[str, Any]) -> str:
    return str(data.get("slug") or path.stem)


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):  # noqa: N802
        return None


def request_live_url(url: str, follow_redirects: bool) -> dict[str, Any]:
    opener = urllib.request.build_opener() if follow_redirects else urllib.request.build_opener(NoRedirect)
    request = urllib.request.Request(url, headers={"User-Agent": "hakancetin-site-audit/1.0"})
    try:
        with opener.open(request, timeout=12) as response:
            return {"url": url, "status": response.status, "location": response.headers.get("Location", "")}
    except urllib.error.HTTPError as exc:
        return {"url": url, "status": exc.code, "location": exc.headers.get("Location", "")}
    except Exception as exc:
        return {"url": url, "status": None, "location": "", "error": str(exc)}


def check_live_urls() -> list[dict[str, Any]]:
    checks = []
    for expectation in LIVE_URL_EXPECTATIONS:
        follow = not expectation.get("location_contains")
        result = request_live_url(expectation["url"], follow_redirects=follow)
        expected_statuses = expectation["statuses"]
        ok = result.get("status") in expected_statuses
        if ok and expectation.get("location_contains"):
            ok = expectation["location_contains"] in str(result.get("location", ""))
        result["ok"] = ok
        result["expected_statuses"] = expected_statuses
        if expectation.get("location_contains"):
            result["expected_location_contains"] = expectation["location_contains"]
        checks.append(result)
    return checks


def jsonld_blocks(text: str) -> list[Any]:
    blocks = []
    for raw in JSONLD_RE.findall(text):
        cleaned = unescape(raw.strip())
        try:
            blocks.append(json.loads(cleaned))
        except Exception as exc:
            blocks.append({"__error__": str(exc)})
    return blocks


def collect_schema_types(value: Any) -> set[str]:
    found: set[str] = set()
    if isinstance(value, dict):
        raw_type = value.get("@type")
        if isinstance(raw_type, str):
            found.add(raw_type)
        elif isinstance(raw_type, list):
            found.update(str(item) for item in raw_type)
        for child in value.values():
            found.update(collect_schema_types(child))
    elif isinstance(value, list):
        for child in value:
            found.update(collect_schema_types(child))
    return found


def has_image_object(value: Any) -> bool:
    if isinstance(value, dict):
        if value.get("@type") == "ImageObject":
            return bool(value.get("url") or value.get("contentUrl"))
        return any(has_image_object(child) for child in value.values())
    if isinstance(value, list):
        return any(has_image_object(child) for child in value)
    return False


def structured_data_issues(path_label: str, text: str) -> list[dict[str, Any]]:
    blocks = jsonld_blocks(text)
    types: set[str] = set()
    errors = []
    for block in blocks:
        if isinstance(block, dict) and "__error__" in block:
            errors.append(block["__error__"])
        types.update(collect_schema_types(block))
    issues = []
    if errors:
        issues.append({"file": path_label, "issue": "jsonld_parse_error", "examples": errors[:3]})
    if is_article_page(path_label):
        required = {"NewsArticle", "BreadcrumbList", "Organization"}
        missing = sorted(required - types)
        if missing:
            issues.append({"file": path_label, "issue": "missing_article_schema", "missing": missing, "types": sorted(types)})
        if not any(has_image_object(block) for block in blocks):
            issues.append({"file": path_label, "issue": "image_not_imageobject", "types": sorted(types)})
    if path_label in {"index.html", "haber.html", "haber/index.html"}:
        required_home = {"WebSite", "Organization"}
        missing_home = sorted(required_home - types)
        has_search_action = "SearchAction" in types or '"SearchAction"' in text
        if missing_home or not has_search_action:
            issues.append({
                "file": path_label,
                "issue": "missing_home_schema",
                "missing": missing_home + ([] if has_search_action else ["SearchAction"]),
                "types": sorted(types),
            })
    return issues


def homepage_ux_report(path_label: str, text: str) -> dict[str, Any]:
    hero_match = re.search(r"<!--\s*TURKEY_HERO_START\s*-->([\s\S]*?)<!--\s*TURKEY_HERO_END\s*-->", text)
    hero_block = hero_match.group(1) if hero_match else ""
    hero_count = len(re.findall(r'class=["\'][^"\']*headline-slide[^"\']*headline-card[^"\']*["\']', hero_block))
    all_headline_count = len(re.findall(r'class=["\'][^"\']*headline-slide[^"\']*headline-card[^"\']*["\']', text))
    member_script_count = len(re.findall(r'assets/js/member-home-menu\.js', text))
    mobile_market_markup_count = len(re.findall(r'class=["\'][^"\']*mobile-market-strip[^"\']*["\']', text))
    issues = []
    if path_label == "haber/index.html":
        if hero_count != 20:
            issues.append(f"headline_window_expected_20_found_{hero_count}")
        if all_headline_count > hero_count:
            issues.append(f"extra_headline_cards_outside_marker_{all_headline_count - hero_count}")
        if member_script_count != 1:
            issues.append(f"member_home_menu_script_count_{member_script_count}")
        if not re.search(r"autoPausedUntil|pauseAuto|resumeAuto", text):
            issues.append("headline_autoplay_pause_not_detected")
        if "touchstart" not in text and "pointerdown" not in text:
            issues.append("headline_touch_or_pointer_handler_missing")
        if mobile_market_markup_count > 1:
            issues.append(f"mobile_market_markup_duplicate_{mobile_market_markup_count}")
    return {
        "hero_cards_in_marker": hero_count,
        "headline_cards_total": all_headline_count,
        "member_home_menu_scripts": member_script_count,
        "mobile_market_markup": mobile_market_markup_count,
        "issues": issues,
    }


def build_severity(report: dict[str, Any]) -> dict[str, list[Any]]:
    failed_live = [
        item for item in report.get("live_url_checks", [])
        if not item.get("ok") and isinstance(item.get("status"), int)
    ]
    unreachable_live = [
        item for item in report.get("live_url_checks", [])
        if not item.get("ok") and item.get("status") is None
    ]
    critical = []
    critical.extend(report.get("utf8_suspects", []))
    critical.extend(report.get("broken_links", []))
    critical.extend(report.get("json_errors", []))
    critical.extend(report.get("comment_repeats", []))
    critical.extend(report.get("duplicate_slugs", []))
    critical.extend(failed_live)

    warning = []
    warning.extend(report.get("category_mismatches", []))
    warning.extend(report.get("duplicate_titles", []))
    warning.extend(report.get("duplicate_content", []))
    warning.extend(report.get("empty_or_thin_pages", []))
    warning.extend(report.get("heading_issues", []))
    warning.extend(report.get("missing_breadcrumb_schema", []))
    warning.extend(report.get("text_share_icons", []))
    warning.extend(report.get("structured_data_issues", []))
    warning.extend(report.get("homepage_ux_issues", []))
    warning.extend(unreachable_live)

    info = [
        {"slider": report.get("slider", {})},
        {"live_url_checks": report.get("live_url_checks", [])},
    ]
    return {"critical": critical, "warning": warning, "info": info}


def audit() -> dict[str, Any]:
    html_files = [path for path in HTML_ROOTS if path.exists()]
    json_files = [path for path in JSON_ROOTS if path.exists()]
    report: dict[str, Any] = {
        "summary": {"html_files": len(html_files), "json_files": len(json_files)},
        "utf8_suspects": [],
        "broken_links": [],
        "duplicate_titles": [],
        "duplicate_content": [],
        "empty_or_thin_pages": [],
        "category_mismatches": [],
        "heading_issues": [],
        "missing_breadcrumb_schema": [],
        "structured_data_issues": [],
        "homepage_ux_issues": [],
        "comment_repeats": [],
        "text_share_icons": [],
        "slider": {},
        "live_url_checks": [],
        "json_errors": [],
    }

    title_map: dict[tuple[str, str], list[str]] = defaultdict(list)
    content_map: dict[str, list[str]] = defaultdict(list)

    for path in html_files:
        text = read_text(path)
        page_rel = rel(path)
        canonical_key = canonical_file_key(page_rel)
        mojibake = MOJIBAKE_RE.findall(text)
        if mojibake:
            report["utf8_suspects"].append({
                "file": page_rel,
                "count": len(mojibake),
                "examples": sorted(set(mojibake))[:8],
            })

        visible = clean_text(text)
        title = html_title(text)
        if title and 'name="robots" content="noindex' not in text.lower():
            title_map[(scope_for_path(page_rel), normalize_key(title))].append(canonical_key)
        fingerprint_source = normalize_key(visible[:5000])
        if fingerprint_source:
            digest = hashlib.sha1(fingerprint_source.encode("utf-8", errors="ignore")).hexdigest()[:16]
            content_map[digest].append(canonical_key)

        if len(visible) < 450 or not title:
            report["empty_or_thin_pages"].append({"file": page_rel, "chars": len(visible), "title": title})

        h_issues = heading_issues(text)
        if h_issues:
            report["heading_issues"].append({"file": page_rel, "issues": h_issues})

        if is_article_page(page_rel) and "BreadcrumbList" not in text:
            report["missing_breadcrumb_schema"].append(page_rel)

        report["structured_data_issues"].extend(structured_data_issues(page_rel, text))

        comment_count = len(COMMENT_SECTION_RE.findall(text))
        form_count = len(re.findall(r'id=["\']comment-form["\']', text, re.IGNORECASE))
        if comment_count > 1 or form_count > 1:
            report["comment_repeats"].append({
                "file": page_rel,
                "article_comments": comment_count,
                "comment_forms": form_count,
            })

        share_text_count = len(re.findall(
            r'<a\b[^>]*class=["\'][^"\']*share-(?:btn|link)[^"\']*["\'][^>]*>\s*(?:X|f|W|T)\s*</a>',
            text,
            re.IGNORECASE,
        ))
        if share_text_count:
            report["text_share_icons"].append({"file": page_rel, "count": share_text_count})

        for link in HREF_RE.findall(text):
            target = resolve_internal_link(path, link)
            if target is not None and not target.exists():
                resolved = rel(target) if target == ROOT or ROOT in target.parents else str(target)
                report["broken_links"].append({"file": page_rel, "link": link, "resolved": resolved})

    for (_scope, key), files in title_map.items():
        unique_files = sorted(set(files))
        if key and len(unique_files) > 1:
            report["duplicate_titles"].append({"title_key": key[:120], "files": unique_files})
    for digest, files in content_map.items():
        unique_files = sorted(set(files))
        if len(unique_files) > 1:
            report["duplicate_content"].append({"fingerprint": digest, "files": unique_files})

    seen_slugs: dict[tuple[str, str], list[str]] = defaultdict(list)
    for path in json_files:
        data = parse_json(path)
        if "__error__" in data:
            report["json_errors"].append({"file": rel(path), "error": data["__error__"]})
            continue
        path_label = rel(path)
        slug = slug_for_json(path, data)
        seen_slugs[(scope_for_path(path_label), slug)].append(path_label)
        raw = path.read_text(encoding="utf-8", errors="replace")
        mojibake = MOJIBAKE_RE.findall(raw)
        if mojibake:
            report["utf8_suspects"].append({"file": path_label, "count": len(mojibake), "examples": sorted(set(mojibake))[:8]})
        current = str(data.get("category", "")).strip()
        inferred, score = infer_category(data)
        if current and inferred and score >= 2 and normalize_key(current) != normalize_key(inferred):
            report["category_mismatches"].append({
                "file": path_label,
                "title": str(data.get("title", ""))[:140],
                "current": current,
                "suggested": inferred,
                "confidence": score,
            })

    duplicate_slugs = [{"slug": slug, "files": files} for (_scope, slug), files in seen_slugs.items() if len(files) > 1]
    if duplicate_slugs:
        report["duplicate_slugs"] = duplicate_slugs

    for page in [ROOT / "haber.html", ROOT / "haber" / "index.html", ROOT / "news" / "index.html", ROOT / "nachrichten" / "index.html"]:
        if page.exists():
            text = read_text(page)
            page_rel = rel(page)
            report["slider"][page_rel] = {
                "has_set_interval": "setInterval" in text,
                "has_touch_handlers": "touchstart" in text or "pointerdown" in text,
                "hero_cards": len(re.findall(r'class=["\'][^"\']*(?:hero-card|showcase-card|headline-card)[^"\']*["\']', text)),
            }
            ux = homepage_ux_report(page_rel, text)
            if ux["issues"]:
                report["homepage_ux_issues"].append({"file": page_rel, **ux})

    report["live_url_checks"] = check_live_urls()
    report["severity"] = build_severity(report)
    for key, value in list(report.items()):
        if isinstance(value, list):
            report["summary"][key] = len(value)
    report["summary"]["critical"] = len(report["severity"]["critical"])
    report["summary"]["warning"] = len(report["severity"]["warning"])
    return report


def item_label(item: Any) -> str:
    if isinstance(item, str):
        return item
    if isinstance(item, dict):
        return str(item.get("file") or item.get("url") or item.get("title_key") or item.get("fingerprint") or item.get("slug") or item)
    return str(item)


def write_reports(report: dict[str, Any]) -> tuple[Path, Path]:
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    json_path = REPORT_DIR / "site-quality-audit.json"
    md_path = REPORT_DIR / "site-quality-audit.md"
    json_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")

    lines = ["# Site Quality Audit", "", "## Özet"]
    for key, value in report["summary"].items():
        lines.append(f"- {key}: {value}")
    lines.append("")

    for severity in ["critical", "warning"]:
        items = report.get("severity", {}).get(severity, [])
        lines.append(f"## {severity.upper()} ({len(items)})")
        for item in items[:30]:
            lines.append(f"- `{item_label(item)}`")
        if len(items) > 30:
            lines.append(f"- ... {len(items) - 30} daha")
        lines.append("")

    for section in [
        "live_url_checks",
        "utf8_suspects",
        "broken_links",
        "structured_data_issues",
        "homepage_ux_issues",
        "category_mismatches",
        "duplicate_titles",
        "duplicate_content",
        "empty_or_thin_pages",
        "heading_issues",
        "missing_breadcrumb_schema",
        "comment_repeats",
        "text_share_icons",
    ]:
        items = report.get(section, [])
        lines.append(f"## {section} ({len(items)})")
        for item in items[:25]:
            lines.append(f"- `{item_label(item)}`")
        if len(items) > 25:
            lines.append(f"- ... {len(items) - 25} daha")
        lines.append("")

    md_path.write_text("\n".join(lines), encoding="utf-8")
    return json_path, md_path


if __name__ == "__main__":
    result = audit()
    json_report, md_report = write_reports(result)
    print(f"Audit written: {json_report.relative_to(ROOT)}")
    print(f"Markdown written: {md_report.relative_to(ROOT)}")
    print(json.dumps(result["summary"], ensure_ascii=False, indent=2))
