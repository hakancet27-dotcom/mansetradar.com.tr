#!/usr/bin/env python3
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from PIL import Image, ImageOps

ARTICLE_DIRS = (Path('articles'), Path('news/articles'), Path('nachrichten/artikel'))
SKIP_PARTS = {'images', 'review', 'pending', 'duplicates', 'archive'}
CONVERTIBLE_SUFFIXES = {'.jpg', '.jpeg', '.png', '.avif'}


def is_remote(value: str) -> bool:
    return value.startswith('http://') or value.startswith('https://')


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


def convert(path: Path, quality: int) -> Path | None:
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
            path.unlink()
        return target
    except Exception as exc:
        print(f'WebP skipped {path}: {exc}')
        return None


def public_path(path: Path) -> str:
    return '/' + path.resolve().relative_to(Path('.').resolve()).as_posix()


def normalize_value(value: Any, quality: int) -> tuple[Any, bool]:
    source = site_file(value)
    if source is None:
        return value, False
    target = convert(source, quality)
    if target is None:
        return value, False
    new_value = public_path(target)
    return new_value, new_value != clean(value)


def normalize_article(path: Path, quality: int) -> bool:
    try:
        data = json.loads(path.read_text(encoding='utf-8-sig'))
    except Exception as exc:
        print(f'JSON skipped {path}: {exc}')
        return False
    if not isinstance(data, dict):
        return False
    changed = False
    new_image, image_changed = normalize_value(data.get('image_url'), quality)
    if image_changed:
        data['image_url'] = new_image
        changed = True
    gallery = data.get('image_gallery') or []
    if isinstance(gallery, list):
        normalized = []
        for item in gallery:
            if isinstance(item, str):
                new_value, item_changed = normalize_value(item, quality)
                normalized.append({'image_url': new_value, 'image_alt': '', 'caption': ''})
                changed = changed or item_changed or True
            elif isinstance(item, dict):
                updated = dict(item)
                key = 'image_url' if 'image_url' in updated else 'url' if 'url' in updated else 'image'
                if key in updated:
                    new_value, item_changed = normalize_value(updated.get(key), quality)
                    updated[key] = new_value
                    changed = changed or item_changed
                normalized.append(updated)
            else:
                normalized.append(item)
        if normalized != gallery:
            data['image_gallery'] = normalized
            changed = True
    if not changed:
        return False
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f'CMS media normalized: {path}')
    return True


def main() -> None:
    changed = 0
    scanned = 0
    for path in article_json_paths():
        scanned += 1
        if normalize_article(path, 82):
            changed += 1
    print(f'CMS media WebP normalize completed: scanned={scanned} changed={changed}')


if __name__ == '__main__':
    main()
