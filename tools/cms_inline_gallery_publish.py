#!/usr/bin/env python3
from __future__ import annotations

import html
import json
import re
from pathlib import Path
from typing import Any

CMS_ROOTS = (Path('cms-published/articles'), Path('cms-published/news/articles'), Path('cms-published/nachrichten/artikel'))
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


def update_html(path: Path, gallery: list[dict[str, str]]) -> bool:
    original = path.read_text(encoding='utf-8-sig')
    content = original
    if gallery and '.article-inline-gallery' not in content:
        content = content.replace('    article p { margin:0 0 16px; font-size:1.02rem; }', '    article p { margin:0 0 16px; font-size:1.02rem; }' + INLINE_CSS)
    if not gallery:
        content = content.replace(INLINE_CSS, '')
    if '<div class="article-content">' in content:
        content = re.sub(
            r'(<div class="article-content">)([\s\S]*?)(</div>\s*(?:<div class="tag-list"|<p class="article-source"|<div class="article-share"|<section class="article-comments"|<section class="related-news"))',
            lambda m: m.group(1) + inject_article_body(m.group(2), gallery) + m.group(3),
            content,
            count=1,
        )
    else:
        content = strip_blocks(content)
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
            if update_html(html_path, gallery):
                changed += 1
    print(f'Inline gallery publish completed: scanned={scanned} galleries={galleries} html_changed={changed}')


if __name__ == '__main__':
    main()
