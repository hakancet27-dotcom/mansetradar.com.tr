#!/usr/bin/env python3
from __future__ import annotations

import html
import json
import re
from pathlib import Path
from typing import Any

SITE_URL = 'https://mansetradar.com.tr'
CMS_ROOTS = (
    Path('data/cms-published/articles'),
    Path('data/cms-published/news/articles'),
    Path('data/cms-published/nachrichten/artikel'),
    Path('cms-published/articles'),
    Path('cms-published/news/articles'),
    Path('cms-published/nachrichten/artikel'),
)
START = '<!-- INLINE_GALLERY_START -->'
END = '<!-- INLINE_GALLERY_END -->'
INLINE_CSS = """
    .article-inline-gallery { width:min(100%, 760px); margin:22px auto; border-radius:10px; overflow:hidden; background:#fff; border:1px solid var(--border); box-shadow:0 4px 16px rgba(15,23,42,.06); }
    .article-inline-gallery img { width:100%; height:auto; display:block; aspect-ratio:16/9; object-fit:cover; object-position:center; }
    .article-inline-gallery figcaption { padding:8px 12px 10px; color:var(--muted); font-size:.86rem; line-height:1.45; font-style:italic; background:#fafafa; }
"""


def clean(value: Any) -> str:
    return re.sub(r'\s+', ' ', str(value or '')).strip()


def is_remote(value: str) -> bool:
    return value.startswith('http://') or value.startswith('https://')


def display_src(value: str) -> str:
    value = clean(value)
    if not value:
        return ''
    return value if is_remote(value) else '/' + value.lstrip('/')


def absolute_src(value: str) -> str:
    value = display_src(value)
    if not value:
        return ''
    return value if is_remote(value) else SITE_URL + value


def read_json(path: Path) -> dict[str, Any] | None:
    try:
        data = json.loads(path.read_text(encoding='utf-8-sig'))
    except Exception as exc:
        print(f'Gallery skipped JSON {path}: {exc}')
        return None
    return data if isinstance(data, dict) else None


def cms_paths() -> list[Path]:
    paths: list[Path] = []
    for root in CMS_ROOTS:
        if root.exists():
            paths.extend(sorted(root.glob('*.json')))
    return paths


def main_image_url(data: dict[str, Any]) -> str:
    image = data.get('image') if isinstance(data.get('image'), dict) else {}
    return clean(data.get('image_url') or image.get('url') or data.get('thumbnail') or data.get('image_local_webp'))


def main_image_alt(data: dict[str, Any]) -> str:
    image = data.get('image') if isinstance(data.get('image'), dict) else {}
    return clean(data.get('image_alt') or image.get('alt') or data.get('title') or 'Haber görseli')


def image_credit_html(data: dict[str, Any], image_url: str) -> str:
    credit = clean(data.get('image_credit'))
    credit_url = clean(data.get('image_credit_url'))
    # CMS panelinden secilen lokal gorsellerde eski RSS/Hurriyet kredisi detay sayfasinda kalmasin.
    local_key = image_url.lstrip('/')
    if local_key.startswith('articles/images/') or local_key.startswith('cms-stock-images/'):
        return ''
    if not credit:
        return ''
    label = html.escape(credit)
    if credit_url:
        return '<figcaption class="image-credit" style="font-size:.78rem;color:#6b7280;text-align:right;padding:7px 10px;background:#f8fafc;">Görsel kaynağı: <a href="' + html.escape(credit_url, quote=True) + '" target="_blank" rel="nofollow noopener" style="color:#b91c1c;text-decoration:none;font-weight:700;">' + label + '</a></figcaption>'
    return '<figcaption class="image-credit" style="font-size:.78rem;color:#6b7280;text-align:right;padding:7px 10px;background:#f8fafc;">Görsel kaynağı: ' + label + '</figcaption>'


def normalized_gallery(data: dict[str, Any]) -> list[dict[str, str]]:
    gallery = data.get('image_gallery') or []
    if not isinstance(gallery, list):
        return []
    items: list[dict[str, str]] = []
    seen: set[str] = set()
    main = clean(data.get('image_url'))
    if main:
        seen.add(main)
        seen.add(main.lstrip('/'))
    for item in gallery:
        if isinstance(item, str):
            url, alt, caption = item, '', ''
        elif isinstance(item, dict):
            url = item.get('image_url') or item.get('url') or item.get('image') or ''
            alt = item.get('image_alt') or item.get('alt') or ''
            caption = item.get('caption') or item.get('description') or ''
        else:
            continue
        url = clean(url)
        if not url:
            continue
        key = url.lstrip('/')
        if key in seen or url in seen:
            continue
        seen.add(key)
        items.append({'url': display_src(url), 'alt': clean(alt), 'caption': clean(caption)})
    return items


def source_path(data_path: Path, data: dict[str, Any]) -> Path:
    source = clean(data.get('source_json_path'))
    if source:
        path = Path(source.lstrip('/')).resolve()
        root = Path('.').resolve()
        try:
            path.relative_to(root)
            return path
        except ValueError:
            pass
    return data_path


def html_paths(source: Path, data: dict[str, Any]) -> list[Path]:
    slug = clean(data.get('slug') or source.stem) or source.stem
    folder = source.parent
    candidates = [folder / f'{slug}.html', folder / slug / 'index.html', source.with_suffix('.html'), source.with_suffix('') / 'index.html']
    return [path for path in candidates if path.exists()]


def strip_blocks(content: str) -> str:
    return re.sub(re.escape(START) + r'[\s\S]*?' + re.escape(END), '', content, flags=re.IGNORECASE)


def figure(item: dict[str, str], index: int) -> str:
    alt = item['alt'] or item['caption'] or f'Ek haber görseli {index}'
    caption = item['caption'] or item['alt']
    caption_html = f'<figcaption>{html.escape(caption)}</figcaption>' if caption else ''
    return f'{START}<figure class="article-inline-gallery" data-gallery-index="{index}"><img src="{html.escape(item["url"], quote=True)}" alt="{html.escape(alt, quote=True)}" loading="lazy">{caption_html}</figure>{END}'


def targets(content: str, count: int) -> set[int]:
    paragraph_count = len(list(re.finditer(r'</p>', content, flags=re.IGNORECASE)))
    desired = ([2] if count == 1 else [2, 4] if count == 2 else [2, 4, 6] if count == 3 else [2, 4, 6, 8] + list(range(10, 10 + (count - 4) * 2, 2)))
    out: list[int] = []
    for item in desired[:count]:
        value = min(item, paragraph_count) if paragraph_count else item
        if value not in out:
            out.append(value)
    return set(out)


def inject_article_body(body: str, gallery: list[dict[str, str]]) -> str:
    body = strip_blocks(body)
    if not gallery:
        return body
    matches = list(re.finditer(r'</p>', body, flags=re.IGNORECASE))
    if not matches:
        return body + ''.join(figure(item, idx + 1) for idx, item in enumerate(gallery))
    result: list[str] = []
    last = 0
    gallery_index = 0
    wanted = targets(body, len(gallery))
    for paragraph_index, match in enumerate(matches, start=1):
        result.append(body[last:match.end()])
        last = match.end()
        if paragraph_index in wanted and gallery_index < len(gallery):
            result.append(figure(gallery[gallery_index], gallery_index + 1))
            gallery_index += 1
    result.append(body[last:])
    while gallery_index < len(gallery):
        result.append(figure(gallery[gallery_index], gallery_index + 1))
        gallery_index += 1
    return ''.join(result)


def add_or_remove_css(content: str, gallery: list[dict[str, str]]) -> str:
    if gallery and '.article-inline-gallery' not in content:
        return content.replace('    article p { margin:0 0 16px; font-size:1.02rem; }', '    article p { margin:0 0 16px; font-size:1.02rem; }' + INLINE_CSS)
    if not gallery:
        return content.replace(INLINE_CSS, '')
    return content


def update_meta_images(content: str, image_url: str) -> str:
    absolute = absolute_src(image_url)
    if not absolute:
        return content
    content = re.sub(r'(<meta property="og:image" content=")[^"]*(">)', r'\1' + html.escape(absolute, quote=True) + r'\2', content, count=1)
    content = re.sub(r'(<meta name="twitter:image" content=")[^"]*(">)', r'\1' + html.escape(absolute, quote=True) + r'\2', content, count=1)
    content = re.sub(r'("image"\s*:\s*\{[^}]*"url"\s*:\s*")[^"]*(")', r'\1' + absolute.replace('\\', '\\\\').replace('"', '\\"') + r'\2', content, count=1)
    return content


def update_main_figure(content: str, data: dict[str, Any]) -> str:
    image_url = main_image_url(data)
    if not image_url:
        return content
    src = absolute_src(image_url)
    alt = main_image_alt(data)
    caption = image_credit_html(data, image_url)
    figure_html = '<figure class="article-image"><img src="' + html.escape(src, quote=True) + '" alt="' + html.escape(alt, quote=True) + '" loading="eager" fetchpriority="high" width="1280" height="720">' + caption + '</figure>'
    updated, count = re.subn(r'<figure class="article-image">[\s\S]*?</figure>', figure_html, content, count=1, flags=re.IGNORECASE)
    return updated if count else content


def inject_content(content: str, gallery: list[dict[str, str]]) -> str:
    if '<div class="article-content">' in content:
        return re.sub(
            r'(<div class="article-content">)([\s\S]*?)(</div>\s*(?:<div class="tag-list"|<p class="article-source"|<div class="article-share"|<section class="article-comments"|<section class="related-news"))',
            lambda m: m.group(1) + inject_article_body(m.group(2), gallery) + m.group(3),
            content,
            count=1,
        )
    body_pattern = (
        r'(<figure class="article-image">[\s\S]*?</figure>\s*)'
        r'([\s\S]*?)'
        r'(\s*(?:<div class="tag-list"|<p class="article-source"|<div class="article-share"|<section class="article-comments"|<section class="related-news"))'
    )
    updated, count = re.subn(
        body_pattern,
        lambda m: m.group(1) + inject_article_body(m.group(2), gallery) + m.group(3),
        content,
        count=1,
    )
    if count:
        return updated
    return strip_blocks(content)


def update_html(path: Path, data: dict[str, Any], gallery: list[dict[str, str]]) -> bool:
    original = path.read_text(encoding='utf-8-sig')
    content = add_or_remove_css(original, gallery)
    content = update_meta_images(content, main_image_url(data))
    content = update_main_figure(content, data)
    content = inject_content(content, gallery)
    if content == original:
        return False
    path.write_text(content, encoding='utf-8')
    return True


def main() -> None:
    scanned = galleries = changed = 0
    for data_path in cms_paths():
        scanned += 1
        data = read_json(data_path)
        if not data:
            continue
        gallery = normalized_gallery(data)
        if gallery:
            galleries += 1
        for html_path in html_paths(source_path(data_path, data), data):
            if update_html(html_path, data, gallery):
                changed += 1
                print(f'CMS detail HTML synced: {html_path}')
    print(f'Inline gallery publish completed: scanned={scanned} galleries={galleries} html_changed={changed}')


if __name__ == '__main__':
    main()
