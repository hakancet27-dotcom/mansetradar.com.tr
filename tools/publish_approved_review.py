import html
import json
import re
import shutil
from datetime import datetime
from pathlib import Path
from urllib.parse import quote_plus


ROOT = Path(__file__).resolve().parents[1]
PENDING_DIR = ROOT / "newsroom" / "review" / "pending"
PUBLISHED_REVIEW_DIR = ROOT / "newsroom" / "review" / "published"
SITE_URL = "https://hakancetin.com.tr"

TARGETS = {
    "articles": {
        "dir": ROOT / "articles",
        "index": ROOT / "haber.html",
        "insert_after": "<!-- TURKEY_START -->",
        "href_prefix": "articles",
        "site_prefix": "articles",
        "country_label": "TR Türkiye",
        "back_href": "/haber",
        "read_more": "Devamını Oku →",
        "topic_default": "Gündem",
    },
    "news/articles": {
        "dir": ROOT / "news" / "articles",
        "index": ROOT / "news" / "index.html",
        "insert_after": '<div class="news-grid" id="grid-main">',
        "href_prefix": "articles",
        "site_prefix": "news/articles",
        "country_label": "US United States",
        "back_href": "../",
        "read_more": "Read More →",
        "topic_default": "Agenda",
    },
    "nachrichten/artikel": {
        "dir": ROOT / "nachrichten" / "artikel",
        "index": ROOT / "nachrichten" / "index.html",
        "insert_after": '<div class="news-grid" id="grid-main">',
        "href_prefix": "artikel",
        "site_prefix": "nachrichten/artikel",
        "country_label": "DE Deutschland",
        "back_href": "../",
        "read_more": "Weiterlesen →",
        "topic_default": "Aktuell",
    },
}


def clean(value):
    if value is None:
        return ""
    return str(value).strip()


def esc(value):
    return html.escape(clean(value), quote=True)


def parse_date(value):
    text = clean(value)
    try:
        return datetime.strptime(text, "%d.%m.%Y")
    except ValueError:
        return datetime.utcnow()


def iso_date(value):
    return parse_date(value).strftime("%Y-%m-%d")


def excerpt(data):
    text = clean(data.get("summary") or data.get("spot"))
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text[:210] + ("..." if len(text) > 210 else "")


def topic_slug(topic):
    mapping = {
        "son dakika": "son-dakika",
        "gündem": "gundem",
        "gundem": "gundem",
        "siyaset": "siyaset",
        "ekonomi": "ekonomi",
        "dünya": "dunya",
        "dunya": "dunya",
        "world": "dunya",
        "spor": "spor",
        "magazin": "magazin",
        "teknoloji": "teknoloji",
        "technology": "teknoloji",
        "sağlık": "saglik",
        "saglik": "saglik",
        "health": "saglik",
        "video": "video",
    }
    return mapping.get(clean(topic).lower(), "gundem")


def share_links(url, title):
    q_url = quote_plus(url)
    q_title = quote_plus(title)
    return f"""
            <div class="share-mini" aria-label="Paylaş">
              <a class="share-btn share-x" target="_blank" rel="noopener" href="https://twitter.com/intent/tweet?url={q_url}&text={q_title}" aria-label="X'te paylaş">X</a>
              <a class="share-btn share-fb" target="_blank" rel="noopener" href="https://www.facebook.com/sharer/sharer.php?u={q_url}" aria-label="Facebook'ta paylaş">f</a>
              <a class="share-btn share-wa" target="_blank" rel="noopener" href="https://api.whatsapp.com/send?text={q_title}%20{q_url}" aria-label="WhatsApp'ta paylaş">W</a>
              <a class="share-btn share-tg" target="_blank" rel="noopener" href="https://t.me/share/url?url={q_url}&text={q_title}" aria-label="Telegram'da paylaş">T</a>
            </div>"""


def make_card(data, target):
    slug = clean(data.get("slug"))
    title = clean(data.get("title"))
    topic = clean(data.get("category") or target["topic_default"])
    href = f'/{target["site_prefix"]}/{slug}/'
    absolute = f"{SITE_URL}/{target['site_prefix']}/{slug}.html"
    image_url = clean(data.get("image_url")) or f"{SITE_URL}/{target['site_prefix']}/images/{slug}.jpg"
    card_excerpt = excerpt(data)
    excerpt_html = f'<p class="card-excerpt">{esc(card_excerpt)}</p>' if card_excerpt else ""
    return f"""
      <article class="news-card topic-card" data-topic="{esc(topic_slug(topic))}">
        <a class="card-image-link" href="{esc(href)}" aria-label="{esc(title)}"><div class="card-image"><img src="{esc(image_url)}" alt="{esc(data.get('image_alt') or title)}" loading="lazy" width="1080" height="720"></div></a>
        <div class="card-body">
          <div class="card-meta">
            <span class="card-category">{esc(target["country_label"])}</span>
            <span class="card-topic">{esc(topic)}</span>
            <time class="card-date" datetime="{iso_date(data.get("date"))}">{esc(data.get("date"))}</time>
          </div>
          <h3 class="card-title">
            <a href="{esc(href)}">{esc(title)}</a>
          </h3>
          {excerpt_html}
          <div class="card-footer">
            <a class="read-more" href="{esc(href)}" aria-label="{esc(title)}">{esc(target["read_more"])}</a>
            {share_links(absolute, title)}
          </div>
        </div>
      </article>"""


def render_article_html(data, target):
    title = clean(data.get("title"))
    spot = clean(data.get("spot") or data.get("summary"))
    body = clean(data.get("content_html")) or f"<p>{esc(spot)}</p>"
    slug = clean(data.get("slug"))
    image_url = clean(data.get("image_url")) or f"{SITE_URL}/{target['site_prefix']}/images/{slug}.jpg"
    tags = data.get("tags") if isinstance(data.get("tags"), list) else []
    tag_html = "".join(f"<span>{esc(tag)}</span>" for tag in tags)
    return f"""<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="{esc(data.get("meta_description") or spot)}">
  <title>{esc(data.get("meta_title") or title)} | hakancetin.com.tr</title>
  <style>
    body {{ font-family: 'Segoe UI', Arial, sans-serif; margin:0; background:#f4f6f8; color:#20242a; line-height:1.75; }}
    main {{ max-width: 980px; margin: 28px auto; padding: 0 20px; }}
    article {{ background:#fff; padding:34px; border-radius:8px; box-shadow:0 8px 30px rgba(15,23,42,.08); }}
    a {{ color:#e10600; text-decoration:none; font-weight:800; }}
    h1 {{ font-size:clamp(1.85rem,3vw,2.65rem); line-height:1.14; color:#111827; }}
    .spot {{ border-left:5px solid #e10600; padding:12px 0 12px 18px; background:#fff8f7; color:#374151; }}
    .article-image img {{ width:100%; aspect-ratio:16/9; object-fit:cover; display:block; border-radius:8px; background:#111827; }}
    h2 {{ margin-top:28px; border-top:1px solid #e5e7eb; padding-top:12px; }}
    .tag-list {{ display:flex; flex-wrap:wrap; gap:8px; margin-top:28px; padding-top:18px; border-top:1px solid #e5e7eb; }}
    .tag-list span {{ background:#f3f4f6; padding:5px 10px; border-radius:5px; font-weight:700; }}
  </style>
</head>
<body>
  <main>
    <a href="{esc(target['back_href'])}">← Tüm Haberler</a>
    <article>
      <h1>{esc(title)}</h1>
      <p class="spot">{esc(spot)}</p>
      <figure class="article-image"><img src="{esc(image_url)}" alt="{esc(data.get("image_alt") or title)}" loading="eager" width="1280" height="720"></figure>
      {body}
      <div class="tag-list">{tag_html}</div>
    </article>
  </main>
</body>
</html>
"""


def update_index(data, target):
    index_path = target["index"]
    if not index_path.exists():
        return False
    content = index_path.read_text(encoding="utf-8")
    slug = clean(data.get("slug"))
    pretty_href = f"/{target['site_prefix']}/{slug}/"
    if f"/{slug}.html" in content or f"{slug}.html" in content or pretty_href in content:
        return False
    marker = target["insert_after"]
    pos = content.find(marker)
    if pos < 0:
        print(f"Index marker not found: {index_path}")
        return False
    insert_at = pos + len(marker)
    updated = content[:insert_at] + "\n" + make_card(data, target) + content[insert_at:]
    index_path.write_text(updated, encoding="utf-8")
    return True


def publish_one(json_path):
    data = json.loads(json_path.read_text(encoding="utf-8-sig"))
    status = clean(data.get("review_status")).lower()
    if status not in {"approved", "approved_to_publish"}:
        return False
    slug = clean(data.get("slug"))
    url_prefix = clean(data.get("url_prefix") or "articles")
    target = TARGETS.get(url_prefix)
    if not slug or not target:
        print(f"Approved review skipped, target missing: {json_path}")
        return False
    target = dict(target)
    if url_prefix == "articles":
        country = clean(data.get("country"))
        if country == "USA":
            target["insert_after"] = "<!-- USA_START -->"
            target["country_label"] = "US Amerika"
        elif country == "Germany":
            target["insert_after"] = "<!-- GERMANY_START -->"
            target["country_label"] = "DE Almanya"
        else:
            target["insert_after"] = "<!-- TURKEY_START -->"
            target["country_label"] = "TR Türkiye"

    target_dir = target["dir"]
    target_dir.mkdir(parents=True, exist_ok=True)
    (target_dir / "images").mkdir(parents=True, exist_ok=True)

    pending_image_dir = PENDING_DIR / "images"
    for image_path in pending_image_dir.glob(f"{slug}.*"):
        dest = target_dir / "images" / image_path.name
        shutil.copy2(image_path, dest)
        data["image_url"] = f"{SITE_URL}/{url_prefix}/images/{image_path.name}"
        break

    data["quality_status"] = "approved"
    data["review_required"] = False
    data["indexed_on_home"] = True
    data["review_status"] = "published"

    target_json = target_dir / f"{slug}.json"
    target_html = target_dir / f"{slug}.html"
    target_json.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")

    pending_html = json_path.with_suffix(".html")
    # CMS tarafindan gelen eski HTML dosyasini birebir kopyalamak yerine
    # her zaman guncel article sablonunu yeniden uretiriz.
    # Boylece yeni gorsel/canvas/CSS duzenleri tum yeni yayinlara tutarli uygulanir.
    target_html.write_text(render_article_html(data, target), encoding="utf-8")
    pretty_dir = target_dir / slug
    pretty_dir.mkdir(parents=True, exist_ok=True)
    shutil.copy2(target_html, pretty_dir / "index.html")

    update_index(data, target)

    PUBLISHED_REVIEW_DIR.mkdir(parents=True, exist_ok=True)
    archive_json = PUBLISHED_REVIEW_DIR / json_path.name
    archive_json.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    json_path.unlink()
    if pending_html.exists():
        pending_html.unlink()
    return True


def main():
    PENDING_DIR.mkdir(parents=True, exist_ok=True)
    published = 0
    for json_path in sorted(PENDING_DIR.glob("*.json")):
        if publish_one(json_path):
            published += 1
    print(f"Approved review articles published: {published}")


if __name__ == "__main__":
    main()


