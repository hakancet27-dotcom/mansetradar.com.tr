#!/usr/bin/env python3
from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

from PIL import Image, ImageOps

ARTICLE_DIRS = (Path('articles'), Path('news/articles'), Path('nachrichten/artikel'))
MEDIA_DIRS = (Path('articles/images'), Path('cms-stock-images'))
SKIP_PARTS = {'images', 'review', 'pending', 'duplicates', 'archive'}
CONVERTIBLE_SUFFIXES = {'.jpg', '.jpeg', '.png', '.avif'}
LOCAL_IMAGE_RE = re.compile(r'(?P<prefix>["\'(=\s]|^)(?P<path>/?(?:articles/images|cms-stock-images)/[^"\'()<>\s?#]+\.(?:jpg|jpeg|png|avif))(?P<suffix>[?#][^"\'()<>\s]*)?', re.IGNORECASE)


class Stats:
    def __init__(self) -> None:
        self.converted_files = 0
        self.deleted_sources = 0
        self.updated_articles = 0
        self.scanned_articles = 0
        self.skipped = 0


def is_remote(value: str) -> bool:
    return value.startswith('http://') or value.startswith('https://') or value.startswith('//')


def clean(value: Any) -> str:
    return str(value or '').strip()


def article_json_paths() -> list[Path]:
    paths: list[Path] = []
    for folder in ARTICLE_DIRS:
        if not folder.exists():
            continue
        for path in folder.rglob('*.json'):
            rel = path.relative_to(folder)
            if any(part in SKIP_PARTS for part in rel.parts[:-1]):
                continue
            paths.append(path)
    return sorted(paths, key=lambda item: item.as_posix())


def all_media_paths() -> list[Path]:
    paths: list[Path] = []
    for folder in MEDIA_DIRS:
        if not folder.exists():
            continue
        for path in folder.rglob('*'):
            if path.is_file() and path.suffix.lower() in CONVERTIBLE_SUFFIXES:
                paths.append(path)
    return sorted(paths, key=lambda item: item.as_posix())


def site_file(value: Any) -> Path | None:
    raw = clean(value)
    if not raw or is_remote(raw):
        return None
    path = Path(raw.split('?', 1)[0].split('#', 1)[0].lstrip('/')).resolve()
    root = Path('.').resolve()
    try:
        path.relative_to(root)
    except ValueError:
        return None
    return path


def public_path(path: Path) -> str:
    return '/' + path.resolve().relative_to(Path('.').resolve()).as_posix()


def convert(path: Path, quality: int, stats: Stats) -> Path | None:
    if path.suffix.lower() == '.webp':
        return path
    if path.suffix.lower() not in CONVERTIBLE_SUFFIXES:
        return None
    if not path.exists() or not path.is_file():
        return None
    target = path.with_suffix('.webp')
    try:
        with Image.open(path) as img:
            img = ImageOps.exif_transpose(img)
            if img.mode not in {'RGB', 'RGBA'}:
                img = img.convert('RGBA' if 'A' in img.getbands() else 'RGB')
            target.parent.mkdir(parents=True, exist_ok=True)
            img.save(target, 'WEBP', quality=quality, method=6)
        if target.exists() and target.stat().st_size > 0:
            stats.converted_files += 1
            path.unlink()
            stats.deleted_sources += 1
            return target
    except Exception as exc:
        stats.skipped += 1
        print(f'WebP skipped {path}: {exc}')
    return None


def normalize_exact_value(value: Any, quality: int, stats: Stats) -> tuple[Any, bool]:
    source = site_file(value)
    if source is None:
        return value, False
    target = convert(source, quality, stats)
    if target is None:
        return value, False
    new_value = public_path(target)
    return new_value, new_value != clean(value)


def normalize_text_value(value: str, quality: int, stats: Stats) -> tuple[str, bool]:
    changed = False

    def repl(match: re.Match[str]) -> str:
        nonlocal changed
        prefix = match.group('prefix') or ''
        raw_path = match.group('path') or ''
        suffix = match.group('suffix') or ''
        source = site_file(raw_path)
        if source is None:
            return match.group(0)
        target = convert(source, quality, stats)
        if target is None:
            return match.group(0)
        new_path = public_path(target)
        changed = changed or new_path != raw_path
        return f'{prefix}{new_path}{suffix}'

    normalized = LOCAL_IMAGE_RE.sub(repl, value)
    return normalized, changed


def normalize_any(value: Any, quality: int, stats: Stats) -> tuple[Any, bool]:
    if isinstance(value, dict):
        changed = False
        updated: dict[str, Any] = {}
        for key, item in value.items():
            new_item, item_changed = normalize_any(item, quality, stats)
            updated[key] = new_item
            changed = changed or item_changed
        return updated, changed
    if isinstance(value, list):
        changed = False
        updated_list: list[Any] = []
        for item in value:
            new_item, item_changed = normalize_any(item, quality, stats)
            updated_list.append(new_item)
            changed = changed or item_changed
        return updated_list, changed
    if isinstance(value, str):
        exact, exact_changed = normalize_exact_value(value, quality, stats)
        if exact_changed:
            return exact, True
        return normalize_text_value(value, quality, stats)
    return value, False


def normalize_article(path: Path, quality: int, stats: Stats) -> bool:
    try:
        data = json.loads(path.read_text(encoding='utf-8-sig'))
    except Exception as exc:
        stats.skipped += 1
        print(f'JSON skipped {path}: {exc}')
        return False
    if not isinstance(data, dict):
        return False
    normalized, changed = normalize_any(data, quality, stats)
    if not changed:
        return False
    path.write_text(json.dumps(normalized, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f'CMS media normalized: {path}')
    return True


def convert_unreferenced_media(quality: int, stats: Stats) -> None:
    for path in all_media_paths():
        convert(path, quality, stats)


def main() -> None:
    stats = Stats()
    for path in article_json_paths():
        stats.scanned_articles += 1
        if normalize_article(path, 82, stats):
            stats.updated_articles += 1
    convert_unreferenced_media(82, stats)
    print(
        'CMS media WebP normalize completed: '
        f'scanned={stats.scanned_articles} '
        f'changed={stats.updated_articles} '
        f'converted_files={stats.converted_files} '
        f'deleted_sources={stats.deleted_sources} '
        f'skipped={stats.skipped}'
    )


if __name__ == '__main__':
    main()
