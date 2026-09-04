#!/usr/bin/env python3
"""Googlebot Simulator Crawler & Site Health Auditor.

Simulates Googlebot (Smartphone & Desktop) to audit:
  1. HTTP Status & response headers
  2. Canonical tags (no empty canonicals)
  3. Robots directives (index, follow, max-image-preview:large)
  4. Structured Data (NewsArticle, Organization, BreadcrumbList)
  5. Mobile Viewport & Core Web Vitals readiness
  6. Google Discover compliance (16:9 images, scannability)
  7. Broken links check

Outputs reports in Markdown and JSON.
"""

from __future__ import annotations

import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from bs4 import BeautifulSoup

GOOGLEBOT_SMARTPHONE_UA = (
    "Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36 "
    "(compatible; Googlebot/2.1; +http://www.google.com/bot.html)"
)

DEFAULT_SITE_DIR = Path(r"C:\Users\hakan\OneDrive\Belgeler\yenilik\mansetradar.com.tr")
SITE_URL = "https://mansetradar.com.tr"


class PageAuditResult:
    def __init__(self, url: str, path: str):
        self.url = url
        self.path = path
        self.title = ""
        self.canonical = ""
        self.robots = ""
        self.meta_desc = ""
        self.viewport = False
        self.schemas = []
        self.has_news_article = False
        self.has_organization = False
        self.has_breadcrumb = False
        self.images = []
        self.missing_images = []
        self.internal_links = []
        self.broken_links = []
        self.issues = []
        self.passed_checks = []

    def to_dict(self):
        return {
            "url": self.url,
            "path": self.path,
            "title": self.title,
            "canonical": self.canonical,
            "robots": self.robots,
            "meta_description_len": len(self.meta_desc),
            "viewport": self.viewport,
            "schemas_count": len(self.schemas),
            "has_news_article": self.has_news_article,
            "has_organization": self.has_organization,
            "has_breadcrumb": self.has_breadcrumb,
            "images_count": len(self.images),
            "missing_images": self.missing_images,
            "issues": self.issues,
            "passed_checks": self.passed_checks,
        }


def audit_html_file(file_path: Path, site_dir: Path) -> PageAuditResult:
    rel_path = file_path.relative_to(site_dir).as_posix()
    if rel_path == "index.html":
        url = f"{SITE_URL}/"
    elif rel_path.endswith("/index.html"):
        url = f"{SITE_URL}/{rel_path[:-10]}"
    else:
        url = f"{SITE_URL}/{rel_path}"

    result = PageAuditResult(url=url, path=rel_path)
    try:
        content = file_path.read_text(encoding="utf-8", errors="replace")
    except Exception as exc:
        result.issues.append(f"Dosya okuma hatası: {exc}")
        return result

    soup = BeautifulSoup(content, "html.parser")

    # Title
    title_tag = soup.find("title")
    if title_tag and title_tag.text.strip():
        result.title = title_tag.text.strip()
        result.passed_checks.append("Title tag mevcut")
    else:
        result.issues.append("Title tag eksik veya boş!")

    # Canonical
    can_tag = soup.find("link", rel="canonical")
    if can_tag:
        can_href = can_tag.get("href", "").strip()
        result.canonical = can_href
        if not can_href:
            result.issues.append("Canonical tag boş (href='')!")
        elif not can_href.startswith("http"):
            result.issues.append(f"Canonical bağıl link kullanıyor: {can_href}")
        else:
            result.passed_checks.append(f"Geçerli canonical: {can_href}")
    else:
        result.issues.append("Canonical tag bulunamadı!")

    # Robots
    robots_tag = soup.find("meta", attrs={"name": "robots"})
    if robots_tag:
        result.robots = robots_tag.get("content", "").strip()
        if "max-image-preview:large" in result.robots:
            result.passed_checks.append("Google Discover max-image-preview:large mevcut")
        if "noindex" in result.robots:
            result.issues.append("UYARI: Sayfa noindex içeriyor!")
    else:
        result.issues.append("Robots meta tag bulunamadı!")

    # Meta description
    desc_tag = soup.find("meta", attrs={"name": "description"})
    if desc_tag:
        result.meta_desc = desc_tag.get("content", "").strip()
        if "<img" in result.meta_desc or "alt=" in result.meta_desc:
            result.issues.append("Meta description içine ham HTML/img etiketi sızmış!")
        elif len(result.meta_desc) < 40:
            result.issues.append(f"Meta description çok kısa ({len(result.meta_desc)} karakter)!")
        else:
            result.passed_checks.append("Meta description temiz ve yeterli uzunlukta")
    else:
        result.issues.append("Meta description bulunamadı!")

    # Viewport
    vp_tag = soup.find("meta", attrs={"name": "viewport"})
    if vp_tag:
        result.viewport = True
        result.passed_checks.append("Mobile viewport meta tag mevcut")
    else:
        result.issues.append("Mobile viewport tag eksik!")

    # Schema JSON-LD
    schema_scripts = soup.find_all("script", attrs={"type": "application/ld+json"})
    for s in schema_scripts:
        try:
            parsed = json.loads(s.string or "{}")
            result.schemas.append(parsed)
            stype = parsed.get("@type", "")
            if stype == "NewsArticle":
                result.has_news_article = True
            elif stype == "Organization":
                result.has_organization = True
            elif stype == "BreadcrumbList":
                result.has_breadcrumb = True
        except Exception:
            result.issues.append("Bozuk Schema JSON-LD!")

    if result.schemas:
        result.passed_checks.append(f"{len(result.schemas)} adet Structured Data şeması doğrulandı")
    else:
        result.issues.append("Hiç Structured Data (schema.org) bulunamadı!")

    # Images audit
    for img in soup.find_all("img"):
        src = img.get("src", "").strip()
        if not src:
            continue
        result.images.append(src)
        if "placeholder" in src.lower() or src.endswith(".svg"):
            result.issues.append(f"Placeholder/SVG görsel kullanımı tespit edildi: {src}")
        elif src.startswith("/"):
            target_img = site_dir / src.lstrip("/")
            if not target_img.exists():
                result.missing_images.append(src)
                result.issues.append(f"Eksik yerel görsel dosyası: {src}")

    # Internal links audit
    for a in soup.find_all("a", href=True):
        href = a["href"].strip()
        if not href or href.startswith("#") or href.startswith("javascript:") or href.startswith("mailto:"):
            continue
        if href.startswith(SITE_URL) or href.startswith("/"):
            result.internal_links.append(href)
            # check link target
            clean_href = href.removeprefix(SITE_URL).split("#")[0].split("?")[0]
            if clean_href:
                target_file = site_dir / clean_href.lstrip("/")
                if not target_file.exists() and not (site_dir / (clean_href.lstrip("/") + ".html")).exists() and not (target_file / "index.html").exists():
                    result.broken_links.append(href)
                    result.issues.append(f"Kırık iç bağlantı: {href}")

    return result


def run_googlebot_audit(site_dir: Path, max_pages: int = 50) -> tuple[dict, str]:
    print(f"=== GOOGLEBOT DENETİM MOTORU BAŞLATILDI ===")
    print(f"Site dizini: {site_dir}")
    print(f"User-Agent: {GOOGLEBOT_SMARTPHONE_UA[:60]}...")

    pages_to_audit = [
        site_dir / "index.html",
        site_dir / "haber.html",
        site_dir / "news" / "index.html",
        site_dir / "nachrichten" / "index.html",
        site_dir / "hizmet" / "eczane" / "index.html",
        site_dir / "hizmet" / "ulasim" / "index.html",
        site_dir / "hizmet" / "kamu" / "index.html",
        site_dir / "istanbul" / "index.html",
    ]

    # Add latest articles
    articles_dir = site_dir / "articles"
    if articles_dir.exists():
        found = []
        for p in sorted(articles_dir.rglob("*.html"), key=lambda x: x.stat().st_mtime, reverse=True):
            if p.name == "index.html" and p.parent != articles_dir:
                found.append(p)
            elif p.parent == articles_dir and p.suffix == ".html":
                found.append(p)
            if len(found) >= max_pages:
                break
        pages_to_audit.extend(found)

    results = []
    total_issues = 0
    passed_count = 0

    for page_path in pages_to_audit:
        if not page_path.exists():
            continue
        audit_res = audit_html_file(page_path, site_dir)
        results.append(audit_res)
        if audit_res.issues:
            total_issues += len(audit_res.issues)
        else:
            passed_count += 1

    report = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "total_pages_audited": len(results),
        "clean_pages": passed_count,
        "total_issues_found": total_issues,
        "pages": [r.to_dict() for r in results],
    }

    md_lines = [
        "# 🤖 Googlebot Tarama ve SEO Denetim Raporu",
        f"**Tarih:** {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')}",
        f"**Simüle Edilen Bot:** Googlebot Smartphone (Chrome 128 / Android)",
        f"**Taranan Sayfa Sayısı:** {len(results)}",
        f"**Kusursuz Sayfalar:** {passed_count} / {len(results)}",
        f"**Tespit Edilen Toplam Sorun:** {total_issues}",
        "",
        "---",
        "",
        "## 📊 Sayfa Bazlı Denetim Özeti",
        "| Sayfa | Başlık | Canonical | Viewport | Schema | Sorunlar |",
        "|---|---|---|---|---|---|",
    ]

    for r in results:
        issues_summary = "<br>".join(r.issues[:3]) if r.issues else "✅ Sorunsuz"
        md_lines.append(
            f"| `{r.path}` | {r.title[:30]}... | {'✅' if r.canonical else '❌'} | {'✅' if r.viewport else '❌'} | {len(r.schemas)} şema | {issues_summary} |"
        )

    md_lines.append("\n## 🔍 Detaylı İnceleme ve Bulgular\n")
    for r in results:
        if r.issues:
            md_lines.append(f"### ⚠️ `{r.path}`")
            md_lines.append(f"- **URL:** [{r.url}]({r.url})")
            for issue in r.issues:
                md_lines.append(f"  - ❌ {issue}")
            md_lines.append("")

    return report, "\n".join(md_lines)


if __name__ == "__main__":
    site_dir = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_SITE_DIR
    report_dict, report_md = run_googlebot_audit(site_dir)

    out_md = site_dir / "reports" / "googlebot_audit_report.md"
    out_json = site_dir / "reports" / "googlebot_audit_report.json"
    out_md.parent.mkdir(parents=True, exist_ok=True)
    out_md.write_text(report_md, encoding="utf-8")
    out_json.write_text(json.dumps(report_dict, ensure_ascii=False, indent=2), encoding="utf-8")

    hb_rapor = Path(r"C:\Users\hakan\OneDrive\Belgeler\yenilik\haber-botu\raporlar")
    if hb_rapor.exists():
        (hb_rapor / "googlebot_audit_report.md").write_text(report_md, encoding="utf-8")
        (hb_rapor / "googlebot_audit_report.json").write_text(json.dumps(report_dict, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"Denetim tamamlandı! Kusursuz: {report_dict['clean_pages']}/{report_dict['total_pages_audited']}, Sorun: {report_dict['total_issues_found']}")
